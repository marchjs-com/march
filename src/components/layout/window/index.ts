// Window (hadi-march/layout): a movable, resizable window inside its area (the nearest positioned ancestor).
//   <div class="desk"><Window title="Notlar" chrome="mac" persist="notes">…</Window></div>
// Title bar: drag to move, double click fills the area; drag to an edge to dock (start / end half, bottom half,
// top = fill). Buttons: minimize (title bar only, at the bottom), fill / restore, close. Edges and corners resize.
// Keyboard on the focused title bar: arrows move (Shift: resize), Enter fills / restores, Escape restores.
// Three looks: "windows", "mac", "hadi". `persist` keeps place, size and state. Geometry is logical: x runs from the
// inline start, so a right-to-left page mirrors it.
import "./window.css";
import { signal, effect, untrack, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, messages, dir } from "../../../core/i18n.ts";
import { cx, val, uid, clamp, load, save, type ClassProp, type MaybeFn } from "../../../core/util.ts";
import { ownIcon } from "../../../ui/parts.ts";
import { observeSize } from "../../../ui/observe.ts";
import { colorAttr, type ColorToken, withColor } from "../../../theme/colors.ts";
import type { IconDef } from "../../../icons/svg.ts";
import { track, arrowStep } from "../../../behaviors/drag/index.ts";
import { PanelHeader } from "../panel-header/index.ts";
import { ResizeHandle, type ResizeEdge } from "../resize-handle/index.ts";
import { IconButton } from "../../actions/icon-button/index.ts";
import { minus } from "../../../icons/glyphs/minus.ts";
import { maximize } from "../../../icons/glyphs/maximize.ts";
import { copy } from "../../../icons/glyphs/copy.ts";
import { x as xIcon } from "../../../icons/glyphs/x.ts";
import tr from "./tr.ts";

messages("tr", tr);

/** "normal" floats at its own place and size; the others fill (part of) the area or fold to the title bar. */
export type WindowState = "normal" | "minimized" | "maximized" | "start" | "end" | "bottom";
export type WindowChrome = "windows" | "mac" | "hadi";
export interface WindowApi {
  state(): WindowState;
  set(state: WindowState): void;
  /** Back to the floating place and size. */
  restore(): void;
  close(): void;
  /** Bring to the front and focus the title bar. */
  focus(): void;
}

export interface WindowProps {
  title?: MaybeFn<string> | undefined;
  /** An icon node before the title. */
  icon?: unknown;
  /** Look of the frame (default "hadi"). */
  chrome?: MaybeFn<WindowChrome | undefined> | undefined;
  /** Start place and size in px (default: 32 × 20 rem, centered). */
  x?: number | undefined; y?: number | undefined; width?: number | undefined; height?: number | undefined;
  minWidth?: number | undefined; minHeight?: number | undefined;
  /** Start state, or a live one with onStateChange. */
  state?: MaybeFn<WindowState | undefined> | undefined;
  onStateChange?: ((s: WindowState) => void) | undefined;
  /** Shown while true (live); without it the close button removes the window until it is rendered again. */
  open?: MaybeFn<boolean | undefined> | undefined;
  onClose?: (() => void) | undefined;
  /** Buttons to show (default all three). */
  minimizable?: boolean | undefined; maximizable?: boolean | undefined; closable?: boolean | undefined;
  /** false: fixed in place (the buttons still work). */
  movable?: boolean | undefined;
  resizable?: boolean | undefined;
  /** Dock when dragged to an edge (default true). */
  snap?: boolean | undefined;
  /** Keep place, size and state in localStorage under "m.win.<persist>". */
  persist?: string | undefined;
  /** Texts of the buttons and the title bar (the defaults are translated). */
  labels?: { close?: string; minimize?: string; restore?: string; maximize?: string; move?: string; moveHint?: string } | undefined;
  /** Your own button icons: an icon, a text or a node each. */
  icons?: { close?: unknown; minimize?: unknown; maximize?: unknown; restore?: unknown } | undefined;
  /** Accent of the frame: the title icon, the button hover and the dock preview (default: the accent). */
  color?: ColorToken | undefined;
  /** The brand stripe of the "hadi" look (default true). */
  stripe?: boolean | undefined;
  /** false: place and size change at once, without a transition (default true). */
  animated?: boolean | undefined;
  class?: ClassProp | undefined;
  ref?: ((api: WindowApi) => void) | undefined;
  children?: unknown;
}

interface Geo { x: number; y: number; w: number; h: number }
const EDGE = 18;
const EDGES = ["top", "bottom", "start", "end", "top-start", "top-end", "bottom-start", "bottom-end"] as const satisfies readonly ResizeEdge[];
type Edge = (typeof EDGES)[number];
let front = 1;

/** A window in its area: move, resize, dock to an edge, minimize, fill, close; Windows, Mac or HADİ look. */
export function Window(props: WindowProps): unknown {
  const id = uid("m-win");
  const key = props.persist ? `m.win.${props.persist}` : "";
  const saved = key ? load<{ geo?: Geo; state?: WindowState } | null>(key, null) : null;
  const geo = signal<Geo | null>(saved?.geo ?? null);
  const state = signal<WindowState>(saved?.state ?? untrack(() => val(props.state)) ?? "normal");
  const closed = signal(false);
  const z = signal(front++);
  const moving = signal(false);
  const snapTo = signal<WindowState | null>(null);
  const minW = props.minWidth ?? 220, minH = props.minHeight ?? 120;
  const rtl = (): boolean => dir() === "rtl";
  let root: HTMLElement | undefined, bar: HTMLElement | undefined;

  effect(() => { const s = val(props.state); if (s) untrack(() => state.set(s)); });
  const setState = (s: WindowState): void => { if (state.peek() === s) return; state.set(s); props.onStateChange?.(s); keep(); };
  const keep = (): void => { if (key) save(key, { geo: geo.peek(), state: state.peek() }); };
  const raise = (): void => { if (z.peek() !== front - 1) z.set(front++); };

  const area = (): HTMLElement | null => (root?.offsetParent as HTMLElement | null) ?? root?.parentElement ?? null;
  const box = (): { w: number; h: number } => { const a = area(); return { w: a?.clientWidth || 800, h: a?.clientHeight || 600 }; };
  /** Keep the window reachable: at least its title bar stays inside the area. */
  const fit = (g: Geo): Geo => {
    const b = box();
    const w = clamp(g.w, Math.min(minW, b.w), Math.max(minW, b.w)), hh = clamp(g.h, Math.min(minH, b.h), Math.max(minH, b.h));
    return { w, h: hh, x: clamp(g.x, 0, Math.max(0, b.w - w)), y: clamp(g.y, 0, Math.max(0, b.h - 40)) };
  };
  const place = (): void => {
    if (geo.peek()) { geo.set(fit(geo.peek()!)); return; }
    const b = box(), rem = parseFloat(globalThis.getComputedStyle?.(root!).fontSize ?? "") || 16;
    const w = props.width ?? 32 * rem, hh = props.height ?? 20 * rem;
    geo.set(fit({ w, h: hh, x: props.x ?? (b.w - w) / 2, y: props.y ?? (b.h - hh) / 2 }));
  };

  const close = (): void => { if (props.open == null) closed.set(true); props.onClose?.(); };
  const api: WindowApi = {
    state: () => state(), set: setState, restore: () => setState("normal"), close,
    focus: () => { raise(); bar?.focus(); },
  };
  const toggleMax = (): void => setState(state.peek() === "normal" ? "maximized" : "normal");

  // ------------------------------------------------------------------ moving (title bar) and docking
  const edgeOf = (px: number, py: number, b: { w: number; h: number }): WindowState | null => {
    if (props.snap === false) return null;
    const ix = rtl() ? b.w - px : px;
    if (py < EDGE) return "maximized";
    if (ix < EDGE) return "start";
    if (ix > b.w - EDGE) return "end";
    if (py > b.h - EDGE) return "bottom";
    return null;
  };
  const moveTitle = (el: HTMLElement): void => {
    let from: Geo = { x: 0, y: 0, w: 0, h: 0 };
    track(el, {
      clamp: false, area,
      onStart: (p) => {
        if (props.movable === false || (p.event.target as Element).closest(".m-win-btn")) return false;
        raise();
        const g = geo.peek()!;
        // dragging a filled or docked window puts it back to its own size, under the pointer where it was grabbed
        if (state.peek() !== "normal") {
          const b = box(), ix = rtl() ? b.w - p.px : p.px;
          const rel = root ? (rtl() ? root.getBoundingClientRect().right - p.event.clientX : p.event.clientX - root.getBoundingClientRect().left) / root.offsetWidth : 0.5;
          from = fit({ ...g, x: ix - g.w * clamp(rel, 0, 1), y: Math.max(0, p.py - 16) });
          geo.set(from);
          setState("normal");
        } else from = g;
        moving.set(true);
      },
      onMove: (p) => {
        const dx = rtl() ? -p.dx : p.dx;
        geo.set(fit({ ...from, x: from.x + dx, y: from.y + p.dy }));
        snapTo.set(edgeOf(p.px, p.py, box()));
      },
      onEnd: (p) => {
        moving.set(false);
        // the drop point decides (a quick drag may end without a move event at the edge)
        const s = p.dx || p.dy ? edgeOf(p.px, p.py, box()) : null;
        snapTo.set(null);
        if (s) setState(s); else keep();
      },
    });
  };

  // ------------------------------------------------------------------ resizing (edges and corners)
  const grip = (edge: Edge): unknown => {
    let from: Geo = { x: 0, y: 0, w: 0, h: 0 };
    // the bare grip of ResizeHandle (the frame's own border is the line); the window runs the two-axis gesture
    return h(ResizeHandle, { edge, line: "none", class: "m-win-rz", ref: (el: HTMLElement) => track(el, {
      clamp: false, area,
      onStart: () => { raise(); from = geo.peek()!; moving.set(true); },
      onMove: (p) => {
        const dx = rtl() ? -p.dx : p.dx, b = box();
        let { x, y, w, h: hh } = from;
        if (edge.includes("end")) w = clamp(from.w + dx, minW, b.w - from.x);
        if (edge.includes("start")) { const nw = clamp(from.w - dx, minW, from.x + from.w); x = from.x + from.w - nw; w = nw; }
        if (edge.startsWith("bottom")) hh = clamp(from.h + p.dy, minH, b.h - from.y);
        if (edge.startsWith("top")) { const nh = clamp(from.h - p.dy, minH, from.y + from.h); y = from.y + from.h - nh; hh = nh; }
        geo.set({ x, y, w, h: hh });
      },
      onEnd: () => { moving.set(false); keep(); },
    }) });
  };

  // ------------------------------------------------------------------ keyboard on the title bar
  const onKey = (e: KeyboardEvent): void => {
    if (e.target !== bar) return;
    if (e.key === "Enter") { e.preventDefault(); toggleMax(); return; }
    if (e.key === "Escape" && state.peek() !== "normal") { e.preventDefault(); setState("normal"); return; }
    const a = e.key.startsWith("Arrow") ? arrowStep(e, rtl()) : null;
    if (!a || props.movable === false) return;
    e.preventDefault();
    if (state.peek() !== "normal") setState("normal");
    // 16 px a press, 1 px with Alt (Shift is "resize" here, not arrowStep's ×10)
    const k = (e.altKey ? 1 : 16) / (e.shiftKey ? 10 : 1), g = geo.peek()!, dx = a.dx * k, dy = a.dy * k;
    geo.set(fit(e.shiftKey && props.resizable !== false ? { ...g, w: Math.max(minW, g.w + dx), h: Math.max(minH, g.h + dy) } : { ...g, x: g.x + dx, y: g.y + dy }));
    keep();
  };

  // ------------------------------------------------------------------ frame
  const chrome = (): WindowChrome => val(props.chrome) ?? "hadi";
  type IconKey = "close" | "minimize" | "maximize" | "restore";
  // a given icon (icon, text or node) replaces the built-in glyph
  const pic = (k: IconKey, def: IconDef): unknown => ownIcon(props.icons?.[k] ?? undefined, def, "m-win-glyph-own");
  const restoreText = (): string => props.labels?.restore ?? t`Restore`;
  // the chrome's CSS sizes and shapes the buttons (square, traffic lights, round)
  const btn = (cls: string, label: () => string, icon: () => unknown, onClick: () => void): unknown =>
    h(IconButton, { class: `m-win-btn ${cls}`, label, icon: h("span", { class: "m-win-glyph", "aria-hidden": "true" }, icon), onClick: (e: MouseEvent) => { e.stopPropagation(); onClick(); } });
  bar = withColor(h(PanelHeader, {
    as: "div", size: "sm", drag: true, class: "m-win-bar", tabindex: "0", role: "toolbar", "aria-label": () => props.labels?.move ?? t`Move window`,
    "aria-description": () => props.labels?.moveHint ?? t`Arrows move the window, Shift and arrows resize it, Enter fills the area`,
    onDblClick: (e: MouseEvent) => { if (!(e.target as Element).closest(".m-win-btn") && props.maximizable !== false) toggleMax(); },
    onKeyDown: onKey, ref: (el: HTMLElement) => moveTitle(el),
    icon: props.icon != null ? h("span", { class: "m-panel-header-icon m-win-icon", "aria-hidden": "true" }, props.icon) : null,
    title: () => val(props.title) ?? "", titleAs: "span", titleId: `${id}-title`, partClass: { title: "m-win-title", actions: "m-win-buttons" },
    actions: [
      props.closable === false ? null : btn("m-win-close", () => props.labels?.close ?? t`Close`, () => pic("close", xIcon), close),
      props.minimizable === false ? null : btn("m-win-min", () => (state() === "minimized" ? restoreText() : props.labels?.minimize ?? t`Minimize`), () => pic("minimize", minus), () => setState(state.peek() === "minimized" ? "normal" : "minimized")),
      props.maximizable === false ? null : btn("m-win-max", () => (state() === "normal" ? props.labels?.maximize ?? t`Fill the area` : restoreText()), () => (state() === "normal" || state() === "minimized" ? pic("maximize", maximize) : pic("restore", copy)), toggleMax),
    ] }), props.color) as HTMLElement;

  // where a drop would dock, drawn inside the frame but placed in area coordinates
  const snapRect = (s: WindowState, b: { w: number; h: number }): Geo =>
    s === "start" ? { x: 0, y: 0, w: b.w / 2, h: b.h } : s === "end" ? { x: b.w / 2, y: 0, w: b.w / 2, h: b.h } : s === "bottom" ? { x: 0, y: b.h / 2, w: b.w, h: b.h / 2 } : { x: 0, y: 0, w: b.w, h: b.h };
  const snapPreview = h("div", {
    class: () => cx("m-win-snap", snapTo() && "is-on"), "aria-hidden": "true", "data-m-color": colorAttr(props.color),
    style: () => { const s = snapTo(), g = geo(); if (!s || !g) return {}; const r = snapRect(s, box()); return { "--m-win-sx": `${r.x - g.x}px`, "--m-win-sy": `${r.y - g.y}px`, "--m-win-sw": `${r.w}px`, "--m-win-sh": `${r.h}px` }; },
  }) as HTMLElement;
  const shown = (): boolean => (props.open != null ? !!val(props.open) : !closed());

  const frame = h("section", {
    class: () => cx("m-win", `m-win-${chrome()}`, `is-${state()}`, moving() && "is-moving", props.resizable === false && "is-fixed-size", props.stripe === false && "m-win-no-stripe", props.animated === false && "is-static", val(props.class)),
    "aria-labelledby": `${id}-title`, hidden: () => (shown() ? null : ""),
    style: () => { const g = geo(); return g ? { "--m-win-x": `${g.x}px`, "--m-win-y": `${g.y}px`, "--m-win-w": `${g.w}px`, "--m-win-h": `${g.h}px`, "z-index": String(z()), visibility: "visible" } : { "z-index": String(z()), visibility: "hidden" }; },
    onPointerDown: raise, onFocusIn: raise,
    ref: (el: HTMLElement) => { root = el; },
  },
  bar,
  h("div", { class: "m-win-body", hidden: () => (state() === "minimized" ? "" : null) }, props.children),
  props.resizable === false ? null : EDGES.map(grip),
  snapPreview) as HTMLElement;

  // measure once the frame is in its area, and keep it inside when the area changes size
  queueMicrotask(() => { if (root?.isConnected) place(); });
  let unobserve: (() => void) | null = null;
  queueMicrotask(() => { const a = area(); if (a) unobserve = observeSize(a, () => { if (geo.peek()) geo.set(fit(geo.peek()!)); }); });
  onCleanup(() => unobserve?.());
  untrack(() => props.ref?.(api));
  return frame;
}
