// slidingIndicator(pill, list).moveTo(el): an indicator that glides to the active item (tabs line, nav pill, thumb).
// Two-keyframe moves on WAAPI through play(): the motion engine is not shipped for it.
import { val, isRtl, setStyle, type MaybeFn } from "../../core/util.ts";
import { play as animate } from "../play.ts";
import { still } from "./parts.ts";
import type { EaseInput } from "./ease.ts";

/** Options of slidingIndicator(). */
export interface SlidingIndicatorOptions {
  /** The axis it moves along: "x" (default, mirrored in RTL) or "y". */
  axis?: MaybeFn<"x" | "y" | undefined>;
  /** Write the item's size to this custom property (`--m-ab-size`) instead of `width` / `height`. */
  sizeVar?: string | undefined;
  /** Stretch from the old size while it glides (default true; off when `sizeVar` is set). */
  stretch?: boolean | undefined;
  /** ms of the glide (default 320) and its easing (default "expo"). */
  duration?: number | undefined;
  easing?: EaseInput | undefined;
  /** How it first appears: "fade" (default) or "pop" (fades in from 90%). */
  enter?: "fade" | "pop" | undefined;
  /** `false` (or an accessor giving it): no glide, the indicator is placed at once. */
  motion?: MaybeFn<unknown>;
  /** Class the indicator has while it marks an item (default "is-on"). */
  onClass?: string | undefined;
}
/** What slidingIndicator() returns. */
export interface SlidingIndicator {
  /** Move to `target` (measured against the container); `null` hides the indicator. `instant` skips the glide. */
  moveTo(target: Element | null | undefined, instant?: boolean): void;
  /** Forget the last place: the next move is placed without a glide (after a resize or a turned axis). */
  reset(): void;
}
/**
 * An indicator element that glides to the active item: its final place and size are set at once (CSSOM), the motion
 * engine plays the move from the old place. The indicator must be positioned at the container's start corner
 * (`position: absolute; inset-inline-start: 0; top: 0`, transform origin at the start).
 */
export function slidingIndicator(ind: HTMLElement, container: Element, o: SlidingIndicatorOptions = {}): SlidingIndicator {
  let last: { axis: "x" | "y"; pos: number; size: number } | null = null;
  const cls = o.onClass ?? "is-on";
  const stretch = o.stretch ?? !o.sizeVar;
  return {
    reset: () => { last = null; },
    moveTo(target, instant = false) {
      const quiet = instant || still(o.motion);
      if (!target) {
        if (last && !quiet) animate(ind, { opacity: [1, 0] }, { duration: 160, easing: "out" });
        if (last) setStyle(ind, { opacity: "0" });
        ind.classList.remove(cls);
        last = null;
        return;
      }
      const axis = val(o.axis) ?? "x";
      const c = container.getBoundingClientRect(), r = target.getBoundingClientRect();
      const pos = axis === "y" ? r.top - c.top : isRtl(container) ? r.right - c.right : r.left - c.left;
      const size = axis === "y" ? r.height : r.width;
      const fn = axis === "y" ? "translateY" : "translateX", to = `${fn}(${pos}px)`;
      setStyle(ind, { transform: to, opacity: "1", ...(o.sizeVar ? { [o.sizeVar]: `${size}px` } : { [axis === "y" ? "height" : "width"]: `${size}px` }) });
      ind.classList.add(cls);
      const from = last && last.axis === axis ? last : null;
      last = { axis, pos, size };
      if (quiet) return;
      if (!from) {
        animate(ind, o.enter === "pop" ? { opacity: [0, 1], transform: [`${to} scale(.9)`, `${to} scale(1)`] } : { opacity: [0, 1] }, { duration: o.enter === "pop" ? 200 : 160, easing: "out" });
        return;
      }
      if (from.pos === pos && from.size === size) return;
      const sc = axis === "y" ? "scaleY" : "scaleX";
      const grow = stretch && size > 0 && from.size > 0;
      animate(ind, { transform: [`${fn}(${from.pos}px)${grow ? ` ${sc}(${(from.size / size).toFixed(4)})` : ""}`, `${to}${grow ? ` ${sc}(1)` : ""}`] }, { duration: o.duration ?? 320, easing: o.easing ?? "expo" });
    },
  };
}

/** The built-in ways one view replaces another. */
