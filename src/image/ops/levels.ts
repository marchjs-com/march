// levels: input black / white points, a midtone gamma and output black / white, on display values, for all channels
// together or one of them.
import { defineOp, opOf, clamp01, type ImageOp } from "../op.ts";
import { perChannelEncoded } from "../color.ts";
import { toEncoded, toLinear } from "../raster.ts";

export interface LevelsParams {
  /** Input black point 0–1 (darker values clip to black). */ inBlack: number;
  /** Input white point 0–1. */ inWhite: number;
  /** Midtone gamma 0.1–10 (above 1 brightens). */ gamma: number;
  /** Output black 0–1. */ outBlack: number;
  /** Output white 0–1. */ outWhite: number;
  /** Which channel the levels act on. */ channel: "rgb" | "r" | "g" | "b";
}

/** The levels mapping on one display value. */
export function levelsCurve(e: number, p: LevelsParams): number {
  const x = clamp01((e - p.inBlack) / Math.max(1e-4, p.inWhite - p.inBlack));
  return p.outBlack + x ** (1 / Math.max(0.01, p.gamma)) * (p.outWhite - p.outBlack);
}

export const LEVELS = defineOp<LevelsParams>({
  type: "levels", kind: "color",
  defaults: { inBlack: 0, inWhite: 1, gamma: 1, outBlack: 0, outWhite: 1, channel: "rgb" },
  params: {
    inBlack: { min: 0, max: 1, step: 0.01, default: 0 },
    inWhite: { min: 0, max: 1, step: 0.01, default: 1 },
    gamma: { min: 0.1, max: 10, step: 0.01, default: 1 },
    outBlack: { min: 0, max: 1, step: 0.01, default: 0 },
    outWhite: { min: 0, max: 1, step: 0.01, default: 1 },
  },
  identity: (p) => p.inBlack === 0 && p.inWhite === 1 && p.gamma === 1 && p.outBlack === 0 && p.outWhite === 1,
  color: (c, p) => {
    if (p.channel === "rgb") { perChannelEncoded(c, (e) => levelsCurve(e, p)); return; }
    const k = p.channel === "r" ? 0 : p.channel === "g" ? 1 : 2, v = c[k]!;
    c[k] = toLinear(levelsCurve(toEncoded(Math.max(0, v)), p));
  },
});
/** Levels: `levels({ inBlack: 0.05, inWhite: 0.92, gamma: 1.1 })`. */
export const levels = (params: Partial<LevelsParams> = {}): ImageOp<LevelsParams> => opOf(LEVELS, params);
