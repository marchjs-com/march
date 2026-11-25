// auto-tone: not an op itself: reads an image's histogram and returns the ops a careful editor would start with:
// levels that stretch the tones to the full range with a midtone gamma, a touch of exposure when the gamma alone
// cannot centre the image, contrast for flat images and vibrance for dull colours. The result is an ordinary edit
// list the user can see and change.
import type { ImageOp } from "../op.ts";
import { histogram, percentile, meanOf } from "../analysis.ts";
import { linToOklab } from "../color.ts";
import { toLinear, type Raster } from "../raster.ts";
import { levels } from "./levels.ts";
import { exposure } from "./exposure.ts";
import { contrast } from "./contrast.ts";
import { vibrance } from "./vibrance.ts";

const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
const round = (v: number, step: number): number => Math.round(v / step) * step;

/** Mean OKLab chroma of a raster (sampled). */
function meanChroma(r: Raster): number {
  const d = r.data, n = r.width * r.height, step = Math.max(1, Math.floor(n / 50_000)), lab = [0, 0, 0];
  let s = 0, c = 0;
  for (let p = 0; p < n; p += step) {
    const i = p * 4;
    linToOklab(Math.max(0, d[i]!), Math.max(0, d[i + 1]!), Math.max(0, d[i + 2]!), lab);
    s += Math.hypot(lab[1]!, lab[2]!); c++;
  }
  return c ? s / c : 0;
}

/** Ops that tone an image automatically (empty when it already uses the range well). */
export function autoTone(r: Raster): ImageOp[] {
  const h = histogram(r);
  if (!h.total) return [];
  const ops: ImageOp<object>[] = [];
  const lo = percentile(h.l, 0.005), hi = Math.max(lo + 16, percentile(h.l, 0.995));
  const inBlack = lo > 2 ? lo / 255 : 0, inWhite = hi < 253 ? hi / 255 : 1;
  const span = inWhite - inBlack;
  // where the mean and the quartiles land after the stretch
  const at = (v: number): number => clamp((v / 255 - inBlack) / span, 0.001, 0.999);
  const mean = at(meanOf(h.l));
  const gamma = round(clamp(Math.log(mean) / Math.log(0.46), 0.6, 1.6), 0.01);
  const after = (v: number): number => at(v) ** (1 / gamma);
  if (inBlack > 0 || inWhite < 1 || Math.abs(gamma - 1) > 0.03) ops.push(levels({ inBlack: round(inBlack, 0.001), inWhite: round(inWhite, 0.001), gamma }));
  const m2 = mean ** (1 / gamma);
  if (Math.abs(m2 - 0.46) > 0.05) {
    const ev = round(clamp(Math.log2(toLinear(0.46) / toLinear(m2)), -1, 1), 0.05);
    if (ev) ops.push(exposure(ev));
  }
  const iqr = after(percentile(h.l, 0.75)) - after(percentile(h.l, 0.25));
  const c = Math.round(clamp(((0.32 - iqr) / 0.32) * 50, 0, 35));
  if (c >= 3) ops.push(contrast(c));
  const chroma = meanChroma(r);
  const v = Math.round(clamp(((0.05 - chroma) / 0.05) * 40, 0, 30));
  if (v >= 3 && chroma > 0.004) ops.push(vibrance(v));
  return ops as ImageOp[];
}
