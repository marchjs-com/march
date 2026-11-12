// Keyframe timeline data: targets, tracks of one property each, keyframes with an easing into them. Sampling uses the
// motion engine's easings, so a track looks in the editor as it runs in the engine.
import { ease } from "../../../motion/engine/ease.ts";
import type { ColorToken } from "../../../theme/colors.ts";

export type TimelineProp = "x" | "y" | "scale" | "rotate" | "opacity";
/** A keyframe: time (ms), value, and the easing of the segment that ends at it (default "in-out"). */
export interface Keyframe { at: number; value: number; easing?: string }
export interface TimelineTrack { id: string; target: string; prop: TimelineProp; color?: ColorToken; keys: Keyframe[] }
export interface TimelineModel { duration: number; tracks: TimelineTrack[] }

export const PROP_UNIT: Record<TimelineProp, string> = { x: "px", y: "px", scale: "×", rotate: "°", opacity: "" };
export const PROP_RANGE: Record<TimelineProp, [number, number]> = { x: [-200, 200], y: [-120, 120], scale: [0, 3], rotate: [-360, 360], opacity: [0, 1] };

const sorted = (keys: readonly Keyframe[]): Keyframe[] => [...keys].sort((a, b) => a.at - b.at);
/** The value of a track at `t` ms. */
export function sampleTrack(track: TimelineTrack, t: number): number {
  const k = sorted(track.keys);
  if (!k.length) return track.prop === "scale" || track.prop === "opacity" ? 1 : 0;
  if (t <= k[0]!.at) return k[0]!.value;
  for (let i = 1; i < k.length; i++) {
    const a = k[i - 1]!, b = k[i]!;
    if (t <= b.at) { const f = b.at === a.at ? 1 : (t - a.at) / (b.at - a.at); return a.value + (b.value - a.value) * ease(b.easing ?? "in-out")(f); }
  }
  return k[k.length - 1]!.value;
}
/** Every target's values at `t`: { logo: { x: 12, rotate: 30 }, … }. */
export function sample(model: TimelineModel, t: number): Record<string, Partial<Record<TimelineProp, number>>> {
  const out: Record<string, Partial<Record<TimelineProp, number>>> = {};
  for (const tr of model.tracks) (out[tr.target] ??= {})[tr.prop] = sampleTrack(tr, t);
  return out;
}
/** CSS variables for a target's sampled values (x/y px, scale, rotate deg, opacity). */
export function targetVars(v: Partial<Record<TimelineProp, number>>): Record<string, string> {
  const n = (x: number | undefined, d: number): string => String(Math.round((x ?? d) * 1000) / 1000);
  return { "--hm-kt-x": n(v.x, 0), "--hm-kt-y": n(v.y, 0), "--hm-kt-s": n(v.scale, 1), "--hm-kt-r": n(v.rotate, 0), "--hm-kt-o": n(v.opacity, 1) };
}

/** Engine timeline code for a model (what the editor plays), e.g. for the Code view. */
export function timelineCode(model: TimelineModel): string {
  const css: Record<TimelineProp, (v: number) => string> = { x: (v) => `translate: "${v}px 0"`, y: (v) => `translate: "0 ${v}px"`, scale: (v) => `scale: ${v}`, rotate: (v) => `rotate: "${v}deg"`, opacity: (v) => `opacity: ${v}` };
  const lines = [`timeline()`];
  for (const tr of model.tracks) {
    const k = sorted(tr.keys);
    for (let i = 1; i < k.length; i++) lines.push(`  .add("#${tr.target}", [{ ${css[tr.prop](k[i - 1]!.value)} }, { ${css[tr.prop](k[i]!.value)} }], { at: ${k[i - 1]!.at}, duration: ${k[i]!.at - k[i - 1]!.at}, easing: "${k[i]!.easing ?? "in-out"}" })`);
  }
  return lines.join("\n");
}
