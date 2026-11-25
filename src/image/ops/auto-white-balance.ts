// auto-white-balance: not an op itself: finds the temperature and tint that neutralise a colour cast, either from the
// whole image (grey world blended with the brightest patch) or from a neutral point the user picked (eyedropper).
// Returns ordinary temperature and tint ops.
import type { ImageOp } from "../op.ts";
import { luminance, type Raster } from "../raster.ts";
import { temperature, wbGains } from "./temperature.ts";
import { tint } from "./tint.ts";

/** The temperature and tint pair as the engine's op type. */
const pair = (t: number, n: number): [ImageOp, ImageOp] => [temperature(t) as ImageOp<object> as ImageOp, tint(n) as ImageOp<object> as ImageOp];

/** How far a colour is from neutral under temperature t, tint n (squared log ratios against green). */
function castError(rgb: readonly number[], t: number, n: number): number {
  const a = wbGains(t, 0), b = wbGains(0, n);
  const r = rgb[0]! * a[0] * b[0], g = rgb[1]! * a[1] * b[1], bl = rgb[2]! * a[2] * b[2];
  return Math.log(r / g) ** 2 + Math.log(bl / g) ** 2;
}

/** The temperature and tint (−100…100) that make a linear colour neutral. */
function solve(rgb: readonly number[]): [number, number] {
  const c = rgb.map((v) => Math.max(1e-5, v));
  let bt = 0, bn = 0, best = castError(c, 0, 0);
  for (const step of [20, 4, 1, 0.2]) {
    const t0 = bt, n0 = bn;
    for (let i = -5; i <= 5; i++) for (let j = -5; j <= 5; j++) {
      const t = Math.max(-100, Math.min(100, t0 + i * step)), n = Math.max(-100, Math.min(100, n0 + j * step)), e = castError(c, t, n);
      if (e < best) { best = e; bt = t; bn = n; }
    }
  }
  return [Math.round(bt), Math.round(bn)];
}

/** Temperature and tint ops that turn a picked colour (linear RGB) neutral grey. */
export function whiteBalanceFrom(rgbLinear: readonly number[]): [ImageOp, ImageOp] {
  const [t, n] = solve(rgbLinear);
  return pair(t, n);
}

/** Temperature and tint ops from the image itself: grey-world average blended with the brightest unclipped patch. */
export function autoWhiteBalance(r: Raster): [ImageOp, ImageOp] {
  const d = r.data, n = r.width * r.height, step = Math.max(1, Math.floor(n / 200_000));
  const grey: [number, number, number] = [0, 0, 0], ys: number[] = [];
  let count = 0;
  for (let p = 0; p < n; p += step) {
    const i = p * 4, y = luminance(d[i]!, d[i + 1]!, d[i + 2]!);
    if (d[i + 3]! < 0.5 || y < 0.01 || Math.max(d[i]!, d[i + 1]!, d[i + 2]!) > 0.98) continue;
    grey[0] += d[i]! / y; grey[1] += d[i + 1]! / y; grey[2] += d[i + 2]! / y; count++;
    ys.push(y);
  }
  if (!count) return pair(0, 0);
  ys.sort((a, b) => a - b);
  const cut = ys[Math.floor(ys.length * 0.95)]!, bright: [number, number, number] = [0, 0, 0];
  let nb = 0;
  for (let p = 0; p < n; p += step) {
    const i = p * 4, y = luminance(d[i]!, d[i + 1]!, d[i + 2]!);
    if (d[i + 3]! < 0.5 || y < cut || Math.max(d[i]!, d[i + 1]!, d[i + 2]!) > 0.98) continue;
    bright[0] += d[i]! / y; bright[1] += d[i + 1]! / y; bright[2] += d[i + 2]! / y; nb++;
  }
  const est = [0, 1, 2].map((k) => 0.5 * (grey[k]! / count) + 0.5 * (nb ? bright[k]! / nb : grey[k]! / count));
  return whiteBalanceFrom(est);
}
