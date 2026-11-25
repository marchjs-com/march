// bw: black and white through a colour mixer: each hue band (red … magenta) is rendered lighter or darker in the grey
// (100 % keeps a colour's own lightness, 0 darkens it, 200 brightens it), then an optional tint (sepia, selenium…).
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { linToOklab, oklabToLin } from "../color.ts";
import { bandWeights } from "./hsl.ts";
import { hueDirection } from "./split-tone.ts";

export interface BwParams {
  /** Band weights in % (−200…300; 100 keeps the colour's own lightness). */
  red: number; orange: number; yellow: number; green: number; aqua: number; blue: number; purple: number; magenta: number;
  /** Tint colour-wheel hue 0–360. */ tintHue: number;
  /** Tint strength 0–100 (0: neutral grey). */ tintAmount: number;
}
const BANDS = ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"] as const;
const band = { min: -200, max: 300, step: 1, default: 100, unit: "%" };

const lab = new Float32Array(3), w = new Float32Array(8);
export const BW = defineOp<BwParams>({
  type: "bw", kind: "color",
  defaults: { red: 100, orange: 100, yellow: 100, green: 100, aqua: 100, blue: 100, purple: 100, magenta: 100, tintHue: 40, tintAmount: 0 },
  params: {
    red: band, orange: band, yellow: band, green: band, aqua: band, blue: band, purple: band, magenta: band,
    tintHue: { min: 0, max: 360, step: 1, default: 40, unit: "°" },
    tintAmount: { min: 0, max: 100, step: 1, default: 0 },
  },
  prepare: (p) => hueDirection(p.tintHue),
  colorWith: (c, p, data) => {
    linToOklab(Math.max(0, c[0]!), Math.max(0, c[1]!), Math.max(0, c[2]!), lab);
    const C = Math.hypot(lab[1]!, lab[2]!);
    let L = lab[0]!;
    if (C > 1e-5) {
      bandWeights((Math.atan2(lab[2]!, lab[1]!) * 180) / Math.PI, w);
      let W = 0;
      for (let i = 0; i < 8; i++) W += w[i]! * p[BANDS[i]!];
      L = Math.max(0, L * (1 + (W / 100 - 1) * Math.min(1, C / 0.2) * 0.8));
    }
    const dir = data as [number, number], k = Math.max(0, (p.tintAmount / 100) * 0.06 * Math.min(1, L * 4) * Math.min(1, (1.05 - L) * 4));
    oklabToLin(L, dir[0] * k, dir[1] * k, c);
  },
  css: (p) => (!p.tintAmount && BANDS.every((b) => p[b] === 100) ? "grayscale(1)" : null),
});
/** Black and white: `bw()` neutral, `bw({ red: 140, blue: 40 })` bright skin and dark sky, `bw({ tintAmount: 40 })` sepia. */
export const bw = (params: Partial<BwParams> = {}): ImageOp<BwParams> => opOf(BW, params);
