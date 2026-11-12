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
import { glyph } from "../../../ui/util.ts";
import { track } from "../../../behaviors/drag/index.ts";
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
  /** Keep place, size and state in localStorage under "hm.win.<persist>". */
  persist?: string | undefined;
  class?: ClassProp | undefined;
  ref?: ((api: WindowApi) => void) | undefined;
  children?: unknown;
}

interface Geo { x: number; y: number; w: number; h: number }
const EDGE = 18;
const EDGES = ["n", "s", "start", "end", "n-start", "n-end", "s-start", "s-end"] as const;
type Edge = (typeof EDGES)[number];
let front = 1;

/** A window in its area: move, resize, dock to an edge, minimize, fill, close; Windows, Mac or HADİ look. */
export function Window(props: WindowProps): unknown {
  const id = uid("hm-win");
  const key = props.persist ? `hm.win.${props.persist}` : "";
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
        if (props.movable === false || (p.event.target as Element).closest(".hm-win-btn")) return false;
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
      onEnd: () => {
        moving.set(false);
        const s = snapTo.peek();
        snapTo.set(null);
        if (s) setState(s); else keep();
      },
    });
  };

  // ------------------------------------------------------------------ resizing (edges and corners)
  const grip = (edge: Edge): Element => {
    const el = h("div", { class: `hm-win-rz hm-win-rz-${edge}`, "aria-hidden": "true" }) as HTMLElement;
    let from: Geo = { x: 0, y: 0, w: 0, h: 0 };
    track(el, {
      clamp: false, area,
      onStart: () => { raise(); from = geo.peek()!; moving.set(true); },
      onMove: (p) => {
        const dx = rtl() ? -p.dx : p.dx, b = box();
        let { x, y, w, h: hh } = from;
        if (edge.includes("end")) w = clamp(from.w + dx, minW, b.w - from.x);
        if (edge.includes("start")) { const nw = clamp(from.w - dx, minW, from.x + from.w); x = from.x + from.w - nw; w = nw; }
        if (edge.startsWith("s")) hh = clamp(from.h + p.dy, minH, b.h - from.y);
        if (edge.startsWith("n")) { const nh = clamp(from.h - p.dy, minH, from.y + from.h); y = from.y + from.h - nh; hh = nh; }
        geo.set({ x, y, w, h: hh });
      },
      onEnd: () => { moving.set(false); keep(); },
    });
    return el;
  };

  // ------------------------------------------------------------------ keyboard on the title bar
  const onKey = (e: KeyboardEvent): void => {
    if (e.target !== bar) return;
    if (e.key === "Enter") { e.preventDefault(); toggleMax(); return; }
    if (e.key === "Escape" && state.peek() !== "normal") { e.preventDefault(); setState("normal"); return; }
    const step = e.altKey ? 1 : 16, d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = d[e.key];
    if (!m || props.movable === false) return;
    e.preventDefault();
    if (state.peek() !== "normal") setState("normal");
    const g = geo.peek()!, dx = rtl() ? -m[0] : m[0];
    geo.set(fit(e.shiftKey && props.resizable !== false ? { ...g, w: Math.max(minW, g.w + dx), h: Math.max(minH, g.h + m[1]) } : { ...g, x: g.x + dx, y: g.y + m[1] }));
    keep();
  };

  // ------------------------------------------------------------------ frame
  const chrome = (): WindowChrome => val(props.chrome) ?? "hadi";
  const btn = (cls: string, label: () => string, icon: () => Parameters<typeof glyph>[0], onClick: () => void): Element =>
    h("button", { type: "button", class: `hm-win-btn ${cls}`, "aria-label": label, title: label, onClick: (e: MouseEvent) => { e.stopPropagation(); onClick(); } },
      h("span", { class: "hm-win-glyph", "aria-hidden": "true" }, () => glyph(icon())));
  const buttons = h("div", { class: "hm-win-buttons" },
    props.closable === false ? null : btn("hm-win-close", () => t`Close`, () => xIcon, close),
    props.minimizable === false ? null : btn("hm-win-min", () => (state() === "minimized" ? t`Restore` : t`Minimize`), () => minus, () => setState(state.peek() === "minimized" ? "normal" : "minimized")),
    props.maximizable === false ? null : btn("hm-win-max", () => (state() === "normal" ? t`Fill the area` : t`Restore`), () => (state() === "normal" || state() === "minimized" ? maximize : copy), toggleMax));
  bar = h("div", {
    class: "hm-win-bar", tabindex: "0", role: "toolbar", "aria-label": () => t`Move window`,
    "aria-description": () => t`Arrows move the window, Shift and arrows resize it, Enter fills the area`,
    onDblClick: (e: MouseEvent) => { if (!(e.target as Element).closest(".hm-win-btn") && props.maximizable !== false) toggleMax(); },
    onKeyDown: onKey, ref: (el: HTMLElement) => moveTitle(el),
  },
  props.icon != null ? h("span", { class: "hm-win-icon", "aria-hidden": "true" }, props.icon) : null,
  h("span", { class: "hm-win-title", id: `${id}-title` }, () => val(props.title) ?? ""),
  buttons) as HTMLElement;

  // where a drop would dock, drawn inside the frame but placed in area coordinates
  const snapRect = (s: WindowState, b: { w: number; h: number }): Geo =>
    s === "start" ? { x: 0, y: 0, w: b.w / 2, h: b.h } : s === "end" ? { x: b.w / 2, y: 0, w: b.w / 2, h: b.h } : s === "bottom" ? { x: 0, y: b.h / 2, w: b.w, h: b.h / 2 } : { x: 0, y: 0, w: b.w, h: b.h };
  const snapPreview = h("div", {
    class: () => cx("hm-win-snap", snapTo() && "is-on"), "aria-hidden": "true",
    style: () => { const s = snapTo(), g = geo(); if (!s || !g) return {}; const r = snapRect(s, box()); return { "--hm-win-sx": `${r.x - g.x}px`, "--hm-win-sy": `${r.y - g.y}px`, "--hm-win-sw": `${r.w}px`, "--hm-win-sh": `${r.h}px` }; },
  }) as HTMLElement;
  const shown = (): boolean => (props.open != null ? !!val(props.open) : !closed());

  const frame = h("section", {
    class: () => cx("hm-win", `hm-win-${chrome()}`, `is-${state()}`, moving() && "is-moving", props.resizable === false && "is-fixed-size", val(props.class)),
    "aria-labelledby": `${id}-title`, hidden: () => (shown() ? null : ""),
    style: () => { const g = geo(); return g ? { "--hm-win-x": `${g.x}px`, "--hm-win-y": `${g.y}px`, "--hm-win-w": `${g.w}px`, "--hm-win-h": `${g.h}px`, "z-index": String(z()) } : { "z-index": String(z()), visibility: "hidden" }; },
    onPointerDown: raise, onFocusIn: raise,
    ref: (el: HTMLElement) => { root = el; },
  },
  bar,
  h("div", { class: "hm-win-body", hidden: () => (state() === "minimized" ? "" : null) }, props.children),
  props.resizable === false ? null : EDGES.map(grip),
  snapPreview) as HTMLElement;

  // measure once the frame is in its area, and keep it inside when the area changes size
  queueMicrotask(() => { if (root?.isConnected) place(); });
  if (globalThis.ResizeObserver) {
    let ro: ResizeObserver | null = null;
    queueMicrotask(() => { const a = area(); if (!a) return; ro = new ResizeObserver(() => { if (geo.peek()) geo.set(fit(geo.peek()!)); }); ro.observe(a); });
    onCleanup(() => ro?.disconnect());
  }
  untrack(() => props.ref?.(api));
  return frame;
}
