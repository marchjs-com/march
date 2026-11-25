// split-tone: tints the highlights with one hue and the shadows with another (OKLab, lightness kept); balance moves
// the split point towards the shadows (−) or the highlights (+). Hues are the familiar colour-wheel degrees
// (0 red, 60 yellow, 120 green, 180 cyan, 240 blue, 300 magenta).
import { defineOp, opOf, smooth, type ImageOp } from "../op.ts";
import { linToOklab, oklabToLin } from "../color.ts";
import { toLinear } from "../raster.ts";

/** The OKLab a/b unit direction of a colour-wheel hue (the fully saturated HSL colour of that hue). */
export function hueDirection(deg: number): [number, number] {
  const h = (((deg % 360) + 360) % 360) / 60, x = 1 - Math.abs((h % 2) - 1);
  const [r, g, b] = h < 1 ? [1, x, 0] : h < 2 ? [x, 1, 0] : h < 3 ? [0, 1, x] : h < 4 ? [0, x, 1] : h < 5 ? [x, 0, 1] : [1, 0, x];
  const lab = [0, 0, 0];
  linToOklab(toLinear(r), toLinear(g), toLinear(b), lab);
  const n = Math.hypot(lab[1]!, lab[2]!) || 1;
  return [lab[1]! / n, lab[2]! / n];
}

export interface SplitToneParams {
  /** Colour-wheel degrees 0–360. */ highlightHue: number;
  /** 0–100. */ highlightSaturation: number;
  /** Colour-wheel degrees 0–360. */ shadowHue: number;
  /** 0–100. */ shadowSaturation: number;
  /** −100 (more shadow tint) … 100 (more highlight tint). */ balance: number;
}

const lab = new Float32Array(3);
export const SPLIT_TONE = defineOp<SplitToneParams>({
  type: "split-tone", kind: "color",
  defaults: { highlightHue: 45, highlightSaturation: 0, shadowHue: 220, shadowSaturation: 0, balance: 0 },
  params: {
    highlightHue: { min: 0, max: 360, step: 1, default: 45, unit: "°" },
    highlightSaturation: { min: 0, max: 100, step: 1, default: 0 },
    shadowHue: { min: 0, max: 360, step: 1, default: 220, unit: "°" },
    shadowSaturation: { min: 0, max: 100, step: 1, default: 0 },
    balance: { min: -100, max: 100, step: 1, default: 0, centered: true },
  },
  identity: (p) => !p.highlightSaturation && !p.shadowSaturation,
  prepare: (p) => ({ hi: hueDirection(p.highlightHue), sh: hueDirection(p.shadowHue) }),
  colorWith: (c, p, data) => {
    const { hi, sh } = data as { hi: [number, number]; sh: [number, number] };
    linToOklab(Math.max(0, c[0]!), Math.max(0, c[1]!), Math.max(0, c[2]!), lab);
    const L = lab[0]!, pivot = 0.5 - (p.balance / 100) * 0.3, t = smooth(pivot - 0.4, pivot + 0.4, L);
    const ks = (1 - t) * (p.shadowSaturation / 100) * 0.09 * smooth(0, 0.15, L), kh = t * (p.highlightSaturation / 100) * 0.09;
    oklabToLin(L, lab[1]! + sh[0] * ks + hi[0] * kh, lab[2]! + sh[1] * ks + hi[1] * kh, c);
  },
});
/** Split toning: `splitTone({ highlightHue: 40, highlightSaturation: 30, shadowHue: 200, shadowSaturation: 25 })`. */
export const splitTone = (params: Partial<SplitToneParams> = {}): ImageOp<SplitToneParams> => opOf(SPLIT_TONE, params);
