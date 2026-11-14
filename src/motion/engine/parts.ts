// Small motion parts shared by components (one definition each, no copies):
//   still(props.motion)                       motion switched off (the prop or the reduced-motion preference)
//   motionPreset("pop", { y: 12 })            [hidden, shown] keyframes of an appear preset (pop / fade / slide / rise)
//   slidingIndicator(pill, list).moveTo(el)   an indicator that glides to the active item (tabs line, nav pill, thumb)
//   swapTransition(inEl, outEl, "slide", …)   the enter / leave pair when one view replaces another
import { val, isRtl, setStyle, type MaybeFn } from "../../core/util.ts";
import { animate } from "./playback.ts";
import { reducedMotion } from "./prefs.ts";
import type { EaseInput } from "./ease.ts";

/** True when nothing should move: the `motion` option is `false` / "none", or the user asked for reduced motion. */
export function still(motion?: MaybeFn<unknown>): boolean {
  const m = val(motion);
  return m === false || m === "none" || reducedMotion();
}

/** Names of the appear presets. */
export type MotionPresetName = "pop" | "fade" | "slide" | "rise";
/** Where a preset starts from: px offsets and a scale (each preset has its own defaults). */
export interface MotionPresetFrom { x?: number | undefined; y?: number | undefined; scale?: number | undefined }
const PRESET_FROM: Record<MotionPresetName, MotionPresetFrom> = { pop: { scale: 0.85 }, fade: {}, slide: { y: 12 }, rise: { y: 8 } };
/**
 * The two keyframes of an appear preset: `[hidden, shown]` (play them in this order to enter, reversed to leave).
 * pop: scales up · fade: opacity only · slide: comes from 12px below · rise: from 8px below; `from` overrides the
 * start (`motionPreset("slide", { x: 24, y: 0 })` slides sideways). An unknown name gives "pop".
 */
export function motionPreset(name: MotionPresetName | (string & {}), from: MotionPresetFrom = {}): [Record<string, string | number>, Record<string, string | number>] {
  const f = { ...(PRESET_FROM[name as MotionPresetName] ?? PRESET_FROM.pop), ...from };
  const parts = [
    f.x ? `translateX(${f.x}px)` : "", f.y ? `translateY(${f.y}px)` : "", f.scale != null && f.scale !== 1 ? `scale(${f.scale})` : "",
  ].filter(Boolean);
  return [{ opacity: 0, transform: parts.join(" ") || "none" }, { opacity: 1, transform: "none" }];
}

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
export type SwapKind = "fade" | "slide" | "rise" | "zoom" | "turn";
/** The keyframes of a swap: what the arriving and the leaving element play. */
export interface SwapFrames { enter: Record<string, unknown[]>; leave: Record<string, unknown[]> }
/** Options of swapTransition(). */
export interface SwapOptions {
  /** 1: forward (default), -1: back. The arriving view comes from that side, the old one leaves to the other. */
  dir?: 1 | -1 | undefined;
  /** Right-to-left text: mirrors the sideways kinds (slide, turn). */
  rtl?: boolean | undefined;
  /** Travel of slide / rise: px, or a CSS length ("8%"). Default 80 (slide), 24 (rise). */
  distance?: number | string | undefined;
  /** ms and easing of the arriving view (default 520, "expo") and its delay. */
  duration?: number | undefined;
  easing?: EaseInput | undefined;
  delay?: number | undefined;
  /** ms and easing of the leaving view (default 420, "in-out"). */
  leaveDuration?: number | undefined;
  leaveEasing?: EaseInput | undefined;
  /** Class the leaving view has while it leaves (default "is-leaving"; `false`: none). */
  leavingClass?: string | false | undefined;
  /** `false` (or an accessor giving it): nothing plays. */
  motion?: MaybeFn<unknown>;
}
const len = (d: number | string, k: number): string => {
  const m = /^(-?[\d.]+)(.*)$/.exec(String(d).trim());
  return m ? `${Number(m[1]) * k}${m[2] || "px"}` : "0px";
};
/** The keyframes of a built-in swap for a direction (`s`: 1 or -1, already mirrored) and a travel distance. */
export function swapFrames(kind: SwapKind, s: 1 | -1 = 1, distance?: number | string): SwapFrames {
  switch (kind) {
    case "slide": {
      const d = distance ?? 80;
      return {
        enter: { opacity: [0, 1], transform: [`translate3d(${len(d, s)}, 0, 0)`, "translate3d(0, 0, 0)"] },
        leave: { opacity: [1, 0], transform: ["translate3d(0, 0, 0)", `translate3d(${len(d, -s)}, 0, 0)`] },
      };
    }
    case "rise": {
      const d = distance ?? 24;
      return {
        enter: { opacity: [0, 1], transform: [`translate3d(0, ${len(d, s)}, 0) scale(.97)`, "translate3d(0, 0, 0) scale(1)"] },
        leave: { opacity: [1, 0], transform: ["translate3d(0, 0, 0) scale(1)", `translate3d(0, ${len(d, (-s * 2) / 3)}, 0) scale(.98)`] },
      };
    }
    case "zoom": return {
      enter: { opacity: [0, 1], transform: ["scale(.9)", "scale(1)"] },
      leave: { opacity: [1, 0], transform: ["scale(1)", "scale(1.06)"] },
    };
    case "turn": return {
      enter: { opacity: [0, 1], transform: [`perspective(1200px) rotateY(${-22 * s}deg) translateX(${70 * s}px)`, "perspective(1200px) rotateY(0deg) translateX(0px)"], filter: ["blur(8px)", "blur(0px)"] },
      leave: { opacity: [1, 0], transform: ["perspective(1200px) rotateY(0deg) translateX(0px)", `perspective(1200px) rotateY(${18 * s}deg) translateX(${-60 * s}px)`], filter: ["blur(0px)", "blur(6px)"] },
    };
    default: return { enter: { opacity: [0, 1] }, leave: { opacity: [1, 0] } };
  }
}
/**
 * One view replaces another: `inEl` arrives, `outEl` leaves (either may be missing). `kind`: a built-in name, your own
 * `{ enter, leave }` keyframes, a function `(inEl, outEl, dir) => …` that plays its own animation, or "none" / `false`.
 * Resolves when the old view has left (at once when nothing plays): remove or hide it then.
 */
export function swapTransition<E extends Element>(
  inEl: E | null | undefined, outEl: E | null | undefined,
  kind: SwapKind | "none" | false | SwapFrames | ((inEl: E, outEl: E | undefined, dir: 1 | -1) => unknown), o: SwapOptions = {},
): Promise<void> {
  const dir = o.dir ?? 1;
  if (kind === "none" || kind === false || still(o.motion)) return Promise.resolve();
  if (typeof kind === "function") { if (inEl) kind(inEl, outEl ?? undefined, dir); return Promise.resolve(); }
  const s = (o.rtl && (kind === "slide" || kind === "turn") ? -dir : dir) as 1 | -1;
  const f = typeof kind === "string" ? swapFrames(kind, s, o.distance) : kind;
  if (inEl) animate(inEl, f.enter, { duration: o.duration ?? 520, easing: o.easing ?? "expo", ...(o.delay ? { delay: o.delay } : {}) });
  if (!outEl) return Promise.resolve();
  const cls = o.leavingClass === false ? "" : o.leavingClass ?? "is-leaving";
  if (cls) outEl.classList.add(cls);
  return animate(outEl, f.leave, { duration: o.leaveDuration ?? 420, easing: o.leaveEasing ?? "in-out" }).finished.then(() => { if (cls) outEl.classList.remove(cls); });
}
