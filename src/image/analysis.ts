// Reading an image: histograms (per channel and luminance, on the encoded 0–255 scale people know), clipping, stats,
// and colour samples (eyedropper). Auto tone and white balance build ops from these (ops/auto-tone, ops/white-balance).
import { encodeFast, luminance, type Raster } from "./raster.ts";

/** Histogram counts per channel (256 bins each) and clipping shares. */
export interface Histogram {
  r: Uint32Array; g: Uint32Array; b: Uint32Array;
  /** Luminance (encoded). */
  l: Uint32Array;
  /** Pixels counted (sampled). */
  total: number;
  /** Share of pixels with a channel at 0 / at 255 (shadow / highlight clipping). */
  clipLow: number;
  clipHigh: number;
}

/** Histogram of a raster (every pixel up to ~1 MP, sampled beyond: the shape is the same). */
export function histogram(r: Raster, opts: { bins?: 256 | undefined } = {}): Histogram {
  void opts;
  const R = new Uint32Array(256), G = new Uint32Array(256), B = new Uint32Array(256), L = new Uint32Array(256), d = r.data;
  const n = r.width * r.height, step = Math.max(1, Math.floor(n / 1_000_000));
  let total = 0, lo = 0, hi = 0;
  for (let p = 0; p < n; p += step) {
    const i = p * 4;
    if (d[i + 3]! < 0.01) continue;
    const er = (encodeFast(d[i]!) * 255 + 0.5) | 0, eg = (encodeFast(d[i + 1]!) * 255 + 0.5) | 0, eb = (encodeFast(d[i + 2]!) * 255 + 0.5) | 0;
    R[er]!++; G[eg]!++; B[eb]!++;
    L[(encodeFast(luminance(d[i]!, d[i + 1]!, d[i + 2]!)) * 255 + 0.5) | 0]!++;
    if (er === 0 || eg === 0 || eb === 0) lo++;
    if (er === 255 || eg === 255 || eb === 255) hi++;
    total++;
  }
  return { r: R, g: G, b: B, l: L, total, clipLow: total ? lo / total : 0, clipHigh: total ? hi / total : 0 };
}

/** The value below which `q` (0–1) of the counts lie (0–255). */
export function percentile(bins: Uint32Array, q: number): number {
  let total = 0; for (const c of bins) total += c;
  const target = total * q;
  let acc = 0;
  for (let i = 0; i < bins.length; i++) { acc += bins[i]!; if (acc >= target) return i; }
  return bins.length - 1;
}

/** Mean of a bin array (0–255). */
export function meanOf(bins: Uint32Array): number {
  let s = 0, n = 0; for (let i = 0; i < bins.length; i++) { s += i * bins[i]!; n += bins[i]!; }
  return n ? s / n : 0;
}

/** Average linear colour in a square of `radius` px around x, y (eyedropper). Returns [r, g, b, a]. */
export function sampleColor(r: Raster, x: number, y: number, radius = 0): [number, number, number, number] {
  const out: [number, number, number, number] = [0, 0, 0, 0];
  let n = 0;
  for (let yy = Math.max(0, Math.round(y) - radius); yy <= Math.min(r.height - 1, Math.round(y) + radius); yy++)
    for (let xx = Math.max(0, Math.round(x) - radius); xx <= Math.min(r.width - 1, Math.round(x) + radius); xx++) {
      const i = (yy * r.width + xx) * 4;
      for (let k = 0; k < 4; k++) out[k] = out[k]! + r.data[i + k]!;
      n++;
    }
  return n ? (out.map((v) => v / n) as [number, number, number, number]) : out;
}

/** A linear colour as #rrggbb (encoded). */
export const hexOf = (rgb: readonly number[]): string => `#${[0, 1, 2].map((k) => Math.round(encodeFast(rgb[k]!) * 255).toString(16).padStart(2, "0")).join("")}`;
