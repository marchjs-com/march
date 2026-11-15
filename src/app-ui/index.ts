// march-app-ui (hadi-march/app-ui): the core of an IDE-like app. Panels dock, resize, collapse to strips, become tabs and
// fill the whole area; ready-made and saved layouts. The tree logic is in layout.ts (no DOM); this file draws it.
// Ported from HADİ Studio Kit (dock.js, dock.css).
//
// Panels never move in the DOM: each panel's content is built once, sits flat under the workspace and only gets a position
// and a size (CSSOM). Moving an iframe would reload it, an editor would lose its state. A hidden panel (collapsed, a tab in
// the back, another group maximized) keeps its last size and is hidden with visibility: canvases and editors never see 0.
import "./app-ui.css";
import { signal, createRoot, onCleanup, getOwner, type Signal } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { t, messages } from "../core/i18n.ts";
import { val, cx, icon, type MaybeFn, type ClassProp } from "../ui/util.ts";
import { observeSize } from "../ui/observe.ts";
import { load, save, clamp } from "../core/util.ts";
import { more } from "../icons/glyphs/more.ts";
import { maximize as maxIcon } from "../icons/glyphs/maximize.ts";
import { minimize as restoreIcon } from "../icons/glyphs/minimize.ts";
import { x as closeIcon } from "../icons/glyphs/x.ts";
import { columns } from "../icons/glyphs/columns.ts";
import * as C from "./layout.ts";
import type { Layout, Preset, PanelDef, Rects, Rect, Zone, Hit } from "./layout.ts";
import tr from "./tr.ts";

messages("tr", tr);
export * from "./layout.ts";

/** A panel of the workspace. `content` runs once; the panel keeps it while it moves, collapses or hides. */
export interface AppPanel extends PanelDef {
  title: MaybeFn<string>;
  icon?: unknown;
  content: () => unknown;
  /** Runs when the panel becomes visible. */
  onShow?: () => void;
}
/** Where layouts are kept: any get / set (sync or async). */
export interface AppStorage { get(key: string): unknown; set(key: string, value: unknown): unknown }
export interface AppUIProps {
  panels: readonly AppPanel[];
  /** Ready-made layouts by name; the first (or `preset`) is the default. Without presets every panel is one tab group. */
  presets?: Readonly<Record<string, Preset>>;
  /** The default preset's name. */
  preset?: string;
  /** Keep the layout: a localStorage key, or a storage with get / set. */
  persist?: string | AppStorage;
  /** Text before the layout button in the top bar; `bar: false` hides the bar. */
  title?: MaybeFn<string>;
  bar?: boolean;
  /** Extra items at the end of the top bar. */
  tools?: unknown;
  /** Below this width (px) the workspace is one tab group (default 768). */
  narrow?: number;
  class?: ClassProp;
  api?: (a: AppUIApi) => void;
}
/** Imperative control. */
export interface AppUIApi {
  /** The layout on screen (reactive). */
  layout: () => Layout | null;
  /** Shows a panel: opens its strip, brings its tab to the front. */
  reveal(id: string): void;
  collapse(id: string): void;
  /** Focus mode: every other group goes to a strip until `unfocus`. */
  focus(id: string): void;
  unfocus(): void;
  preset(name: string): void;
  reset(): void;
  expandAll(): void;
  isOpen(id: string): boolean;
  addPanel(p: AppPanel): void;
  removePanel(id: string): void;
  /** Opens the layout menu (under its button). */
  menu(): void;
}

const INSET = 8, STEP = 16;
const ZONES: [C.Side, () => string][] = [["left", () => t`To the left`], ["right", () => t`To the right`], ["top", () => t`To the top`], ["bottom", () => t`To the bottom`]];
const same = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);
const coarse = (): boolean => typeof matchMedia === "function" && matchMedia("(pointer: coarse)").matches;
const geoOpts = (): Partial<C.Metrics> => (coarse() ? { strip: 36, gap: 10 } : {});
function place(e: HTMLElement, r: Rect): void { const s = e.style; s.left = `${r.x}px`; s.top = `${r.y}px`; s.width = `${r.w}px`; s.height = `${r.h}px`; }
const el = (cls: string, attrs: Record<string, unknown> = {}, ...kids: unknown[]): HTMLElement => h("div", { class: cls, ...attrs }, ...kids) as HTMLElement;

interface MenuItem { label?: string | (() => string); section?: string; disabled?: boolean; check?: boolean; run?: () => void; sub?: () => MenuItem[]; back?: boolean }
interface PanelView { def: AppPanel; el: HTMLElement; tab: HTMLButtonElement; stab: HTMLButtonElement; shown: boolean; dispose: () => void }
interface Frame { group: string; placed: boolean; dispose: () => void; el: HTMLElement; tabs: HTMLElement; menu: HTMLButtonElement; max: HTMLButtonElement; close: HTMLButtonElement }
interface Sep { key: string; info: C.SplitterRect | null; el: HTMLElement; label: string }

function localStore(key: string): AppStorage {
  return { get: (k) => load<unknown>(`${key}:${k}`, null), set: (k, v) => save(`${key}:${k}`, v) };
}

/** The workspace: dockable, collapsible, tabbed panels with ready-made and saved layouts. */
export function AppUI(props: AppUIProps): HTMLElement {
  const defs: AppPanel[] = [];
  const panels = new Map<string, PanelView>(), frames = new Map<string, Frame>(), strips = new Map<string, HTMLElement>(), seps = new Map<string, Sep>();
  const presets = props.presets ?? {};
  const store = typeof props.persist === "string" ? localStore(props.persist) : props.persist ?? null;
  const NARROW = props.narrow ?? 768;
  const shown: Signal<Layout | null> = signal<Layout | null>(null);
  let L: Layout | null = null, phone: Layout | null = null, rects: Rects | null = null, narrow = false, dragged = false;
  let saveT: ReturnType<typeof setTimeout> | undefined, animT: ReturnType<typeof setTimeout> | undefined, focusSaved: Layout | null = null;
  let saved: Record<string, Layout> = {};
  const view = (): Layout | null => (narrow ? phone : L);
  const titleOf = (id: string): string => { const p = panels.get(id); return p ? val(p.def.title) : id; };
  const mins = (): Record<string, readonly [number, number]> => Object.fromEntries(defs.map((d) => [d.id, d.min ?? [120, 80]] as const));
  const fit = (): C.Geo | undefined => (rects ? { area: rects.area, opts: { mins: mins(), ...geoOpts() } } : undefined);
  const presetNames = Object.keys(presets);
  const base = (): Layout | null => {
    if (!defs.length) return null;
    const p = presets[props.preset ?? presetNames[0] ?? ""];
    return C.presetLayout(p, defs) ?? C.addMissing(C.singleLayout([]), defs);
  };

  // ---------------------------------------------------------------- DOM
  const under = el("m-app-under"), over = el("m-app-over");
  const host = el("m-app-host", {}, under, over);
  const layoutBtn = h("button", { type: "button", class: "m-app-layout", "aria-haspopup": "menu", title: () => t`Layout: ready-made and saved layouts, panels`, onClick: () => toggleLayoutMenu() },
    icon(columns), h("span", {}, () => t`Layout`)) as HTMLButtonElement;
  const bar = props.bar === false ? null : el("m-app-bar", {}, props.title ? h("span", { class: "m-app-title" }, () => val(props.title)) : null, h("span", { class: "m-app-fill" }), props.tools ?? null, layoutBtn);
  const root = el(cx("m-app", val(props.class)), {}, bar, host);

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
    const A = { x: INSET, y: INSET, w: Math.max(0, host.clientWidth - 2 * INSET), h: Math.max(0, host.clientHeight - 2 * INSET) };
    rects = C.computeRects(V, A, { mins: mins(), ...geoOpts() });
    const maxId = V.max, head = C.METRICS.header;
    clearTimeout(animT);
    host.classList.toggle("is-anim", anim);
    if (anim) animT = setTimeout(() => host.classList.remove("is-anim"), 240);
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
      paintFrame(f, g, maxId === g.id);
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
      if (!box) { box = el("m-app-strip", { role: "group", "aria-label": t`Collapsed panels` }); over.append(box); strips.set(s.id, box); }
      box.dataset["mode"] = s.mode; box.hidden = !!maxId;
      place(box, s.rect);
      const list = s.panels.map((x) => panels.get(x.panel)?.stab).filter((b): b is HTMLButtonElement => !!b);
      if (list.length !== box.children.length || list.some((b, i) => box!.children[i] !== b)) box.replaceChildren(...list);
    }
    for (const [id, b] of strips) if (!liveS.has(id)) { b.remove(); strips.delete(id); }
    for (const s of rects.splitters) {
      liveK.add(s.key);
      const e = seps.get(s.key) ?? makeSep(s.key);
      e.info = s; e.el.hidden = !!maxId;
      e.el.dataset["axis"] = s.axis;
      place(e.el, s.rect);
      paintSep(e, s, V);
    }
    for (const [k, e] of seps) if (!liveK.has(k)) { e.el.remove(); seps.delete(k); }
  }
  function commit(next: Layout | null, o: { anim?: boolean; save?: boolean } = {}): boolean {
    const cur = view();
    if (!next || next === cur || same(next, cur)) return false;
    if (narrow) phone = next; else { L = next; if (o.save !== false) persist(); }
    shown.set(view());
    render(!!o.anim);
    return true;
  }

  // ---------------------------------------------------------------- header: tabs and buttons
  function paintFrame(f: Frame, g: C.TabsNode, isMax: boolean): void {
    f.group = g.id;
    const list = g.panels.map((id) => panels.get(id)?.tab).filter((b): b is HTMLButtonElement => !!b);
    if (list.length !== f.tabs.children.length || list.some((b, i) => f.tabs.children[i] !== b)) f.tabs.replaceChildren(...list);
    for (const id of g.panels) {
      const tab = panels.get(id)?.tab;
      if (!tab) continue;
      const on = id === g.active;
      tab.setAttribute("aria-selected", String(on));
      tab.tabIndex = on ? 0 : -1;
    }
    const V = view() as Layout;
    f.close.disabled = !C.canCollapse(V, g.id);
    f.max.setAttribute("aria-pressed", String(isMax));
    const m = isMax ? t`Back to its size` : t`Fill the whole area`;
    f.max.title = m; f.max.setAttribute("aria-label", m);
    f.max.replaceChildren(icon(isMax ? restoreIcon : maxIcon) as Node);
  }
  const headBtn = (glyph: unknown, label: () => string, run: () => void): HTMLButtonElement =>
    h("button", { type: "button", class: "m-app-hb", title: label, "aria-label": label, onClick: run }, icon(glyph)) as HTMLButtonElement;
  // frames come and go after start (render runs from events): each gets its own root under the workspace's owner
  const owner = getOwner();
  function makeFrame(id: string): Frame {
    return createRoot((dispose) => buildFrame(id, dispose), owner);
  }
  function buildFrame(id: string, dispose: () => void): Frame {
    const f = { group: id, placed: false, dispose } as Frame;
    f.tabs = el("m-app-tabs", { role: "tablist", "aria-label": t`Panel tabs` });
    f.menu = headBtn(more, () => t`Panel menu`, () => { const g = C.findNode(view() as Layout, f.group) as C.TabsNode; openMenu(f.menu, panelMenu(g.active as string), t`Panel menu`); });
    f.menu.setAttribute("aria-haspopup", "menu");
    f.max = headBtn(maxIcon, () => t`Fill the whole area`, () => toggleMax(f.group));
    f.close = headBtn(closeIcon, () => t`Close (collapses)`, () => collapse(f.group));
    const head = el("m-app-head", {}, f.tabs, f.menu, f.max, f.close);
    f.el = el("m-app-frame", {}, head);
    head.addEventListener("pointerdown", (e) => {
      const tg = e.target as HTMLElement;
      if (e.button !== 0 || narrow || view()?.max || tg.closest(".m-app-hb")) return;
      const tab = tg.closest<HTMLElement>(".m-app-tab");
      armDrag(e, tab ? (tab.dataset["p"] as string) : ((C.findNode(view() as Layout, f.group) as C.TabsNode).active as string), head);
    });
    head.addEventListener("dblclick", (e) => { if (!(e.target as HTMLElement).closest(".m-app-hb") && !narrow) toggleMax(f.group); });
    under.append(f.el);
    frames.set(id, f);
    return f;
  }
  const focusTab = (id: string): void => panels.get(id)?.tab.focus();
  const focusStrip = (id: string): void => panels.get(id)?.stab.focus();
  const activate = (id: string): void => { commit(C.setActive(view() as Layout, id)); };
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
    commit(C.restoreGroup(V as Layout, g.id, id, fit()), { anim: true });
    focusTab(id);
  }
  const toggleMax = (gid: string): void => { commit(C.maximize(view() as Layout, gid), { anim: true }); };
  const moveWithFocus = (next: Layout, id: string): void => { commit(next, { anim: true }); focusTab(id); };
  function tabKey(e: KeyboardEvent, id: string): void {
    const V = view() as Layout, g = C.groupOf(V, id);
    if (!g) return;
    const i = g.panels.indexOf(id), last = g.panels.length - 1;
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === "ArrowLeft" || e.key === "ArrowRight")) {
      e.preventDefault();
      const j = e.key === "ArrowLeft" ? i - 1 : i + 1;
      if (j >= 0 && j <= last && L) moveWithFocus(C.moveTab(V, id, j), id);
      return;
    }
    const go = ({ ArrowLeft: i ? i - 1 : last, ArrowRight: i === last ? 0 : i + 1, Home: 0, End: last } as Record<string, number>)[e.key];
    if (go !== undefined) { e.preventDefault(); const to = g.panels[go] as string; activate(to); focusTab(to); return; }
    if (e.key === "Delete" && !narrow) { e.preventDefault(); collapse(g.id); return; }
    if (e.key === "ContextMenu" || (e.shiftKey && e.key === "F10")) { e.preventDefault(); openMenu(panels.get(id)?.tab ?? null, panelMenu(id), t`Panel menu`); }
  }

  // ---------------------------------------------------------------- splitters
  function paintSep(e: Sep, s: C.SplitterRect, V: Layout): void {
    const node = C.findNode(V, s.split) as C.SplitNode, info = (rects as Rects).splits[s.split] as C.SplitInfo;
    const pa = info.px[s.a] as number, pb = info.px[s.b] as number;
    const nm = (k: C.LayoutNode): string => titleOf((C.groups(k)[0] as C.TabsNode).active ?? "");
    const label = `${nm(node.kids[s.a] as C.LayoutNode)} / ${nm(node.kids[s.b] as C.LayoutNode)}`;
    if (e.label !== label) { e.label = label; e.el.setAttribute("aria-label", `${t`Splitter`}: ${label}`); }
    e.el.setAttribute("aria-orientation", s.axis === "row" ? "vertical" : "horizontal");
    e.el.setAttribute("aria-valuenow", String(Math.round((pa / Math.max(1, pa + pb)) * 100)));
  }
  function makeSep(key: string): Sep {
    const e: Sep = { key, info: null, label: "", el: el("m-app-sep", { role: "separator", tabindex: "0", "aria-valuemin": "0", "aria-valuemax": "100", title: t`Drag: resize · Double click: equalize · Arrows: keyboard` }) };
    e.el.addEventListener("pointerdown", (ev) => {
      if (ev.button !== 0 || !L || !rects || !e.info) return;
      ev.preventDefault();
      e.el.focus({ preventScroll: true });
      const s = e.info, start = L, startR = rects, from = s.axis === "row" ? ev.clientX : ev.clientY;
      e.el.setPointerCapture(ev.pointerId);
      shield(true, s.axis === "row" ? "col-resize" : "row-resize");
      // pointer moves arrive once per frame already (the browser coalesces them): resize on each
      const move = (m: PointerEvent): void => {
        const n = C.resizeSplit(start, s.split, s.a, s.b, (s.axis === "row" ? m.clientX : m.clientY) - from, startR);
        if (n !== L) { L = n; shown.set(L); render(); }
      };
      const up = (): void => {
        shield(false);
        e.el.removeEventListener("pointermove", move); e.el.removeEventListener("pointerup", up); e.el.removeEventListener("pointercancel", up);
        persist();
      };
      e.el.addEventListener("pointermove", move); e.el.addEventListener("pointerup", up); e.el.addEventListener("pointercancel", up);
    });
    e.el.addEventListener("dblclick", () => { if (L && e.info) commit(C.equalize(L, e.info.split), { anim: true }); });
    e.el.addEventListener("keydown", (ev) => {
      const s = e.info;
      if (!s || !L || !rects) return;
      const horiz = s.axis === "row", sign = ({ ArrowLeft: horiz ? -1 : 0, ArrowRight: horiz ? 1 : 0, ArrowUp: horiz ? 0 : -1, ArrowDown: horiz ? 0 : 1 } as Record<string, number>)[ev.key];
      if (ev.key === "Enter") { ev.preventDefault(); commit(C.equalize(L, s.split), { anim: true }); return; }
      if (ev.key === "Home" || ev.key === "End") { ev.preventDefault(); commit(C.resizeSplit(L, s.split, s.a, s.b, ev.key === "Home" ? -1e5 : 1e5, rects)); return; }
      if (!sign) return;
      ev.preventDefault();
      commit(C.resizeSplit(L, s.split, s.a, s.b, sign * (ev.shiftKey ? STEP * 4 : STEP), rects));
    });
    over.append(e.el);
    seps.set(key, e);
    return e;
  }

  // ---------------------------------------------------------------- drag and drop
  let shieldEl: HTMLElement | null = null;
  /** A clear shield over the page while dragging, so iframes do not swallow the pointer. */
  function shield(on: boolean, cursor = ""): void {
    root.classList.toggle("is-dragging", on);
    if (on) { shieldEl ??= el("m-app-shield"); shieldEl.style.cursor = cursor; root.append(shieldEl); } else shieldEl?.remove();
  }
  function armDrag(e: PointerEvent, id: string, source: HTMLElement): void {
    if (narrow || !id) return;
    const sx = e.clientX, sy = e.clientY, pid = e.pointerId;
    let on = false, hit: Hit | null = null, idx: number | null = null;
    const ghost = el("m-app-ghost", {}, titleOf(id));
    const preview = el("m-app-preview"), zones = el("m-app-zones"), mark = el("m-app-insert");
    for (const z of ["left", "right", "top", "bottom", "center"]) zones.append(el("m-app-zone", { "data-z": z }));
    const paint = (x: number, y: number): void => {
      ghost.style.left = `${x + 12}px`; ghost.style.top = `${y + 12}px`;
      const b = host.getBoundingClientRect();
      hit = rects ? C.hitTest(rects, x - b.left, y - b.top, geoOpts()) : null;
      preview.hidden = !hit; zones.hidden = true; mark.hidden = true; idx = null;
      if (!hit || !rects) return;
      place(preview, hit.rect);
      const box = rects.groups[hit.target];
      if (hit.onTabs) {
        const f = frames.get(hit.target);
        const kids = f ? [...f.tabs.children] as HTMLElement[] : [];
        if (!kids.length) return;
        const at = kids.findIndex((k) => { const r = k.getBoundingClientRect(); return x < r.left + r.width / 2; });
        idx = at < 0 ? kids.length : at;
        const r = (kids[at] ?? kids[kids.length - 1] as HTMLElement).getBoundingClientRect();
        mark.hidden = false; place(mark, { x: (at < 0 ? r.right : r.left) - b.left - 1, y: r.top - b.top, w: 3, h: r.height });
      } else if (box) {
        zones.hidden = false;
        const zr = C.zoneRects(box);
        for (const c of zones.children as unknown as HTMLElement[]) { const z = c.dataset["z"] as Zone; place(c, zr[z]); c.classList.toggle("is-on", z === hit.zone); }
      }
    };
    const move = (m: PointerEvent): void => {
      if (!on) {
        if (Math.hypot(m.clientX - sx, m.clientY - sy) < 6) return;
        on = true; dragged = true;
        closeMenu();
        try { source.setPointerCapture(pid); } catch { /* the pointer is gone */ }
        shield(true, "grabbing");
        root.append(ghost); over.append(zones, preview, mark);
      }
      paint(m.clientX, m.clientY);
    };
    const stop = (drop: boolean): void => {
      removeEventListener("pointermove", move); removeEventListener("pointerup", up); removeEventListener("pointercancel", cancel); removeEventListener("keydown", key, true);
      if (!on) return;
      shield(false); ghost.remove(); zones.remove(); preview.remove(); mark.remove();
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

  // ---------------------------------------------------------------- menu (mouse, touch, keyboard)
  let menu: { box: HTMLElement; anchor: HTMLElement | null; onDoc: (e: Event) => void } | null = null;
  function closeMenu(refocus = false): void {
    if (!menu) return;
    const { box, anchor, onDoc } = menu;
    menu = null;
    box.remove();
    document.removeEventListener("pointerdown", onDoc, true);
    if (refocus) anchor?.focus();
  }
  function openMenu(anchor: HTMLElement | null, items: MenuItem[], title: string): void {
    closeMenu();
    const box = el("m-app-menu", { role: "menu", "aria-label": title });
    const stack: MenuItem[][] = [];
    let current = items;
    const list = (): HTMLButtonElement[] => [...box.querySelectorAll<HTMLButtonElement>(".m-app-mi:not(:disabled)")];
    const focusAt = (i: number): void => { const l = list(); l[(i + l.length) % l.length]?.focus(); };
    const label = (it: MenuItem): string => (typeof it.label === "function" ? it.label() : it.label ?? "");
    const row = (it: MenuItem): HTMLElement => {
      const b = h("button", {
        type: "button", class: "m-app-mi", role: it.check === undefined ? "menuitem" : "menuitemcheckbox", tabindex: "-1", disabled: !!it.disabled,
        "aria-haspopup": it.sub ? "menu" : undefined, "aria-checked": it.check === undefined ? undefined : String(it.check), "data-sub": it.sub ? "1" : undefined,
        onClick: () => {
          if (it.back) { show(stack.pop() as MenuItem[]); return; }
          if (it.sub) { stack.push(current); show(it.sub()); return; }
          closeMenu(true);
          it.run?.();
        },
      }, h("span", { class: "m-app-mil" }, it.back ? `‹ ${label(it)}` : label(it)), h("span", { class: "m-app-mik", "aria-hidden": "true" }, it.sub ? "›" : it.check ? "✓" : "")) as HTMLElement;
      return b;
    };
    const position = (): void => {
      const a = anchor?.getBoundingClientRect() ?? { left: 8, bottom: 8 }, w = box.offsetWidth, hh = box.offsetHeight;
      box.style.left = `${clamp(a.left, 8, innerWidth - w - 8)}px`;
      box.style.top = `${clamp(a.bottom + 4, 8, innerHeight - hh - 8)}px`;
    };
    const show = (l: MenuItem[]): void => {
      current = l;
      const rows: HTMLElement[] = [];
      if (stack.length) rows.push(row({ label: t`Back`, back: true }));
      for (const it of l) rows.push(it.section ? el("m-app-msec", { role: "presentation" }, it.section) : row(it));
      box.replaceChildren(...rows);
      position();
      focusAt(0);
    };
    box.addEventListener("keydown", (e) => {
      const l = list(), i = l.indexOf(document.activeElement as HTMLButtonElement), cur = document.activeElement as HTMLElement | null;
      if (e.key === "ArrowDown") { e.preventDefault(); focusAt(i + 1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); focusAt(i - 1); }
      else if (e.key === "Home") { e.preventDefault(); focusAt(0); }
      else if (e.key === "End") { e.preventDefault(); focusAt(-1); }
      else if (e.key === "ArrowRight" && cur?.dataset["sub"]) { e.preventDefault(); cur.click(); }
      else if ((e.key === "ArrowLeft" || e.key === "Escape") && stack.length) { e.preventDefault(); e.stopPropagation(); show(stack.pop() as MenuItem[]); }
      else if (e.key === "Escape" || e.key === "Tab") { e.preventDefault(); closeMenu(true); }
    });
    const onDoc = (e: Event): void => { if (!box.contains(e.target as Node) && e.target !== anchor && !anchor?.contains(e.target as Node)) closeMenu(); };
    root.append(box);
    menu = { box, anchor, onDoc };
    document.addEventListener("pointerdown", onDoc, true);
    show(items);
  }
  function moveItems(id: string): MenuItem[] {
    const V = view() as Layout, own = C.groupOf(V, id) as C.TabsNode;
    const zones = (tgt: string): MenuItem[] => ZONES.map(([z, label]) => ({ label, run: () => L && moveWithFocus(C.movePanel(L, id, tgt, z), id) }));
    const items: MenuItem[] = [];
    for (const g of C.groups(V.root)) {
      if (g.id === own.id && g.panels.length === 1) continue;
      items.push({ label: g.panels.map(titleOf).join(" · "), sub: () => [...(g.collapsed ? [] : zones(g.id)), ...(g.id === own.id ? [] : [{ label: () => t`As a tab`, run: () => L && moveWithFocus(C.movePanel(L, id, g.id, "center"), id) }])] });
    }
    items.push({ label: () => t`Workspace edge`, sub: () => zones(C.ROOT) });
    return items;
  }
  function panelMenu(id: string): MenuItem[] {
    const V = view() as Layout, g = C.groupOf(V, id) as C.TabsNode, i = g.panels.indexOf(id), items: MenuItem[] = [];
    if (narrow) return defs.map((d) => ({ label: titleOf(d.id), check: g.active === d.id, run: () => reveal(d.id) }));
    if (g.panels.length > 1) {
      items.push({ label: () => t`Move tab left`, disabled: i === 0, run: () => moveWithFocus(C.moveTab(V, id, i - 1), id) });
      items.push({ label: () => t`Move tab right`, disabled: i === g.panels.length - 1, run: () => moveWithFocus(C.moveTab(V, id, i + 1), id) });
    }
    items.push({ label: () => t`Move`, sub: () => moveItems(id) });
    items.push({ label: () => t`Close (collapses)`, disabled: !C.canCollapse(V, g.id), run: () => collapse(g.id) });
    items.push({ label: () => (V.max === g.id ? t`Back to its size` : t`Fill the whole area`), run: () => toggleMax(g.id) });
    items.push({ label: () => t`Reset this panel`, run: () => { const p = panels.get(id); if (p && L) commit(C.resetPanel(L, p.def, defs), { anim: true }); } });
    items.push({ label: () => t`Reset layout`, run: () => commit(base(), { anim: true }) });
    return items;
  }
  function savedItems(): MenuItem[] {
    const names = Object.keys(saved).sort((a, b) => a.localeCompare(b));
    if (!names.length) return [{ label: () => t`No saved layouts`, disabled: true }];
    return names.map((name) => ({ label: name, sub: () => [
      { label: () => t`Apply`, run: () => commit(C.restoreLayout(saved[name], defs) ?? base(), { anim: true }) },
      { label: () => t`Save over it`, run: () => { if (L) { saved[name] = C.serialize(L); writeSaved(); } } },
      { label: () => t`Delete`, run: () => { delete saved[name]; writeSaved(); } },
    ] }));
  }
  function layoutMenu(): MenuItem[] {
    const V = view();
    const isOpen = (id: string): boolean => { const g = V && C.groupOf(V, id); return !!g && !g.collapsed && g.active === id; };
    const list: MenuItem = { label: () => t`Panels`, sub: () => defs.map((d) => ({ label: titleOf(d.id), check: isOpen(d.id), run: () => togglePanel(d.id) })) };
    if (narrow) return [list];
    return [
      ...(presetNames.length ? [{ section: t`Ready-made layouts` }, ...presetNames.map((k) => ({ label: (presets[k] as Preset).title, run: () => commit(C.presetLayout(presets[k], defs), { anim: true }) }))] : []),
      { section: t`Saved layouts` },
      { label: () => t`Saved layouts`, sub: savedItems },
      { label: () => t`Save this layout`, run: saveAs },
      { section: t`Panels` },
      list,
      { label: () => t`Open all panels`, run: () => L && commit(C.expandAll(L), { anim: true }) },
      { label: () => t`Reset to default`, run: () => commit(base(), { anim: true }) },
    ];
  }
  function toggleLayoutMenu(): void { if (menu?.anchor === layoutBtn) closeMenu(true); else openMenu(layoutBtn, layoutMenu(), t`Layout`); }
  function togglePanel(id: string): void {
    const V = view(), g = V && C.groupOf(V, id);
    if (!g) return;
    if (narrow || g.collapsed || g.active !== id) { reveal(id); focusTab(id); } else collapse(g.id);
  }
  function saveAs(): void {
    if (!L) return;
    let n = 1;
    while (saved[`${t`Layout`} ${n}`]) n++;
    saved[`${t`Layout`} ${n}`] = C.serialize(L);
    writeSaved();
  }

  // ---------------------------------------------------------------- persistence
  const writeSaved = (): void => { void Promise.resolve(store?.set("saved", saved)).catch(() => undefined); };
  function persist(now = false): void {
    clearTimeout(saveT);
    const write = (): void => { if (L && store && !focusSaved) void Promise.resolve(store.set("layout", C.serialize(L))).catch(() => undefined); };
    if (now) write(); else saveT = setTimeout(write, 250);
  }

  // ---------------------------------------------------------------- panels
  function addPanel(def: AppPanel): void {
    if (panels.has(def.id)) return;
    defs.push(def);
    createRoot((dispose) => {
      const pid = `m-app-p-${def.id}`, tid = `m-app-t-${def.id}`;
      const body = el("m-app-panel is-hidden is-snap", { id: pid, role: "tabpanel", "aria-labelledby": tid }, def.content());
      const tab = h("button", {
        type: "button", class: "m-app-tab", role: "tab", id: tid, "aria-controls": pid, "data-p": def.id,
        onClick: () => { if (!dragged) activate(def.id); }, onKeyDown: (k: KeyboardEvent) => tabKey(k, def.id),
        onContextMenu: (c: MouseEvent) => { if (narrow) return; c.preventDefault(); openMenu(tab, panelMenu(def.id), t`Panel menu`); },
      }, icon(def.icon), h("span", { class: "m-app-tl" }, () => val(def.title))) as HTMLButtonElement;
      const stab = h("button", {
        type: "button", class: "m-app-stab", "aria-expanded": "false", title: () => `${val(def.title)} · ${t`Open panel`}`,
        onClick: () => { if (!dragged) restore(def.id); },
        onPointerDown: (p: PointerEvent) => { if (p.button === 0) armDrag(p, def.id, stab); },
        onContextMenu: (c: MouseEvent) => { c.preventDefault(); openMenu(stab, panelMenu(def.id), t`Panel menu`); },
      }, icon(def.icon), h("span", { class: "m-app-stl" }, () => val(def.title))) as HTMLButtonElement;
      over.before(body);
      panels.set(def.id, { def, el: body, tab, stab, shown: false, dispose });
    }, owner);
    if (started) {
      L = L ? C.addMissing(L, defs) : base();
      if (narrow) phone = C.singleLayout(defs, phone?.root.t === "tabs" ? phone.root.active : def.id);
      shown.set(view());
      render();
    }
  }
  function removePanel(id: string): void {
    const p = panels.get(id);
    if (!p) return;
    panels.delete(id);
    defs.splice(defs.findIndex((d) => d.id === id), 1);
    p.tab.remove(); p.stab.remove(); p.el.remove(); p.dispose();
    L = L ? C.restoreLayout(C.serialize(L), defs) ?? base() : base();
    if (narrow) phone = L ? C.singleLayout(defs, phone?.root.t === "tabs" ? phone.root.active : null) : null;
    shown.set(view());
    render();
  }
  function reveal(id: string): void {
    if (!panels.has(id) || !view()) return;
    commit(narrow ? C.setActive(view() as Layout, id) : C.reveal(L as Layout, id, fit()), { anim: !narrow });
    if (narrow) panels.get(id)?.tab.scrollIntoView({ block: "nearest", inline: "nearest" });
  }
  function syncNarrow(): void {
    const n = host.clientWidth > 0 && host.clientWidth < NARROW;
    if (n === narrow) return;
    closeMenu();
    narrow = n;
    root.classList.toggle("is-narrow", n);
    if (n && L) { const open = C.groups(L.root).find((g) => !g.collapsed); phone = C.singleLayout(defs, open?.active); }
    shown.set(view());
  }

  // ---------------------------------------------------------------- start
  let started = false;
  for (const p of props.panels) addPanel(p);
  started = true;
  L = base();
  shown.set(L);
  root.classList.add("is-pending");
  void (async () => {
    try {
      const raw = await store?.get("layout");
      const got = raw ? C.restoreLayout(raw, defs) : null;
      if (got) { L = got; if (!narrow) shown.set(L); render(); }
      saved = ((await store?.get("saved")) as Record<string, Layout> | null) ?? {};
    } catch { /* no storage: the default stays */ }
    root.classList.remove("is-pending");
  })();
  const stopSize = observeSize(host, () => { syncNarrow(); render(); });
  const onHide = (): void => { if (saveT) persist(true); };
  addEventListener("pagehide", onHide);
  onCleanup(() => {
    stopSize(); closeMenu(); shield(false); removeEventListener("pagehide", onHide); onHide();
    for (const p of panels.values()) p.dispose();
  });

  props.api?.({
    layout: () => shown(),
    reveal: (id) => { reveal(id); focusTab(id); },
    collapse: (id) => { const g = view() && C.groupOf(view() as Layout, id); if (g) collapse(g.id); },
    focus: (id) => {
      if (!panels.has(id)) return;
      if (narrow) { reveal(id); return; }
      if (focusSaved || !L) return;
      focusSaved = L;
      commit(C.focusOnly(L, id, fit()), { anim: true, save: false });
    },
    unfocus: () => { if (!focusSaved) return; const back = focusSaved; focusSaved = null; commit(C.normalize(back), { anim: true }); },
    preset: (name) => commit(C.presetLayout(presets[name], defs) ?? base(), { anim: true }),
    reset: () => commit(base(), { anim: true }),
    expandAll: () => { if (L) commit(C.expandAll(L), { anim: true }); },
    isOpen: (id) => { const g = view() && C.groupOf(view() as Layout, id); return !!g && !g.collapsed; },
    addPanel, removePanel,
    menu: () => openMenu(layoutBtn, layoutMenu(), t`Layout`),
  });
  return root;
}
