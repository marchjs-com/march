// hadi-march/behaviors/resize-handle — a separator the user drags or steps with the keyboard to resize something
// (split panes, a sidebar, a table column, a panel). Built on the drag behavior:
//   resizeHandle(grip, { value: () => width, set: (w, done) => …, min: 160, max: 480, reset: () => … })
//   <span use:resizeHandle={[resizeHandle, { … }]} />
// Pointer: drag along the inline axis (RTL mirrored) or the block axis; Escape puts the size back. Keyboard: arrows
// step (Shift ×4), Page Up / Down a big step, Home / End go to min / max, Enter or a double click resets. ARIA:
// role="separator", the orientation, aria-valuemin / max / now kept current, focusable unless the element says
// otherwise (a grid that manages focus itself sets tabindex="-1").
import { clamp, listen, isRtl } from "../../core/util.ts";
import { pointerDrag } from "../drag/drag.ts";

/** Options of resizeHandle(). */
export interface ResizeHandleOptions {
  /** The current size (any unit: px, percent…). */
  value: () => number;
  /** Apply a size, already clamped to min / max; `done` is true when a gesture ends (save it then). */
  set: (v: number, done: boolean) => void;
  min?: number | undefined;
  max?: number | undefined;
  /** Keyboard step (default 16); Shift and Page keys move `bigStep` (default 4 × step). */
  step?: number | undefined;
  bigStep?: number | undefined;
  /** Size units per pointer pixel (default 1); a percent split passes `() => 100 / container width`. */
  scale?: (() => number) | undefined;
  /** "inline" (default): the handle moves left / right and grows toward the inline end; "block": up / down. */
  axis?: "inline" | "block" | undefined;
  /** The thing grows toward the inline start / block start (a panel on the end edge). */
  invert?: boolean | undefined;
  /** Enter and double click (default: none). */
  reset?: (() => void) | undefined;
  onStart?: (() => void) | undefined;
  onEnd?: ((cancelled: boolean) => void) | undefined;
}

/** Make `el` a resize separator. Returns the cleanup (also run with the current owner). */
export function resizeHandle(el: HTMLElement, o: ResizeHandleOptions): () => void {
  const block = o.axis === "block";
  const lo = o.min ?? -Infinity, hi = o.max ?? Infinity;
  const fit = (v: number): number => clamp(v, lo, hi);
  const aria = (): void => { el.setAttribute("aria-valuenow", String(Math.round(o.value()))); };
  el.setAttribute("role", "separator");
  el.setAttribute("aria-orientation", block ? "horizontal" : "vertical");
  if (o.min != null) el.setAttribute("aria-valuemin", String(o.min));
  if (o.max != null) el.setAttribute("aria-valuemax", String(o.max));
  if (!el.hasAttribute("tabindex")) el.setAttribute("tabindex", "0");
  aria();
  const put = (v: number, done: boolean): void => { o.set(fit(v), done); aria(); };
  const sign = (): number => (o.invert ? -1 : 1);
  return listen(el, {
    pointerdown: (e: PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      const v0 = o.value(), k = o.scale?.() ?? 1;
      el.classList.add("is-dragging");
      o.onStart?.();
      const end = (cancelled: boolean): void => {
        el.classList.remove("is-dragging");
        if (cancelled) put(v0, true); else { o.set(o.value(), true); aria(); }
        o.onEnd?.(cancelled);
      };
      pointerDrag(e, {
        threshold: 0,
        onMove: (p) => put(v0 + (block ? p.dy : p.di) * k * sign(), false),
        onEnd: (_p, cancelled) => end(cancelled),
        onClick: () => end(false),
      });
    },
    click: (e: Event) => e.stopPropagation(), // a header behind it must not sort
    dblclick: (e: Event) => { if (o.reset) { e.stopPropagation(); o.reset(); aria(); } },
    keydown: (e: KeyboardEvent) => {
      const step = o.step ?? 16, big = o.bigStep ?? step * 4, s = e.shiftKey ? big : step;
      const rtl = !block && isRtl(el);
      const [grow, shrink] = block ? ["ArrowDown", "ArrowUp"] : rtl ? ["ArrowLeft", "ArrowRight"] : ["ArrowRight", "ArrowLeft"];
      const v = o.value();
      let to: number | null = null;
      if (e.key === grow) to = v + s * sign();
      else if (e.key === shrink) to = v - s * sign();
      else if (e.key === "PageUp") to = v + big;
      else if (e.key === "PageDown") to = v - big;
      else if (e.key === "Home" && o.min != null) to = o.min;
      else if (e.key === "End" && o.max != null) to = o.max;
      else if (e.key === "Enter" && o.reset) { e.preventDefault(); e.stopPropagation(); o.reset(); aria(); return; }
      if (to == null) return;
      e.preventDefault(); e.stopPropagation();
      put(to, true);
    },
  });
}
