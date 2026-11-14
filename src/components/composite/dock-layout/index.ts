// DockLayout (hadi-march/ui): an IDE workspace. Split areas holding tab groups; drag a tab to a side of a group (a new
// split), onto its centre or between tabs (a tab), to an edge of the whole layout, or out of it (a floating window).
// Groups can be maximized, panels minimized to the tray, the layout saved and loaded (any storage with get / set: the
// Storage manager's areas fit). Keyboard: F6 between groups, Alt+Shift+arrows dock the focused tab to a side,
// Alt+Shift+Enter maximize, Alt+Shift+F float, Alt+Shift+M minimize, Delete close. Right-to-left aware throughout.
//
// Built from Splitter (every split), Tabs (every group: icon, title, badge, "changed" dot, close mark, actions),
// IconButton, ResizeHandle, Toolbar, Button, Empty, the drag behavior (pointerDrag, dragGhost, arrowStep) and Portal: each panel's content renders once into a Portal
// and moves between groups without being rebuilt, so editors keep their state while the layout changes.
import "./dock-layout.css";
import { signal, computed, effect, untrack, createRoot, getOwner, onCleanup, reactive } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { Portal, PortalTarget } from "../../../dom/portal.ts";
import { t, messages } from "../../../core/i18n.ts";
import { val, cx, uid, icon, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { clamp, setStyle, debounce, load, save, doc } from "../../../core/util.ts";
import { ownIcon, hasPart } from "../../../ui/parts.ts";
import { observeSize } from "../../../ui/observe.ts";
import { isRtl } from "../../../ui/focus.ts";
import { Splitter } from "../../../ui/splitter.ts";
import { Tabs, type TabSpec, type TabsProps } from "../../navigation/tabs/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { Button } from "../../actions/button/index.ts";
import { Empty } from "../../feedback/empty/index.ts";
import { Toolbar } from "../../layout/stack/index.ts";
import { ResizeHandle } from "../../layout/resize-handle/index.ts";
import { OverflowText } from "../../typography/overflow-text/index.ts";
import { pointerDrag, arrowStep } from "../../../behaviors/drag/index.ts";
import { dragGhost, type DragGhost } from "../../../behaviors/drag/ghost.ts";
import { announce } from "../../../managers/announcer/index.ts";
import { animate } from "../../../motion/animate.ts";
import { still as motionOff } from "../../../motion/engine/parts.ts";
import type { IconDef } from "../../../icons/svg.ts";
import { command } from "../../../managers/command/index.ts";
import { maximize as maxIcon } from "../../../icons/glyphs/maximize.ts";
import { minimize as restoreIcon } from "../../../icons/glyphs/minimize.ts";
import { minus } from "../../../icons/glyphs/minus.ts";
import { appWindow } from "../../../icons/glyphs/appWindow.ts";
import { layers } from "../../../icons/glyphs/layers.ts";
import {
  type DockState, type DockNode, type DockGroupNode, type DockZone, type DockSide, type DockSpec,
  groups, findGroup, groupOf, isFloating, placed, removePanel, insertPanel, floatPanel, minimizePanel, restorePanel,
  activate, sanitize, fromSpec, emptyState,
} from "./model.ts";
import tr from "./tr.ts";

messages("tr", tr);
export type { DockState, DockNode, DockGroupNode, DockSplitNode, DockFloating, DockMinimized, DockZone, DockSide, DockSpec } from "./model.ts";

/** A panel the layout can show. `content` runs once, the first time the panel is shown, and is kept while it moves. */
export interface DockPanel {
  id: string;
  title: MaybeFn<string>;
  icon?: unknown;
  content: () => unknown;
  /** Show the close button / allow Delete (default true). */
  closable?: boolean;
  badge?: MaybeFn<number | null | undefined>;
  /** Unsaved changes: a dot on the tab. */
  dirty?: MaybeFn<boolean | null | undefined>;
}
/** Where a layout is saved: any object with get / set (sync or async). The Storage manager's areas fit. */
export interface DockStorage { get(key: string): unknown; set(key: string, value: unknown): unknown }

/** Imperative control (`api={(a) => dock = a}`). Panel ids address panels; `target` may also be a group id or "@root". */
export interface DockApi {
  /** The current layout (reactive); save it as JSON. */
  state: () => DockState;
  load(state: DockState | DockSpec): void;
  /** Back to the `layout` prop. */
  reset(): void;
  /** Show a panel: activate it, restore it from the tray, or add it next to `near` (a panel id) / to the first group. */
  open(panel: string, near?: string): void;
  close(panel: string): void;
  focus(panel: string): void;
  move(panel: string, target: string, zone: DockZone, index?: number): void;
  float(panel: string): void;
  dock(panel: string): void;
  minimize(panel: string): void;
  restore(panel: string): void;
  toggleMaximize(panel?: string): void;
  /** The active panel of the focused group (reactive). */
  active: () => string | null;
}

export interface DockLayoutProps {
  panels: MaybeFn<readonly DockPanel[]>;
  /** Initial layout: `["a", "b"]` one group, `{ row: [["files"], { column: [["editor"], ["console"]], share: .7 }], share: .25 }`. Default: every panel in one group. */
  layout?: DockSpec;
  /** Save the layout under this key (and load it on start). */
  persist?: string;
  /** Where to save it (default localStorage). `storage().local` from the Storage manager works. */
  storage?: DockStorage;
  /** Accessible name of the workspace. */
  label?: MaybeFn<string | undefined>;
  /** Command id prefix for the palette (default "dock"); false: register no commands. */
  commands?: string | false;
  api?: (api: DockApi) => void;
  onChange?: (state: DockState) => void;
  /** Return false to keep the panel (e.g. after asking about unsaved changes). */
  onClose?: (panel: string) => boolean | void | Promise<boolean | void>;
  /** The buttons of a group: true (default), false, or the ones to keep. The keyboard paths and `api` stay. */
  actions?: boolean | readonly ("maximize" | "float" | "minimize")[] | undefined;
  /** The tray of minimized panels (default true). With false, bring panels back yourself: `api.restore(panel)`. */
  tray?: boolean | undefined;
  /** What a layout without panels shows: true (default: a text and Reset layout), false, or `(reset) => node`. */
  empty?: boolean | ((reset: () => void) => unknown) | undefined;
  /** Own icons: an icon, a string, or `() => node` (called for every button it is drawn in) each. */
  icons?: { close?: unknown; maximize?: unknown; restore?: unknown; float?: unknown; dock?: unknown; minimize?: unknown } | undefined;
  /** The pop of a group after a drop, the maximize transition and the fade-in of the drag ghost (default true). */
  motion?: boolean | undefined;
  /**
   * Own texts; each falls back to the built-in one: `workspace` (role description), `panels` (a group's tab list),
   * `tray`, the buttons (`close`, `maximize`, `restore`, `float`, `dock`, `minimize`, `moveWindow`, `resizeWindow`),
   * `unsaved`, the empty state (`empty`, `reset`), `group(title)` and what is announced: `moved(title, zone)`,
   * `minimized(title)`, `closed(title)`, `layoutReset`.
   */
  labels?: {
    workspace?: string; panels?: string; tray?: string; close?: string; maximize?: string; restore?: string; float?: string; dock?: string;
    minimize?: string; moveWindow?: string; resizeWindow?: string; unsaved?: string; empty?: string; reset?: string; layoutReset?: string;
    group?: (title: string) => string;
    moved?: (title: string, zone: DockZone | "float") => string;
    minimized?: (title: string) => string;
    closed?: (title: string) => string;
  } | undefined;
  class?: ClassProp;
}

interface Drop { target: string; zone: DockZone | "float"; index?: number; rect: { x: number; y: number; w: number; h: number } }
const EDGE = 20;

/** `<DockLayout panels={panels} layout={{ row: [["files"], ["editor"]], share: .25 }} persist="ide" />` */
export function DockLayout(props: DockLayoutProps): Element {
  const base = uid("m-dock");
  const prefix = props.commands === false ? null : (props.commands ?? "dock");
  const panelList = computed(() => val(props.panels) ?? []);
  const panelMap = computed(() => new Map(panelList().map((p) => [p.id, p])));
  const panel = (id: string): DockPanel | undefined => untrack(panelMap).get(id);
  const known = (id: string): boolean => untrack(panelMap).has(id);
  const initial = (): DockState => {
    const spec = props.layout ?? untrack(panelList).map((p) => p.id);
    return sanitize(fromSpec(spec), known) ?? emptyState();
  };
  const state = signal<DockState>(initial(), { name: "dock.state", equals: false });
  // the tree is rebuilt only when its shape changes (not for the active tab, a split share or a window position)
  const shapeOf = (s: DockState): string => {
    const n = (x: DockNode | null): string => !x ? "" : x.type === "group" ? `${x.id}[${x.panels.join(",")}]` : `${x.dir}(${n(x.a)}|${n(x.b)})`;
    return `${n(s.root)}#${s.floating.map((f) => `${f.group.id}[${f.group.panels.join(",")}]`).sort().join(";")}#${s.minimized.map((m) => m.panel).join(",")}`;
  };
  const shape = computed(() => shapeOf(state()));
  const focused = signal<string | null>(null);
  // narrow (a phone): side-by-side splits stack, so nothing is squeezed
  const narrow = signal(false);
  let root: HTMLElement | undefined;
  const owner = getOwner();
  const L = (): NonNullable<DockLayoutProps["labels"]> => props.labels ?? {};
  const still = (): boolean => motionOff(() => props.motion);
  const shows = (k: "maximize" | "float" | "minimize"): boolean => hasPart(props.actions, k);
  type IconKey = keyof NonNullable<DockLayoutProps["icons"]>;
  const ico = (k: IconKey, def: IconDef): unknown => ownIcon(props.icons?.[k], def, "m-dock-own");

  // ---------------------------------------------------------------- persistence
  const storage: DockStorage | null = props.persist ? (props.storage ?? { get: (k) => load<unknown>(k, null), set: (k, v) => save(k, v) }) : null;
  const persist = debounce(() => { if (storage && props.persist) void storage.set(props.persist, untrack(state)); }, 250);
  if (storage && props.persist) {
    const apply = (v: unknown): void => { const s = sanitize(v, known); if (s && (s.root || s.floating.length)) state.set(s); };
    const got = storage.get(props.persist);
    if (got && typeof (got as Promise<unknown>).then === "function") void (got as Promise<unknown>).then(apply, () => {}); else apply(got);
  }
  const commit = (next: DockState): void => { if (next === untrack(state)) return; state.set(next); persist(); props.onChange?.(next); };
  const touch = (): void => { persist(); props.onChange?.(untrack(state)); };

  // ---------------------------------------------------------------- panel contents (one Portal each, made on first show)
  const hosts = new Map<string, () => void>();
  const target = (pid: string): string => `${base}-${pid}`;
  const ensureHost = (pid: string): void => {
    if (hosts.has(pid)) return;
    const p = panel(pid);
    if (!p) return;
    createRoot((dispose) => { hosts.set(pid, dispose); h(Portal, { to: target(pid), children: untrack(() => p.content()) }); }, owner);
  };
  // a panel removed from `panels` goes with its content
  effect(() => { const ids = new Set(panelList().map((p) => p.id)); untrack(() => { for (const [id, off] of hosts) if (!ids.has(id)) { off(); hosts.delete(id); } }); });
  onCleanup(() => { for (const off of hosts.values()) off(); hosts.clear(); });

  // ---------------------------------------------------------------- operations
  const groupEl = (gid: string): HTMLElement | null => root?.querySelector<HTMLElement>(`[data-dock-group="${gid}"]`) ?? null;
  const tabEl = (pid: string): HTMLElement | null => root?.querySelector<HTMLElement>(`[data-dock-group] [role="tab"][data-tab="${globalThis.CSS?.escape?.(pid) ?? pid}"]`) ?? null;
  const say = (msg: string): void => announce(msg);
  const titleOf = (pid: string): string => val(panel(pid)?.title) ?? pid;
  const afterRender = (fn: () => void): void => { queueMicrotask(() => queueMicrotask(fn)); };
  const pop = (pid: string, focus = false): void => afterRender(() => {
    const el = tabEl(pid)?.closest<HTMLElement>("[data-dock-group]");
    if (el && !still()) animate(el, [{ opacity: 0.4, transform: "scale(.97)" }, { opacity: 1, transform: "none" }], { duration: 220, easing: "easeOutCubic" });
    if (focus) tabEl(pid)?.focus();
  });
  const sideName = (z: DockZone | "float"): string => ({ start: t`start`, end: t`end`, top: t`top`, bottom: t`bottom`, center: t`tab`, float: t`floating` })[z];

  const move = (pid: string, tgt: string, zone: DockZone, index?: number, focus = false): void => {
    const s = untrack(state);
    const g = findGroup(s, tgt) ?? groupOf(s, tgt);
    commit(insertPanel(s, pid, tgt === "@root" ? "@root" : g?.id ?? "@root", zone, index));
    say(L().moved?.(titleOf(pid), zone) ?? t`${titleOf(pid)} moved: ${sideName(zone)}`);
    pop(pid, focus);
  };
  const defaultRect = (): { x: number; y: number; w: number; h: number } => {
    const r = root?.getBoundingClientRect();
    const w = Math.min(360, (r?.width ?? 600) * 0.6), hh = Math.min(260, (r?.height ?? 400) * 0.6);
    const n = untrack(state).floating.length;
    return { x: Math.max(8, ((r?.width ?? 600) - w) / 2 + n * 24), y: Math.max(8, ((r?.height ?? 400) - hh) / 2 + n * 24), w, h: hh };
  };
  const float = (pid: string, rect = defaultRect()): void => { commit(floatPanel(untrack(state), pid, clampRect(rect))); say(L().moved?.(titleOf(pid), "float") ?? t`${titleOf(pid)} moved: ${sideName("float")}`); pop(pid, true); };
  const dockBack = (pid: string): void => move(pid, "@root", "end", undefined, true);
  const minimize = (pid: string): void => { commit(minimizePanel(untrack(state), pid)); say(L().minimized?.(titleOf(pid)) ?? t`${titleOf(pid)} minimized`); };
  const restore = (pid: string): void => { commit(restorePanel(untrack(state), pid)); pop(pid, true); };
  const focusPanel = (pid: string): void => { commit(activate(untrack(state), pid)); afterRender(() => tabEl(pid)?.focus()); };
  const open = (pid: string, near?: string): void => {
    const s = untrack(state);
    if (s.minimized.some((m) => m.panel === pid)) return restore(pid);
    if (groupOf(s, pid)) return focusPanel(pid);
    const g = (near && groupOf(s, near)) || (focused.peek() && findGroup(s, focused.peek()!)) || groups(s)[0];
    commit(insertPanel(s, pid, g?.id ?? "@root", "center"));
    pop(pid, false);
  };
  const close = async (pid: string): Promise<void> => {
    if (panel(pid)?.closable === false) return;
    if ((await props.onClose?.(pid)) === false) return;
    const g = groupOf(untrack(state), pid);
    commit(removePanel(untrack(state), pid));
    say(L().closed?.(titleOf(pid)) ?? t`${titleOf(pid)} closed`);
    const next = g && findGroup(untrack(state), g.id)?.active;
    if (next) afterRender(() => tabEl(next)?.focus());
  };
  const toggleMaximize = (pid?: string): void => {
    const s = untrack(state);
    const gid = pid ? groupOf(s, pid)?.id : focused.peek() ?? groups(s)[0]?.id;
    if (!gid || isFloating(s, gid)) return;
    const el = groupEl(gid);
    const first = el?.getBoundingClientRect();
    commit({ ...s, maximized: s.maximized === gid ? null : gid });
    // FLIP: grow from where the group was (or shrink back into place)
    if (el && first && !still()) {
      const last = el.getBoundingClientRect();
      if (last.width && last.height) {
        const rtl = isRtl(el);
        const dx = rtl ? first.right - last.right : first.left - last.left, dy = first.top - last.top;
        setStyle(el, { "transform-origin": rtl ? "top right" : "top left" });
        animate(el, [{ transform: `translate(${dx}px, ${dy}px) scale(${first.width / last.width}, ${first.height / last.height})` }, { transform: "none" }], { duration: 280, easing: "easeOutCubic" });
      }
    }
  };
  const current = computed((): string | null => { const s = state(); const g = (focused() && findGroup(s, focused()!)) || groups(s)[0]; return g?.active ?? null; });
  const reset = (): void => { commit(initial()); say(L().layoutReset ?? t`Layout reset`); };

  // ---------------------------------------------------------------- floating windows
  function clampRect(r: { x: number; y: number; w: number; h: number }): { x: number; y: number; w: number; h: number } {
    const box = root?.getBoundingClientRect();
    if (!box || !box.width) return r;
    const w = clamp(r.w, 180, Math.max(180, box.width - 8)), hh = clamp(r.h, 120, Math.max(120, box.height - 8));
    return { x: clamp(r.x, 0, Math.max(0, box.width - w)), y: clamp(r.y, 0, Math.max(0, box.height - hh)), w, h: hh };
  }
  const floatOf = (gid: string): { x: number; y: number; w: number; h: number } | undefined => state().floating.find((f) => f.group.id === gid);
  const raise = (gid: string): void => {
    const s = untrack(state), i = s.floating.findIndex((f) => f.group.id === gid);
    if (i < 0 || i === s.floating.length - 1) return;
    const f = s.floating.splice(i, 1)[0]!; s.floating.push(f); state.set(s);
  };
  // move or resize a floating window: pointer, or the arrow keys on its grip / corner (10 px, Shift: 40 px)
  type Rect = { x: number; y: number; w: number; h: number };
  const setRect = (gid: string, next: (r: Rect) => Rect, from?: Rect): void => {
    const f = untrack(state).floating.find((x) => x.group.id === gid);
    if (!f) return;
    Object.assign(f, clampRect(next(from ?? { x: f.x, y: f.y, w: f.w, h: f.h })));
    state.set(untrack(state));
  };
  const nudge = (mode: "move" | "size", dx: number, dy: number) => (r: Rect): Rect =>
    (mode === "move" ? { ...r, x: r.x + dx, y: r.y + dy } : { ...r, w: r.w + dx, h: r.h + dy });
  const winDrag = (gid: string, mode: "move" | "size") => (e: PointerEvent): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    const f = untrack(state).floating.find((x) => x.group.id === gid);
    if (!f) return;
    raise(gid);
    const start: Rect = { x: f.x, y: f.y, w: f.w, h: f.h };
    pointerDrag(e, { threshold: 0, onMove: (p) => setRect(gid, nudge(mode, p.di, p.dy), start), onEnd: touch });
  };
  const winStep = (gid: string, mode: "move" | "size", dx: number, dy: number): void => { setRect(gid, nudge(mode, dx, dy)); touch(); };
  const winKey = (gid: string) => (e: KeyboardEvent): void => {
    // arrowStep is mirrored in RTL like the window's inline axis; it gives 1 (10 with Shift): 10 px, 40 px
    const a = e.key.startsWith("Arrow") ? arrowStep(e, isRtl(root)) : null;
    if (!a) return;
    e.preventDefault(); e.stopPropagation();
    const k = e.shiftKey ? 4 : 10;
    winStep(gid, "move", a.dx * k, a.dy * k);
  };

  // ---------------------------------------------------------------- drag a tab
  let preview: HTMLElement | undefined;
  let previewAt = "";
  let previewRun: { cancel(): void } | null = null;
  const showPreview = (d: Drop | null): void => {
    if (!preview || !root) return;
    const box = root.getBoundingClientRect();
    const key = d ? `${d.target}|${d.zone}|${d.index ?? ""}` : "";
    if (key === previewAt) return;
    const tf = d ? `translate(${d.rect.x}px, ${d.rect.y}px) scale(${Math.max(d.rect.w, 1) / box.width}, ${Math.max(d.rect.h, 1) / box.height})` : null;
    const was = previewAt;
    previewAt = key;
    previewRun?.cancel();
    preview.classList.toggle("is-tab", d?.zone === "center" && d.index != null);
    if (!tf) { previewRun = animate(preview, [{ opacity: 1 }, { opacity: 0 }], { duration: 120, fill: "forwards" }); return; }
    const from = was ? (preview.dataset["tf"] ?? tf) : tf;
    preview.dataset["tf"] = tf;
    previewRun = animate(preview, [{ transform: from, opacity: was ? 1 : 0 }, { transform: tf, opacity: 1 }], { duration: 170, easing: "easeOutCubic", fill: "forwards" });
  };
  const hit = (x: number, y: number): Drop | null => {
    if (!root) return null;
    const box = root.getBoundingClientRect();
    const rel = (r: { left: number; top: number; width: number; height: number }): Drop["rect"] => ({ x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height });
    const inside = x >= box.left && x <= box.right && y >= box.top && y <= box.bottom;
    if (!inside) return { target: "@float", zone: "float", rect: { x: clamp(x - box.left - 60, 0, box.width - 160), y: clamp(y - box.top - 14, 0, box.height - 120), w: 160, h: 120 } };
    const rtl = isRtl(root);
    const phys = (left: boolean): DockSide => (left !== rtl ? "start" : "end");
    const w = box.width, hh = box.height;
    // the whole layout's edges
    if (x - box.left < EDGE) return { target: "@root", zone: phys(true), rect: { x: 0, y: 0, w: w * 0.28, h: hh } };
    if (box.right - x < EDGE) return { target: "@root", zone: phys(false), rect: { x: w * 0.72, y: 0, w: w * 0.28, h: hh } };
    if (y - box.top < EDGE) return { target: "@root", zone: "top", rect: { x: 0, y: 0, w, h: hh * 0.28 } };
    if (box.bottom - y < EDGE) return { target: "@root", zone: "bottom", rect: { x: 0, y: hh * 0.72, w, h: hh * 0.28 } };
    const under = doc().elementFromPoint(x, y);
    const gEl = under?.closest<HTMLElement>("[data-dock-group]");
    if (!gEl || !root.contains(gEl)) return null;
    const gid = gEl.dataset["dockGroup"]!;
    const bar = under?.closest<HTMLElement>(".m-tabs-bar");
    if (bar && gEl.contains(bar)) { // between two tabs
      const tabs = [...bar.querySelectorAll<HTMLElement>('[role="tab"]')];
      let index = tabs.length, at = rtl ? bar.getBoundingClientRect().left : bar.getBoundingClientRect().right;
      for (let i = 0; i < tabs.length; i++) {
        const r = tabs[i]!.getBoundingClientRect();
        if (rtl ? x > r.left + r.width / 2 : x < r.left + r.width / 2) { index = i; at = rtl ? r.right : r.left; break; }
        at = rtl ? r.left : r.right;
      }
      const br = bar.getBoundingClientRect();
      return { target: gid, zone: "center", index, rect: { x: clamp(at - box.left - 2, 0, w - 4), y: br.top - box.top + 4, w: 4, h: br.height - 8 } };
    }
    const r = gEl.getBoundingClientRect();
    const fx = (x - r.left) / r.width, fy = (y - r.top) / r.height;
    const d = Math.min(fx, 1 - fx, fy, 1 - fy);
    if (d > 0.28) return { target: gid, zone: "center", rect: rel(r) };
    if (d === fx) return { target: gid, zone: phys(true), rect: { ...rel(r), w: r.width / 2 } };
    if (d === 1 - fx) return { target: gid, zone: phys(false), rect: { ...rel(r), x: r.left - box.left + r.width / 2, w: r.width / 2 } };
    if (d === fy) return { target: gid, zone: "top", rect: { ...rel(r), h: r.height / 2 } };
    return { target: gid, zone: "bottom", rect: { ...rel(r), y: r.top - box.top + r.height / 2, h: r.height / 2 } };
  };
  const startDrag = (e: PointerEvent, pid: string): void => {
    let ghost: DragGhost | null = null, drop: Drop | null = null;
    pointerDrag(e, {
      threshold: 6,
      onStart: () => {
        ghost = dragGhost(h("div", { class: "m-dock-ghost" }, icon(panel(pid)?.icon, "m-dock-tab-icon"), h("span", {}, titleOf(pid))) as HTMLElement, { motion: () => props.motion });
        root?.classList.add("is-dragging");
      },
      onMove: (p) => { ghost?.move(p.clientX, p.clientY); drop = hit(p.clientX, p.clientY); showPreview(drop); },
      onEnd: (_p, cancelled) => {
        root?.classList.remove("is-dragging");
        ghost?.close();
        showPreview(null);
        if (cancelled || !drop) return;
        const s = untrack(state);
        if (drop.zone === "float") {
          const box = root!.getBoundingClientRect();
          float(pid, { x: isRtl(root) ? box.width - drop.rect.x - 320 : drop.rect.x, y: drop.rect.y, w: 320, h: 220 });
          return;
        }
        let index = drop.index;
        const from = groupOf(s, pid);
        if (index != null && from?.id === drop.target && from.panels.indexOf(pid) < index) index--;
        move(pid, drop.target, drop.zone, index, true);
      },
    });
  };

  // ---------------------------------------------------------------- keyboard
  const onKeydown = (e: KeyboardEvent): void => {
    if (e.key === "F6") { // between groups
      const ids = groups(untrack(state)).map((g) => g.id);
      if (!ids.length) return;
      e.preventDefault();
      const i = ids.indexOf(focused.peek() ?? "");
      const next = ids[(i + (e.shiftKey ? -1 : 1) + ids.length) % ids.length]!;
      const g = findGroup(untrack(state), next);
      if (g?.active) tabEl(g.active)?.focus();
      return;
    }
    const tab = (e.target as HTMLElement).closest?.<HTMLElement>('[role="tab"]');
    const pid = tab?.dataset["tab"];
    if (!tab || !pid || !root?.contains(tab)) return;
    if (!(e.altKey && e.shiftKey)) return;
    const rtl = isRtl(root);
    const side = ({ ArrowLeft: rtl ? "end" : "start", ArrowRight: rtl ? "start" : "end", ArrowUp: "top", ArrowDown: "bottom" } as Record<string, DockSide>)[e.key];
    const k = e.key.toLowerCase();
    if (side) {
      e.preventDefault();
      const s = untrack(state), g = groupOf(s, pid);
      if (!g) return;
      if (g.panels.length > 1) return move(pid, g.id, side, undefined, true);
      const near = neighbour(g.id, side); // alone in its group: join the neighbour on that side
      if (near) move(pid, near, "center", undefined, true);
    } else if (e.key === "Enter") { e.preventDefault(); toggleMaximize(pid); }
    else if (k === "f") { e.preventDefault(); isFloating(untrack(state), groupOf(untrack(state), pid)?.id ?? "") ? dockBack(pid) : float(pid); }
    else if (k === "m") { e.preventDefault(); minimize(pid); }
  };
  const neighbour = (gid: string, side: DockSide): string | null => {
    const a = groupEl(gid)?.getBoundingClientRect();
    if (!a || !root) return null;
    const rtl = isRtl(root);
    const want = side === "top" || side === "bottom" ? side : (side === "start") !== rtl ? "left" : "right";
    let best: string | null = null, bestD = Infinity;
    for (const el of root.querySelectorAll<HTMLElement>("[data-dock-group]")) {
      const id = el.dataset["dockGroup"]!;
      if (id === gid) continue;
      const b = el.getBoundingClientRect();
      const ok = want === "left" ? b.right <= a.left + 2 : want === "right" ? b.left >= a.right - 2 : want === "top" ? b.bottom <= a.top + 2 : b.top >= a.bottom - 2;
      if (!ok) continue;
      const d = Math.hypot(b.left + b.width / 2 - (a.left + a.width / 2), b.top + b.height / 2 - (a.top + a.height / 2));
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  };

  // ---------------------------------------------------------------- rendering
  // a tab: Tabs draws the icon, the badge, the "changed" dot and the close mark (Delete closes too)
  const tabOf = (pid: string): TabSpec => {
    const p = panel(pid);
    return {
      id: pid, icon: p?.icon, label: h(OverflowText, { class: "m-dock-tab-title", text: () => val(p?.title) ?? pid, fade: false }),
      closable: p?.closable !== false, ...(p?.badge !== undefined ? { badge: p.badge } : null), ...(p?.dirty !== undefined ? { dirty: () => !!val(p.dirty) } : null),
      content: () => { ensureHost(pid); return h(PortalTarget, { name: target(pid), class: "m-dock-host" }); },
    };
  };
  const iconBtn = (label: () => string, ic: () => unknown, onClick: () => void, extra: Record<string, unknown> = {}): Element =>
    h(IconButton, { class: "m-dock-btn", size: "xs", label, icon: ic, onClick, ...extra }) as Element;

  const renderGroup = (g: DockGroupNode, floating: boolean): Element => {
    const gid = g.id;
    const liveGroup = (): DockGroupNode | undefined => findGroup(state(), gid);
    const maxed = (): boolean => state().maximized === gid;
    const act = (): string | null => liveGroup()?.active ?? null;
    const actions = !hasPart(props.actions) ? null : [
      floating || !shows("maximize") ? null : iconBtn(() => (maxed() ? L().restore ?? t`Restore` : L().maximize ?? t`Maximize`), () => (maxed() ? ico("restore", restoreIcon) : ico("maximize", maxIcon)), () => toggleMaximize(act() ?? undefined), { pressed: maxed, "aria-keyshortcuts": "Alt+Shift+Enter" }),
      shows("float") ? iconBtn(() => (floating ? L().dock ?? t`Dock` : L().float ?? t`Float`), () => (floating ? ico("dock", layers) : ico("float", appWindow)), () => { const a = act(); if (a) (floating ? dockBack(a) : float(a)); }, { "aria-keyshortcuts": "Alt+Shift+F" }) : null,
      shows("minimize") ? iconBtn(() => L().minimize ?? t`Minimize`, () => ico("minimize", minus), () => { const a = act(); if (a) minimize(a); }, { "aria-keyshortcuts": "Alt+Shift+M" }) : null];
    const tabLabels = reactive(() => ({ close: L().close, dirty: L().unsaved })) as unknown as TabsProps["labels"];
    const el = h("section", {
      class: () => cx("m-dock-group", floating && "m-dock-float", maxed() && "is-maximized", focused() === gid && "is-focused"),
      "data-dock-group": gid, "aria-label": () => { const title = act() ? titleOf(act()!) : ""; return L().group?.(title) ?? t`Panel group: ${title}`; },
      onFocusin: () => focused.set(gid),
      onPointerdown: () => { if (floating) raise(gid); },
    },
    h(Tabs, {
      tabs: g.panels.map(tabOf), value: act, onChange: (id: string) => commit(activate(untrack(state), id)), label: () => L().panels ?? t`Panels`, class: "m-dock-tabs",
      actions, onClose: (id: string) => void close(id), closeIcon: props.icons?.close, labels: tabLabels,
      tabProps: (tab: TabSpec) => ({ onPointerdown: (e: PointerEvent) => { if (e.button === 0) startDrag(e, tab.id); } }),
    }),
    floating && h("button", { type: "button", class: "m-dock-grip", "aria-label": () => L().moveWindow ?? t`Move window`, title: () => L().moveWindow ?? t`Move window`, onPointerdown: winDrag(gid, "move"), onKeydown: winKey(gid) }),
    floating && h(ResizeHandle, { edge: "bottom-end", line: "always", class: "m-dock-resize", step: 10, label: () => L().resizeWindow ?? t`Resize window`, title: () => L().resizeWindow ?? t`Resize window`,
      onPointerdown: winDrag(gid, "size"), onStep: (dx: number, dy: number) => winStep(gid, "size", dx, dy) }));
    return el;
  };

  const renderNode = (n: DockNode, path: string): unknown => {
    if (n.type === "group") return renderGroup(n, false);
    const node = (): DockNode | null => { let x: DockNode | null = untrack(state).root; for (const c of path) x = x && x.type === "split" ? (c === "a" ? x.a : x.b) : null; return x; };
    return h(Splitter, {
      orientation: n.dir === "row" && !narrow() ? "horizontal" : "vertical", class: "m-dock-split", min: 0.08,
      value: () => { state(); const x = node(); return x?.type === "split" ? x.share : undefined; },
      onChange: (v: number) => { const x = node(); if (x?.type === "split") { x.share = v; touch(); } },
      start: renderNode(n.a, `${path}a`), end: renderNode(n.b, `${path}b`),
    });
  };

  const tree = (): unknown => {
    shape(); narrow();
    return untrack(() => {
      const s = state();
      const own = props.empty;
      const docked = s.root ? renderNode(s.root, "") : h("div", { class: "m-dock-empty" }, own === false ? null : typeof own === "function" ? own(reset)
        : h(Empty, { size: "sm", title: L().empty ?? t`No panels open`, action: h(Button, { variant: "secondary", size: "sm", onClick: reset }, L().reset ?? t`Reset layout`) }));
      const floats = s.floating.map((f) => {
        const gid = f.group.id;
        const el = renderGroup(f.group, true) as HTMLElement;
        effect(() => {
          const r = floatOf(gid); if (!r) return;
          const z = untrack(state).floating.findIndex((x) => x.group.id === gid);
          setStyle(el, { "inset-inline-start": `${r.x}px`, "inset-block-start": `${r.y}px`, width: `${r.w}px`, height: `${r.h}px`, "z-index": String(10 + z) });
        });
        return el;
      });
      return [docked, floats];
    });
  };
  const tray = (): unknown => {
    const m = state().minimized;
    if (!m.length || props.tray === false) return null;
    return untrack(() => h(Toolbar, { class: "m-dock-tray", label: L().tray ?? t`Minimized panels`,
      children: m.map((x) => h(Button, { class: "m-dock-tray-btn", variant: "secondary", size: "sm", shape: "pill", icon: panel(x.panel)?.icon, onClick: () => restore(x.panel), title: L().restore ?? t`Restore` },
        () => titleOf(x.panel))) }));
  };

  // ---------------------------------------------------------------- commands (palette, menus, toolbars)
  if (prefix) {
    const group = (): string => t`Layout`;
    const has = (): boolean => current() != null;
    command({ id: `${prefix}.reset`, title: () => t`Reset layout`, group: group(), run: reset });
    command({ id: `${prefix}.nextGroup`, title: () => t`Focus next panel group`, group: group(), keywords: "F6", run: () => { const ids = groups(untrack(state)).map((g) => g.id); const i = ids.indexOf(focused.peek() ?? ""); const g = findGroup(untrack(state), ids[(i + 1) % ids.length] ?? ""); if (g?.active) focusPanel(g.active); } });
    command({ id: `${prefix}.maximize`, title: () => t`Maximize / restore panel`, group: group(), when: has, run: () => toggleMaximize(current() ?? undefined) });
    command({ id: `${prefix}.float`, title: () => t`Float / dock panel`, group: group(), when: has, run: () => { const p = current(); if (p) isFloating(untrack(state), groupOf(untrack(state), p)?.id ?? "") ? dockBack(p) : float(p); } });
    command({ id: `${prefix}.minimize`, title: () => t`Minimize panel`, group: group(), when: has, run: () => { const p = current(); if (p) minimize(p); } });
    command({ id: `${prefix}.close`, title: () => t`Close panel`, group: group(), when: has, run: () => { const p = current(); if (p) void close(p); } });
    // "Show panel: …" for every panel, even closed ones
    effect(() => { for (const p of panelList()) untrack(() => command({ id: `${prefix}.show.${p.id}`, title: () => t`Show panel: ${val(p.title)}`, group: t`Panels`, icon: p.icon, run: () => open(p.id) })); });
  }

  // a panel added to `panels` later is placed by open(); one removed leaves the layout
  effect(() => { const ids = panelMap(); untrack(() => { const s = state.peek(); const gone = placed(s).filter((id) => !ids.has(id)); if (gone.length) commit(gone.reduce(removePanel, s)); }); });

  props.api?.({
    state: () => state(), load: (v) => { const s = Array.isArray(v) || !("version" in (v as object)) ? fromSpec(v as DockSpec) : sanitize(v, known); if (s) commit(s); },
    reset, open, close: (p) => void close(p), focus: focusPanel, move: (p, tg, z, i) => move(p, tg, z, i), float: (p) => float(p), dock: dockBack,
    minimize, restore, toggleMaximize, active: current,
  });

  return h("div", {
    class: () => cx("m-dock", state().maximized && "has-maximized", val(props.class)), role: "region",
    "aria-roledescription": () => L().workspace ?? t`workspace`, "aria-label": () => val(props.label) ?? t`Workspace`,
    ref: (x: HTMLElement) => {
      root = x;
      observeSize(x, () => narrow.set(x.clientWidth > 0 && x.clientWidth < 544));
    }, onKeydown,
  },
  h("div", { class: "m-dock-main" }, tree),
  tray,
  h("div", { class: "m-dock-preview", "aria-hidden": "true", ref: (x: HTMLElement) => { preview = x; } }));
}

