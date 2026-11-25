// hsl: an eight-band colour mixer: each band (red, orange, yellow, green, aqua, blue, purple, magenta) gets its own hue
// shift, saturation and luminance. Bands sit at OKLCh hue centres and overlap smoothly; greys are left alone.
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { withLch } from "../color.ts";

/** A colour band of the mixer: id, English label (components translate it), OKLCh hue centre in degrees. */
export interface HslBand { id: string; label: string; hue: number }
/** The eight bands, in hue order. */
export const HSL_BANDS: readonly HslBand[] = [
  { id: "red", label: "Red", hue: 25 },
  { id: "orange", label: "Orange", hue: 55 },
  { id: "yellow", label: "Yellow", hue: 100 },
  { id: "green", label: "Green", hue: 142 },
  { id: "aqua", label: "Aqua", hue: 195 },
  { id: "blue", label: "Blue", hue: 264 },
  { id: "purple", label: "Purple", hue: 300 },
  { id: "magenta", label: "Magenta", hue: 335 },
];

/**
 * Band weights for a hue (into `out`, 8 numbers summing to 1): the two band centres around the hue share it with a
 * cosine ease, so a slider moves the colours near its centre fully and fades out halfway to the next band.
 */
export function bandWeights(h: number, out: Float32Array | number[]): void {
  const n = HSL_BANDS.length;
  for (let i = 0; i < n; i++) out[i] = 0;
  const hh = ((h % 360) + 360) % 360;
  for (let i = 0; i < n; i++) {
    const a = HSL_BANDS[i]!.hue, b = HSL_BANDS[(i + 1) % n]!.hue, span = (b - a + 360) % 360, d = (hh - a + 360) % 360;
    if (d <= span) { const t = (1 - Math.cos((Math.PI * d) / span)) / 2; out[i] = 1 - t; out[(i + 1) % n] = t; return; }
  }
}

export interface HslParams {
  /** Hue shift per band −100…100 (±30°). */ hue: number[];
  /** Saturation per band −100…100. */ saturation: number[];
  /** Luminance per band −100…100. */ luminance: number[];
}
const zeros = (): number[] => [0, 0, 0, 0, 0, 0, 0, 0];
const allZero = (a: readonly number[] | undefined): boolean => !a || a.every((v) => !v);

const w = new Float32Array(8);
export const HSL = defineOp<HslParams>({
  type: "hsl", kind: "color",
  defaults: { hue: zeros(), saturation: zeros(), luminance: zeros() },
  identity: (p) => allZero(p.hue) && allZero(p.saturation) && allZero(p.luminance),
  color: (c, p) => withLch(c, (l) => {
    if (l[1] < 1e-5) return;
    bandWeights(l[2], w);
    let dh = 0, ds = 0, dl = 0;
    for (let i = 0; i < 8; i++) { const k = w[i]!; if (!k) continue; dh += k * (p.hue[i] ?? 0); ds += k * (p.saturation[i] ?? 0); dl += k * (p.luminance[i] ?? 0); }
    const grey = Math.min(1, l[1] / 0.08);
    l[2] += (dh / 100) * 30;
    l[1] *= Math.max(0, 1 + ds / 100);
    l[0] *= Math.max(0, 1 + (dl / 100) * 0.35 * grey);
  }),
});
/** Eight-band mixer: `hsl({ saturation: [0, 0, 0, 0, 0, -60, 0, 0] })` mutes the blues. */
export const hsl = (params: Partial<HslParams> = {}): ImageOp<HslParams> => opOf(HSL, params);
