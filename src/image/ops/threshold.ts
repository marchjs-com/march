// threshold: pure black and white split at a display luminance level; softness widens the edge into a short ramp.
import { defineOp, opOf, smooth, type ImageOp } from "../op.ts";
import { luminance, toEncoded, toLinear } from "../raster.ts";

export interface ThresholdParams { /** Display luminance 0–1 at which black turns white. */ level: number; /** Ramp width 0–1. */ softness: number }
export const THRESHOLD = defineOp<ThresholdParams>({
  type: "threshold", kind: "color", defaults: { level: 0.5, softness: 0 },
  params: { level: { min: 0, max: 1, step: 0.01, default: 0.5 }, softness: { min: 0, max: 1, step: 0.01, default: 0 } },
  color: (c, p) => {
    const e = toEncoded(Math.max(0, luminance(c[0]!, c[1]!, c[2]!))), s = p.softness / 2;
    const v = s > 1e-4 ? toLinear(smooth(p.level - s, p.level + s, e)) : e >= p.level ? 1 : 0;
    c[0] = c[1] = c[2] = v;
  },
});
/** Threshold at a display level 0–1. */
export const threshold = (level = 0.5, softness = 0): ImageOp<ThresholdParams> => opOf(THRESHOLD, { level, softness });
