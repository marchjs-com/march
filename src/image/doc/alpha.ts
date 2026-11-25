// Single-channel helpers shared by selections, masks and layer effects: box blur (three passes ≈ Gaussian), grow and
// shrink (distance-based), float coverage reading.

import type { Mask, Rect } from "./tiles.ts";
import { gaussPlane } from "../blur.ts";

/** Blur a float plane in place (Gaussian, sigma = radius / 2): the engine's gaussPlane (march/image). */
export function blurPlane(a: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius <= 0.25) return a;
  a.set(gaussPlane(a, w, h, radius / 2));
  return a;
}

/**
 * Euclidean distance transform (Felzenszwalb) of a binary plane: distance from each pixel to the nearest "on" pixel.
 * Used for expand / contract / border, stroke and spread.
 */
export function distanceTo(on: (i: number) => boolean, w: number, h: number): Float32Array {
  const INF = 1e20, d = new Float32Array(w * h);
  for (let i = 0; i < d.length; i++) d[i] = on(i) ? 0 : INF;
  const f = new Float64Array(Math.max(w, h)), z = new Float64Array(Math.max(w, h) + 1), v = new Int32Array(Math.max(w, h)), out = new Float64Array(Math.max(w, h));
  const pass = (n: number, get: (i: number) => number, set: (i: number, x: number) => void): void => {
    for (let q = 0; q < n; q++) f[q] = get(q);
    let k = 0;
    v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < n; q++) {
      let s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!);
      while (s <= z[k]!) { k--; s = ((f[q]! + q * q) - (f[v[k]!]! + v[k]! * v[k]!)) / (2 * q - 2 * v[k]!); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < n; q++) { while (z[k + 1]! < q) k++; out[q] = (q - v[k]!) * (q - v[k]!) + f[v[k]!]!; }
    for (let q = 0; q < n; q++) set(q, out[q]!);
  };
  for (let x = 0; x < w; x++) pass(h, (y) => d[y * w + x]!, (y, val) => { d[y * w + x] = val; });
  for (let y = 0; y < h; y++) pass(w, (x) => d[y * w + x]!, (x, val) => { d[y * w + x] = val; });
  for (let i = 0; i < d.length; i++) d[i] = Math.sqrt(d[i]!);
  return d;
}

/** Coverage 0–1 of a mask over a region. */
export function maskCoverage(m: Mask, r: Rect, out = new Float32Array(r.w * r.h)): Float32Array {
  const inv = 1 / 255;
  for (let y = 0; y < r.h; y++) {
    const sy = r.y + y;
    for (let x = 0; x < r.w; x++) {
      const sx = r.x + x;
      out[y * r.w + x] = (sx < 0 || sy < 0 || sx >= m.width || sy >= m.height ? m.outside : m.data[sy * m.width + sx]!) * inv;
    }
  }
  return out;
}

/** A mask's values as floats for the whole mask. */
export function maskToPlane(m: Mask): Float32Array {
  const p = new Float32Array(m.data.length);
  for (let i = 0; i < p.length; i++) p[i] = m.data[i]! / 255;
  return p;
}
export function planeToMask(p: Float32Array, m: Mask): void {
  const d = m.writable();
  for (let i = 0; i < p.length; i++) d[i] = Math.round(Math.max(0, Math.min(1, p[i]!)) * 255);
}
