// DockLayout (hadi-march/ui): an IDE workspace, the dock of march-app-ui (after HADİ Studio Kit). Tab groups in rows and
// columns; drag a tab to a side of a group (a new split), onto its centre or between tabs (a tab), or to the outer edge.
// Closing never deletes, it collapses the group to a strip (vertical in a row, horizontal in a column) and keeps its size
// for the way back. Groups fill the whole area, layouts come from presets, are saved and loaded (plain JSON).
// Under `narrow` px it is one tab group. The tree logic is model.ts (no DOM).
//
// Built from TabList (the strip of Tabs, for every group's tabs; a narrowed title scrolls: OverflowText; icon, title, badge, "changed" dot, close mark), IconButton (menu, maximize,
// collapse), Button (strip entries), ResizeHandle (every splitter: pointer, arrows, Shift, Enter / double click to
// equalize), the shared menu panel (panel and layout menus) and dragGhost. Panels never move in the DOM: each panel's
// content is built once and only gets a position and a size, so iframes and editors keep their state. A hidden panel
// (collapsed, a tab in the back, another group maximized) keeps its last size and is hidden with visibility.
import "./dock-layout.css";
import { signal, computed, effect, untrack, createRoot, getOwner, onCleanup, type Signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, uid, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { load, save } from "../../../core/util.ts";
import { observeSize } from "../../../ui/observe.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { TabList, type TabSpec } from "../../navigation/tabs/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Button } from "../../actions/button/index.ts";
import { menuPanel, type MenuItem } from "../../actions/menu/index.ts";
import { ResizeHandle } from "../../layout/resize-handle/index.ts";
import { OverflowText } from "../../typography/overflow-text/index.ts";
import { dragGhost, type DragGhost } from "../../../behaviors/drag/ghost.ts";
import { command } from "../../../managers/command/index.ts";
import { more } from "../../../icons/glyphs/more.ts";
import { maximize as maxIcon } from "../../../icons/glyphs/maximize.ts";
import { minimize as restoreIcon } from "../../../icons/glyphs/minimize.ts";
import { minus } from "../../../icons/glyphs/minus.ts";
import * as C from "./model.ts";
import type { DockTree, Preset, PanelDef, Rects, Rect, Zone, Hit, TreeSpec } from "./model.ts";
import tr from "./tr.ts";

messages("tr", tr);
// preset helpers and types here; every tree operation is exported from hadi-march/app-ui
export { row, col, tabs } from "./model.ts";
export type { DockTree, LayoutNode, TabsNode, SplitNode, Preset, PanelDef, PanelPlace, TreeSpec, Zone, Side, Rect } from "./model.ts";

/** A panel of the workspace. `content` runs once; the panel keeps it while it moves, collapses or hides. */
export interface DockPanel extends PanelDef {
  title: MaybeFn<string>;
  icon?: unknown;
  content: () => unknown;
  /** A close mark on the tab (the panel leaves through `onClose`). */
  closable?: MaybeFn<boolean | undefined>;
  badge?: MaybeFn<number | null | undefined>;
  /** Unsaved changes: a dot on the tab. */
  dirty?: MaybeFn<boolean | null | undefined>;
  /** Runs when the panel becomes visible. */
  onShow?: () => void;
  /** The tab cannot be chosen (and its content is not shown while it is). */
  disabled?: MaybeFn<boolean | undefined>;
}
/** Where layouts are kept: any get / set (sync or async). The Storage manager's areas fit. */
export interface DockStorage { get(key: string): unknown; set(key: string, value: unknown): unknown }
/** The buttons of a group. */
export type DockAction = "menu" | "maximize" | "collapse";

/** Imperative control (`api={(a) => dock = a}`). */
export interface DockApi {
  /** The layout on screen (reactive). */
  layout: () => DockTree | null;
  /** Shows a panel: opens its strip, brings its tab to the front, ends another group's maximize. */
  open(id: string): void;
  /** Focuses a panel's tab (after showing it). */
  focus(id: string): void;
  /** Collapses the panel's group to a strip. */
  collapse(id: string): void;
  /** Closes a closable panel (asks `onClose`). */
  close(id: string): void;
  /** The panel's group fills the area (again: back). */
  toggleMaximize(id: string): void;
  /** Focus mode: every other group goes to a strip until `unfocus`. */
  focusMode(id: string): void;
  unfocus(): void;
  preset(name: string): void;
  reset(): void;
  expandAll(): void;
  isOpen(id: string): boolean;
  /** A saved or built layout. */
  load(layout: DockTree | TreeSpec): void;
  /** The layout menu: presets, saved layouts, the panel list (for a toolbar's Menu). */
  layoutMenu(): MenuItem[];
}

export interface DockLayoutProps {
  panels: MaybeFn<readonly DockPanel[]>;
  /** Ready-made layouts by name (`row`, `col`, `tabs`); the first (or `preset`) is the default. */
  presets?: Readonly<Record<string, Preset>> | undefined;
  preset?: string | undefined;
  /** The default layout without presets (default: the first panel, the others at their `place`). */
  layout?: TreeSpec | undefined;
  /** Keep the layout and saved layouts under this key. */
  persist?: string | undefined;
  /** Where (default localStorage); sync or async. */
  storage?: DockStorage | undefined;
  /** Accessible name of the workspace. */
  label?: MaybeFn<string | undefined>;
  /** Command id prefix for the palette (default "dock"); false: none. */
  commands?: string | false | undefined;
  api?: ((api: DockApi) => void) | undefined;
  onChange?: ((layout: DockTree) => void) | undefined;
  /** A closable tab's close mark: remove the panel from `panels` here; return false to keep it. */
  onClose?: ((panel: string) => boolean | void | Promise<boolean | void>) | undefined;
  /** The buttons of a group: true (default), false, or the ones to keep. Keyboard and `api` stay. */
  actions?: MaybeFn<boolean | readonly DockAction[] | undefined>;
  /** Below this width (px) the workspace is one tab group, no drag (default 560). */
  narrow?: number | undefined;
  /** The short slide when the layout changes (default true; none with reduced motion). */
  motion?: MaybeFn<boolean | undefined>;
  /** Own icons of the group buttons. */
  icons?: { menu?: unknown; maximize?: unknown; restore?: unknown; collapse?: unknown } | undefined;
  /** Own texts; each falls back to the built-in one. */
  labels?: { menu?: string; maximize?: string; restore?: string; collapse?: string; panels?: string; strip?: string } | undefined;
  /** id of the root (an ActivityBar's `controls`). */
  id?: string | undefined;
  class?: ClassProp;
}

const INSET = 8;
/** A dragged splitter snaps to another splitter's line within this many px. */
const SNAP = 10;
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const coarse = (): boolean => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const geoOpts = (): Partial<C.Metrics> => (coarse() ? { strip: 36, gap: 10 } : {});
function place(e: HTMLElement, r: Rect): void { const s = e.style; s.left = `${r.x}px`; s.top = `${r.y}px`; s.width = `${r.w}px`; s.height = `${r.h}px`; }
const div = (cls: string, attrs: Record<string, unknown> = {}, ...kids: unknown[]): HTMLElement => h("div", { class: cls, ...attrs }, ...kids) as HTMLElement;
const localStore: DockStorage = { get: (k) => load<unknown>(k, null), set: (k, v) => save(k, v) };

interface PanelView { def: DockPanel; el: HTMLElement; stab: HTMLElement; label: Node; shown: boolean; dispose: () => void }
interface Frame { group: string; placed: boolean; el: HTMLElement; tabs: Signal<TabSpec[]>; active: Signal<string | null>; max: Signal<boolean>; canClose: Signal<boolean>; bar: HTMLElement | undefined; dispose: () => void }
interface Sep { key: string; info: Signal<C.SplitterRect>; el: HTMLElement; dispose: () => void }

/** `<DockLayout panels={panels} presets={{ main: { title: "Main", tree: () => row([.25, tabs("files")], [.75, tabs("editor")]) } }} persist="ide" />` */
export function DockLayout(props: DockLayoutProps): Element {
  const base = uid("m-dock");
  const owner = getOwner();
  const defs: DockPanel[] = [];
  const panels = new Map<string, PanelView>(), frames = new Map<string, Frame>(), strips = new Map<string, HTMLElement>(), seps = new Map<string, Sep>();
  const presets = props.presets ?? {}, presetNames = Object.keys(presets);
  const store = props.persist ? (props.storage ?? localStore) : null;
  const key = (k: string): string => `${props.persist}:${k}`;
  const NARROW = props.narrow ?? 560;
  // the group buttons are read when drawn (a getter prop: they follow the value)
  const has = (a: DockAction): boolean => { const acts = val(props.actions) ?? true; return acts === true || (Array.isArray(acts) && acts.includes(a)); };
  const L$ = signal<DockTree | null>(null);
  let L: DockTree | null = null, phone: DockTree | null = null, rects: Rects | null = null, narrow = false, dragged = false;
  let saveT: ReturnType<typeof setTimeout> | undefined, animT: ReturnType<typeof setTimeout> | undefined, focusSaved: DockTree | null = null, started = false;
  let saved: Record<string, DockTree> = {};
  const view = (): DockTree | null => (narrow ? phone : L);
  const titleOf = (id: string): string => { const p = panels.get(id); return p ? val(p.def.title) : id; };
  const mins = (): Record<string, readonly [number, number]> => Object.fromEntries(defs.map((d) => [d.id, d.min ?? [120, 80]] as const));
  const fit = (): C.Geo | undefined => (rects ? { area: rects.area, opts: { mins: mins(), ...geoOpts() } } : undefined);
  const base0 = (): DockTree | null => {
    if (!defs.length) return null;
    const p = presets[props.preset ?? presetNames[0] ?? ""];
    return C.presetLayout(p, defs) ?? (props.layout ? C.restoreLayout(C.fromTree(props.layout), defs) : null) ?? C.addMissing(C.singleLayout([]), defs);
  };

  // ---------------------------------------------------------------- DOM
  const under = div("m-dock-under"), over = div("m-dock-over");
  const menuOpen = signal(false), menuList = signal<readonly MenuItem[]>([]);
  let menuAnchor: HTMLElement | undefined;
  const menu = menuPanel({
    anchor: () => menuAnchor, open: menuOpen, items: () => menuList(), label: () => t`Panel menu`, class: "m-dock-menu", placement: "bottom-start",
    close: (refocus) => { menuOpen.set(false); if (refocus) menuAnchor?.focus(); },
  });
  const root = div("", {
    id: props.id ?? null, class: () => cx("m-dock", val(props.motion) === false && "is-still", val(props.class)), role: "group",
    "aria-roledescription": () => t`workspace`, "aria-label": () => val(props.label) ?? t`Workspace`,
  }, under, over, menu);
  const openMenu = (anchor: HTMLElement, items: MenuItem[]): void => { menuAnchor = anchor; menuList.set(items); menuOpen.set(true); };

  // ---------------------------------------------------------------- drawing
  function setShown(p: PanelView, on: boolean): void {
    if (on && !p.shown) queueMicrotask(() => p.def.onShow?.());
    p.el.classList.toggle("is-snap", !on || !p.shown); // a panel that just opened does not slide from its old place
    p.el.classList.toggle("is-hidden", !on);
    p.el.inert = !on;
    p.shown = on;
  }
  function render(anim = false): void {
    const V = view();
    if (!V) { for (const p of panels.values()) setShown(p, false); for (const f of frames.values()) f.el.hidden = true; return; }
    const A = { x: INSET, y: INSET, w: Math.max(0, root.clientWidth - 2 * INSET), h: Math.max(0, root.clientHeight - 2 * INSET) };
    rects = C.computeRects(V, A, { mins: mins(), ...geoOpts() });
    const maxId = V.max, head = C.METRICS.header;
    clearTimeout(animT);
    root.classList.toggle("is-anim", anim);
    if (anim) animT = setTimeout(() => root.classList.remove("is-anim"), 240);
    const liveF = new Set<string>(), liveS = new Set<string>(), liveK = new Set<string>();
    const bodyOf = (r: Rect): Rect => ({ x: r.x + 1, y: r.y + head, w: Math.max(0, r.w - 2), h: Math.max(0, r.h - head - 1) });
    for (const g of C.groups(V.root)) {
      const r = rects.groups[g.id];
      if (!r) { for (const id of g.panels) { const p = panels.get(id); if (p) setShown(p, false); } continue; } // collapsed: hidden at its last size
      const visible = !maxId || maxId === g.id, box = maxId === g.id ? A : r;
      liveF.add(g.id);
      const f = frames.get(g.id) ?? makeFrame(g.id);
      f.el.hidden = !visible;
      f.el.classList.toggle("is-snap", !f.placed);
      place(f.el, box); f.placed = true;
      paintFrame(f, g, maxId === g.id, V);
      for (const id of g.panels) {
        const p = panels.get(id);
        if (!p) continue;
        setShown(p, visible && id === g.active);
        place(p.el, bodyOf(visible ? box : r));
      }
    }
    for (const [id, f] of frames) if (!liveF.has(id)) { f.el.remove(); f.dispose(); frames.delete(id); }
    for (const s of rects.strips) {
      liveS.add(s.id);
      let box = strips.get(s.id);
      if (!box) { box = div("m-dock-strip", { role: "group", "aria-label": () => props.labels?.strip ?? t`Collapsed panels` }); over.append(box); strips.set(s.id, box); }
      box.dataset["mode"] = s.mode; box.hidden = !!maxId;
      place(box, s.rect);
      const list = s.panels.map((x) => panels.get(x.panel)?.stab).filter((b): b is HTMLElement => !!b);
      if (list.length !== box.children.length || list.some((b, i) => box!.children[i] !== b)) box.replaceChildren(...list);
    }
    for (const [id, b] of strips) if (!liveS.has(id)) { b.remove(); strips.delete(id); }
    for (const s of rects.splitters) {
      liveK.add(s.key);
      const e = seps.get(s.key);
      if (e) e.info.set(s); else makeSep(s);
      const el = (seps.get(s.key) as Sep).el;
      el.hidden = !!maxId;
      place(el, s.rect);
    }
    for (const [k, e] of seps) if (!liveK.has(k)) { e.el.remove(); e.dispose(); seps.delete(k); }
  }
  function commit(next: DockTree | null, o: { anim?: boolean; save?: boolean } = {}): boolean {
    const cur = view();
    if (!next || next === cur || same(next, cur)) return false;
    if (narrow) phone = next; else { L = next; if (o.save !== false) persist(); props.onChange?.(next); }
    L$.set(view());
    render(!!o.anim);
    return true;
  }

  // ---------------------------------------------------------------- a group: TabList and its buttons
  function paintFrame(f: Frame, g: C.TabsNode, isMax: boolean, V: DockTree): void {
    f.group = g.id;
    const specs = g.panels.map((id) => panels.get(id)?.def).filter((d): d is DockPanel => !!d);
    const cur = untrack(f.tabs);
    if (specs.length !== cur.length || specs.some((d, i) => cur[i]?.id !== d.id)) f.tabs.set(specs.map(tabSpec));
    f.active.set(g.active);
    f.max.set(isMax);
    f.canClose.set(C.canCollapse(V, g.id));
  }
  const tabSpec = (d: DockPanel): TabSpec => ({ id: d.id, label: panels.get(d.id)?.label ?? (() => val(d.title)), icon: d.icon, badge: d.badge, dirty: d.dirty === undefined ? undefined : () => !!val(d.dirty), closable: d.closable ?? undefined, disabled: d.disabled === undefined ? undefined : () => !!val(d.disabled) });
  function makeFrame(id: string): Frame {
    return createRoot((dispose) => {
      const f = { group: id, placed: false, dispose, tabs: signal<TabSpec[]>([]), active: signal<string | null>(null), max: signal(false), canClose: signal(true), bar: undefined } as unknown as Frame;
      const gid = (): string => f.group;
      const menuBtn: HTMLElement = h(IconButton, {
        icon: ownIcon(props.icons?.menu, more), label: () => props.labels?.menu ?? t`Panel menu`, size: "sm", class: "m-dock-hb m-dock-hb-menu", "aria-haspopup": "menu",
        onClick: () => { const g = C.findNode(view() as DockTree, gid()) as C.TabsNode | null; if (g?.active) openMenu(menuBtn, panelMenu(g.active)); },
      }) as HTMLElement;
      const head = div("m-dock-head", {
        onPointerdown: (e: PointerEvent) => {
          const tg = e.target as HTMLElement;
          if (e.button !== 0 || narrow || view()?.max || tg.closest(".m-dock-hb, .m-tab-close")) return;
          const tab = tg.closest<HTMLElement>("[data-tab]");
          const g = C.findNode(view() as DockTree, gid()) as C.TabsNode | null;
          const pid = tab?.dataset["tab"] ?? g?.active;
          if (pid) armDrag(e, pid, head);
        },
        onDblclick: (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".m-dock-hb") && !narrow && has("maximize")) toggleMax(gid()); },
      },
      h(TabList, {
        tabs: f.tabs, value: f.active, onSelect: (pid: string) => { if (!dragged) activate(pid); }, variant: "none", class: "m-dock-tabs",
        label: () => props.labels?.panels ?? t`Panel tabs`, tabId: (pid: string) => `${base}-t-${pid}`, onClose: (pid: string) => { void closePanel(pid); },
        tabProps: (x: TabSpec) => ({
          class: "m-dock-tab", "aria-controls": `${base}-p-${x.id}`,
          onKeydown: (k: KeyboardEvent) => tabKey(k, x.id),
          onContextmenu: (c: MouseEvent) => { if (narrow) return; c.preventDefault(); openMenu(c.currentTarget as HTMLElement, panelMenu(x.id)); },
        }),
      }),
      () => (has("menu") ? menuBtn : null),
      () => (has("maximize") ? untrack(() => h(IconButton, {
        icon: () => (f.max() ? ownIcon(props.icons?.restore, restoreIcon) : ownIcon(props.icons?.maximize, maxIcon)), size: "sm", class: "m-dock-hb", pressed: f.max,
        label: () => (f.max() ? props.labels?.restore ?? t`Back to its size` : props.labels?.maximize ?? t`Fill the whole area`), onClick: () => toggleMax(gid()),
      })) : null),
      () => (has("collapse") ? untrack(() => h(IconButton, {
        icon: ownIcon(props.icons?.collapse, minus), size: "sm", class: "m-dock-hb", disabled: () => !f.canClose(),
        label: () => props.labels?.collapse ?? t`Collapse to a strip`, onClick: () => collapse(gid()),
      })) : null));
      f.el = div("m-dock-frame", {}, head);
      under.append(f.el);
      frames.set(id, f);
      return f;
    }, owner);
  }
  const focusTab = (id: string): void => { (root.querySelector(`#${CSS.escape(`${base}-t-${id}`)}`) as HTMLElement | null)?.focus(); };
  const focusStrip = (id: string): void => panels.get(id)?.stab.focus();
  const activate = (id: string): void => { const V = view(); if (V) commit(C.setActive(V, id)); };
  function collapse(gid: string): void {
    const V = view();
    if (!V) return;
    const n = C.findNode(V, gid) as C.TabsNode | null;
    if (!n || !C.canCollapse(V, gid)) return;
    commit(C.collapseGroup(V, gid, fit()), { anim: true });
    if (n.active) focusStrip(n.active);
  }
  function restore(id: string): void {
    const V = view(), g = V && C.groupOf(V, id);
    if (!g) return;
    commit(C.restoreGroup(V as DockTree, g.id, id, fit()), { anim: true });
    focusTab(id);
  }
  const toggleMax = (gid: string): void => { const V = view(); if (V) commit(C.maximize(V, gid), { anim: true }); };
  const moveWithFocus = (next: DockTree, id: string): void => { commit(next, { anim: true }); queueMicrotask(() => focusTab(id)); };
  async function closePanel(id: string): Promise<void> {
    if (await props.onClose?.(id) === false) return;
    // the owner removes it from `panels`; a panel it keeps (no onClose) goes to a strip instead
    if (!props.onClose) { const g = view() && C.groupOf(view() as DockTree, id); if (g) collapse(g.id); }
  }
  function tabKey(e: KeyboardEvent, id: string): void {
    const V = view();
    const g = V && C.groupOf(V, id);
    if (!V || !g) return;
    const i = g.panels.indexOf(id), last = g.panels.length - 1;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault(); e.stopPropagation();
      const j = e.key === "ArrowLeft" ? i - 1 : i + 1;
      if (j >= 0 && j <= last) moveWithFocus(C.moveTab(V, id, j), id);
      return;
    }
    if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); openMenu(e.currentTarget as HTMLElement, panelMenu(id)); }
  }

  // ---------------------------------------------------------------- splitters (ResizeHandle)
  function makeSep(s0: C.SplitterRect): void {
    createRoot((dispose) => {
      const info = signal(s0);
      const px = (): { pa: number; pb: number } => { const i = rects?.splits[info().split]; return { pa: i?.px[info().a] ?? 0, pb: i?.px[info().b] ?? 0 }; };
      let start: DockTree | null = null, startR: Rects | null = null, from = 0, dragging = false;
      // while dragging, the splitter snaps to the line of another splitter of the same direction (a neighbouring
      // column's or row's edge) when it comes within SNAP px: edges line up across the workspace
      const snap = (v: number): number => {
        const R = startR, s = info();
        if (!dragging || !R) return v;
        const mid = (r: Rect): number => (s.axis === "row" ? r.x + r.w / 2 : r.y + r.h / 2);
        const own = R.splitters.find((x) => x.key === s.key);
        if (!own) return v;
        const at = mid(own.rect) + (v - from);
        let best = SNAP + 1, to = at;
        for (const o of R.splitters) {
          if (o.key === s.key || o.axis !== s.axis) continue;
          const d = Math.abs(mid(o.rect) - at);
          if (d < best) { best = d; to = mid(o.rect); }
        }
        return best <= SNAP ? v + (to - at) : v;
      };
      const el = h(ResizeHandle, {
        class: "m-dock-sep", edge: s0.axis === "row" ? "end" : "bottom", axis: s0.axis === "row" ? "inline" : "block", "data-axis": s0.axis, label: () => sepLabel(info()),
        value: () => px().pa, min: 0, max: 1e6,
        set: (v: number, done: boolean) => {
          if (!start) { start = L; startR = rects; from = px().pa; }
          if (start && startR) { const n = C.resizeSplit(start, info().split, info().a, info().b, snap(v) - from, startR); if (n !== L) { L = n; L$.set(L); render(); } }
          if (done) { start = null; startR = null; persist(); }
        },
        reset: () => { if (L) commit(C.equalize(L, info().split), { anim: true }); },
        onStart: () => { dragging = true; shield(true, info().axis === "row" ? "col-resize" : "row-resize"); },
        onEnd: () => { dragging = false; shield(false); start = null; startR = null; persist(); },
      }) as HTMLElement;
      over.append(el);
      seps.set(s0.key, { key: s0.key, info, el, dispose });
    }, owner);
  }
  function sepLabel(s: C.SplitterRect): string {
    const V = view(), node = V && (C.findNode(V, s.split) as C.SplitNode | null);
    if (!node) return t`Splitter`;
    const nm = (k: C.LayoutNode | undefined): string => (k ? titleOf((C.groups(k)[0] as C.TabsNode | undefined)?.active ?? "") : "");
    return `${t`Splitter`}: ${nm(node.kids[s.a])} / ${nm(node.kids[s.b])}`;
  }

  // ---------------------------------------------------------------- drag and drop
  let shieldEl: HTMLElement | null = null;
  /** A clear shield while dragging, so iframes do not swallow the pointer. */
  function shield(on: boolean, cursor = ""): void {
    root.classList.toggle("is-dragging", on);
    if (on) { shieldEl ??= div("m-dock-shield"); shieldEl.style.cursor = cursor; root.append(shieldEl); } else shieldEl?.remove();
  }
  function armDrag(e: PointerEvent, id: string, source: HTMLElement): void {
    if (narrow || !id) return;
    const sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    let on = false, hit: Hit | null = null, idx: number | null = null, ghost: DragGhost | null = null;
    const preview = div("m-dock-preview"), zones = div("m-dock-zones"), mark = div("m-dock-insert");
    for (const z of ["left", "right", "top", "bottom", "center"]) zones.append(div("m-dock-zone", { "data-z": z }));
    const paint = (x: number, y: number): void => {
      ghost?.move(x, y);
      const b = root.getBoundingClientRect();
      hit = rects ? C.hitTest(rects, x - b.left, y - b.top, geoOpts()) : null;
      preview.hidden = !hit; zones.hidden = true; mark.hidden = true; idx = null;
      if (!hit || !rects) return;
      place(preview, hit.rect);
      const box = rects.groups[hit.target];
      if (hit.onTabs) {
        const kids = Array.from(frames.get(hit.target)?.el.querySelectorAll<HTMLElement>("[data-tab]") ?? []);
        if (!kids.length) return;
        const at = kids.findIndex((k) => { const r = k.getBoundingClientRect(); return x < r.left + r.width / 2; });
        idx = at < 0 ? kids.length : at;
        const r = (kids[at] ?? kids[kids.length - 1] as HTMLElement).getBoundingClientRect();
        mark.hidden = false; place(mark, { x: (at < 0 ? r.right : r.left) - b.left - 1, y: r.top - b.top, w: 3, h: r.height });
      } else if (box) {
        zones.hidden = false;
        const zr = C.zoneRects(box);
        for (const c of Array.from(zones.children) as HTMLElement[]) { const z = c.dataset["z"] as Zone; place(c, zr[z]); c.classList.toggle("is-on", z === (hit as Hit).zone); }
      }
    };
    const move = (m: PointerEvent): void => {
      if (!on) {
        if (Math.hypot(m.clientX - sx, m.clientY - sy) < 6) return;
        on = true; dragged = true;
        menuOpen.set(false);
        try { source.setPointerCapture(pid); } catch { /* the pointer is gone */ }
        shield(true, "grabbing");
        ghost = runIn(() => dragGhost(div("m-dock-ghost", {}, titleOf(id)), { motion: () => val(props.motion) !== false }));
        over.append(zones, preview, mark);
      }
      paint(m.clientX, m.clientY);
    };
    const stop = (drop: boolean): void => {
      removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", cancel); removeEventListener("keydown", key, true);
      if (!on) return;
      shield(false); ghost?.close(); zones.remove(); preview.remove(); mark.remove();
      setTimeout(() => { dragged = false; }, 0);
      const h0 = hit as Hit | null;
      if (drop && h0 && L) {
        let at: number | undefined = h0.onTabs && idx !== null ? idx : undefined;
        const src = C.groupOf(L, id);
        if (at !== undefined && src && src.id === h0.target && src.panels.indexOf(id) < at) at--;
        commit(C.movePanel(L, id, h0.target, h0.zone, at), { anim: true });
      }
    };
    const up = (): void => stop(true), cancel = (): void => stop(false);
    const key = (k: KeyboardEvent): void => { if (k.key === "Escape") { k.preventDefault(); k.stopPropagation(); stop(false); } };
    addEventListener("pointermove", move); addEventListener("pointerup", up); addEventListener("pointercancel", cancel); addEventListener("keydown", key, true);
  }
  const runIn = <T>(fn: () => T): T => createRoot(() => fn(), owner);

  // ---------------------------------------------------------------- menus (the shared menu panel)
  function panelMenu(id: string): MenuItem[] {
    const V = view() as DockTree, g = C.groupOf(V, id) as C.TabsNode | null;
    if (!g) return [];
    if (narrow) return defs.map((d) => ({ label: titleOf(d.id), checked: g.active === d.id, onSelect: () => openPanel(d.id) }));
    const i = g.panels.indexOf(id), items: MenuItem[] = [];
    // every tab of the group first: the ones that did not fit in the strip are reached here
    if (g.panels.length > 1) {
      for (const p of g.panels) { const d = panels.get(p)?.def; items.push({ label: titleOf(p), icon: d?.icon, checked: g.active === p, onSelect: () => { activate(p); queueMicrotask(() => focusTab(p)); } }); }
      items.push("-");
    }
    if (g.panels.length > 1) {
      items.push({ label: () => t`Move tab left`, disabled: i === 0, onSelect: () => moveWithFocus(C.moveTab(V, id, i - 1), id) });
      items.push({ label: () => t`Move tab right`, disabled: i === g.panels.length - 1, onSelect: () => moveWithFocus(C.moveTab(V, id, i + 1), id) });
      items.push("-");
    }
    const edge: [C.Side, () => string][] = [["left", () => t`Dock to the left edge`], ["right", () => t`Dock to the right edge`], ["top", () => t`Dock to the top edge`], ["bottom", () => t`Dock to the bottom edge`]];
    for (const [z, label] of edge) items.push({ label, onSelect: () => L && moveWithFocus(C.movePanel(L, id, C.ROOT, z), id) });
    for (const o of C.groups(V.root)) if (o.id !== g.id) items.push({ label: () => t`Join as a tab: ${o.panels.map(titleOf).join(" · ")}`, onSelect: () => L && moveWithFocus(C.movePanel(L, id, o.id, "center"), id) });
    items.push("-");
    if (has("collapse")) items.push({ label: () => t`Collapse to a strip`, disabled: !C.canCollapse(V, g.id), onSelect: () => collapse(g.id) });
    items.push({ label: () => (V.max === g.id ? t`Back to its size` : t`Fill the whole area`), onSelect: () => toggleMax(g.id) });
    items.push({ label: () => t`Reset this panel`, onSelect: () => { const p = panels.get(id); if (p && L) commit(C.resetPanel(L, p.def, defs), { anim: true }); } });
    items.push({ label: () => t`Reset layout`, onSelect: () => commit(base0(), { anim: true }) });
    return items;
  }
  function layoutMenu(): MenuItem[] {
    const V = view();
    const isOpen = (id: string): boolean => { const g = V && C.groupOf(V, id); return !!g && !g.collapsed && g.active === id; };
    const panelItems: MenuItem[] = defs.map((d) => ({ label: titleOf(d.id), icon: d.icon, checked: isOpen(d.id), onSelect: () => togglePanel(d.id) }));
    if (narrow) return panelItems;
    const names = Object.keys(saved).sort((a, b) => a.localeCompare(b));
    return [
      ...presetNames.map((k): MenuItem => ({ label: (presets[k] as Preset).title, onSelect: () => commit(C.presetLayout(presets[k], defs), { anim: true }) })),
      ...(presetNames.length ? ["-" as const] : []),
      ...names.map((n): MenuItem => ({ label: n, sub: () => t`saved layout`, onSelect: () => commit(C.restoreLayout(saved[n], defs) ?? base0(), { anim: true }) })),
      ...(store ? [{ label: () => t`Save this layout`, onSelect: saveAs } as MenuItem] : []),
      ...(names.length ? [{ label: () => t`Delete saved layouts`, danger: true, onSelect: () => { saved = {}; writeSaved(); } } as MenuItem] : []),
      "-",
      ...panelItems,
      "-",
      { label: () => t`Open all panels`, onSelect: () => { if (L) commit(C.expandAll(L), { anim: true }); } },
      { label: () => t`Reset to default`, onSelect: () => commit(base0(), { anim: true }) },
    ];
  }
  function togglePanel(id: string): void {
    const V = view(), g = V && C.groupOf(V, id);
    if (!g) return;
    if (narrow || g.collapsed || g.active !== id) { openPanel(id); focusTab(id); } else collapse(g.id);
  }
  function saveAs(): void {
    if (!L) return;
    let n = 1;
    while (saved[t`Layout ${n}`]) n++;
    saved[t`Layout ${n}`] = C.serialize(L);
    writeSaved();
  }
  function openPanel(id: string): void {
    const V = view();
    if (!panels.has(id) || !V) return;
    commit(narrow ? C.setActive(V, id) : C.reveal(L as DockTree, id, fit()), { anim: !narrow });
  }

  // ---------------------------------------------------------------- persistence
  const writeSaved = (): void => { if (store) void Promise.resolve(store.set(key("saved"), saved)).catch(() => undefined); };
  function persist(now = false): void {
    clearTimeout(saveT);
    const write = (): void => { if (L && store && !focusSaved) void Promise.resolve(store.set(key("layout"), C.serialize(L))).catch(() => undefined); };
    if (now) write(); else saveT = setTimeout(write, 250);
  }

  // ---------------------------------------------------------------- panels (the list may change: editors open and close)
  function addPanel(def: DockPanel): void {
    defs.push(def);
    createRoot((dispose) => {
      const body = div("m-dock-panel is-hidden is-snap", { id: `${base}-p-${def.id}`, role: "tabpanel", "aria-labelledby": `${base}-t-${def.id}` }, def.content());
      const stab: HTMLElement = h(Button, {
        variant: "ghost", size: "sm", class: "m-dock-stab", icon: def.icon, "aria-expanded": "false", title: () => `${val(def.title)} · ${t`Open panel`}`,
        onClick: () => { if (!dragged) restore(def.id); },
        onPointerdown: (p: PointerEvent) => { if (p.button === 0) armDrag(p, def.id, stab); },
        onContextmenu: (c: MouseEvent) => { c.preventDefault(); openMenu(stab, panelMenu(def.id)); },
      }, h("span", { class: "m-dock-stl" }, () => val(def.title))) as HTMLElement;
      over.before(body);
      // the tab's title: when the tab is narrowed it scrolls while hovered or focused (the icon stays put)
      const label = h(OverflowText, { class: "m-dock-tl", trigger: ["hover", "focus"], mode: "loop" }, () => val(def.title)) as Node;
      panels.set(def.id, { def, el: body, stab, label, shown: false, dispose });
    }, owner);
  }
  function dropPanel(id: string): void {
    const p = panels.get(id);
    if (!p) return;
    panels.delete(id);
    defs.splice(defs.findIndex((d) => d.id === id), 1);
    p.stab.remove(); p.el.remove(); p.dispose();
  }
  effect(() => {
    const list = val(props.panels) ?? [];
    untrack(() => {
      const ids = new Set(list.map((p) => p.id));
      const gone = [...panels.keys()].filter((id) => !ids.has(id)), fresh = list.filter((p) => !panels.has(p.id));
      if (!gone.length && !fresh.length) return;
      for (const id of gone) dropPanel(id);
      for (const p of fresh) addPanel(p);
      if (!started) return;
      // new panels go to their `place` (or next to the panel `place.near` names), gone ones leave the tree
      L = L ? (C.restoreLayout(C.serialize(L), defs) ?? base0()) : base0();
      for (const p of fresh) if (L) L = C.reveal(L, p.id, fit());
      if (narrow) phone = C.singleLayout(defs, fresh[0]?.id ?? (phone?.root.t === "tabs" ? phone.root.active : null));
      L$.set(view());
      if (L) { persist(); props.onChange?.(L); }
      render(true);
    });
  });
  function syncNarrow(): void {
    const n = root.clientWidth > 0 && root.clientWidth < NARROW;
    if (n === narrow) return;
    menuOpen.set(false);
    narrow = n;
    root.classList.toggle("is-narrow", n);
    if (n && L) { const open = C.groups(L.root).find((g) => !g.collapsed); phone = C.singleLayout(defs, open?.active); }
    L$.set(view());
  }

  // ---------------------------------------------------------------- start
  started = true;
  L = base0();
  L$.set(L);
  root.classList.add("is-pending");
  void (async () => {
    try {
      const raw = store ? await store.get(key("layout")) : null;
      const got = raw ? C.restoreLayout(raw, defs) : null;
      if (got) { L = got; if (!narrow) L$.set(L); render(); }
      saved = ((store ? await store.get(key("saved")) : null) as Record<string, DockTree> | null) ?? {};
    } catch { /* no storage: the default stays */ }
    root.classList.remove("is-pending");
  })();
  const stopSize = observeSize(root, () => { syncNarrow(); render(); });
  const onHide = (): void => { if (saveT) persist(true); };
  addEventListener("pagehide", onHide);
  onCleanup(() => { stopSize(); shield(false); removeEventListener("pagehide", onHide); onHide(); });

  const prefix = props.commands === false ? null : (props.commands ?? "dock");
  if (prefix) {
    const cmds = [
      command({ id: `${prefix}.reset`, title: () => t`Reset layout`, group: t`Layout`, run: () => { commit(base0(), { anim: true }); } }),
      command({ id: `${prefix}.expandAll`, title: () => t`Open all panels`, group: t`Layout`, run: () => { if (L) commit(C.expandAll(L), { anim: true }); } }),
      ...presetNames.map((k) => command({ id: `${prefix}.preset.${k}`, title: () => `${t`Layout`}: ${(presets[k] as Preset).title}`, group: t`Layout`, run: () => { commit(C.presetLayout(presets[k], defs), { anim: true }); } })),
    ];
    onCleanup(() => cmds.forEach((c) => c.dispose()));
  }

  props.api?.({
    layout: () => L$(),
    open: openPanel,
    focus: (id) => { openPanel(id); queueMicrotask(() => focusTab(id)); },
    collapse: (id) => { const g = view() && C.groupOf(view() as DockTree, id); if (g) collapse(g.id); },
    close: (id) => { void closePanel(id); },
    toggleMaximize: (id) => { const g = view() && C.groupOf(view() as DockTree, id); if (g) toggleMax(g.id); },
    focusMode: (id) => {
      if (!panels.has(id)) return;
      if (narrow) { openPanel(id); return; }
      if (focusSaved || !L) return;
      focusSaved = L;
      commit(C.focusOnly(L, id, fit()), { anim: true, save: false });
    },
    unfocus: () => { if (!focusSaved) return; const back = focusSaved; focusSaved = null; commit(C.normalize(back), { anim: true }); },
    preset: (name) => { commit(C.presetLayout(presets[name], defs) ?? base0(), { anim: true }); },
    reset: () => { commit(base0(), { anim: true }); },
    expandAll: () => { if (L) commit(C.expandAll(L), { anim: true }); },
    isOpen: (id) => { const g = view() && C.groupOf(view() as DockTree, id); return !!g && !g.collapsed; },
    load: (x) => { commit("t" in x ? C.restoreLayout(C.fromTree(x), defs) : C.restoreLayout(x, defs), { anim: true }); },
    layoutMenu,
  });
  return root;
}
