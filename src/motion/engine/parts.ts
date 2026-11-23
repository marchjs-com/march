// Small motion parts shared by components (one definition each, no copies):
//   still(props.motion)                       motion switched off (the prop or the reduced-motion preference)
//   motionPreset("pop", { y: 12 })            [hidden, shown] keyframes of an appear preset (pop / fade / slide / rise)
//   swapFrames("slide", 1)                    the enter / leave keyframes when one view replaces another
// Nothing here animates: slidingIndicator (indicator.ts, light) and swapTransition (swap.ts, engine) play them, so a
// component that only asks still() ships neither.
import { val, type MaybeFn } from "../../core/util.ts";
import type { EaseInput } from "./ease.ts";
import { reducedMotion } from "./prefs.ts";

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
