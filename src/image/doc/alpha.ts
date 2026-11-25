// Single-channel helpers shared by selections, masks and layer effects: box blur (three passes ≈ Gaussian), grow and
// shrink (distance-based), float coverage reading.

import type { Mask, Rect } from "./tiles.ts";

/** Blur a float plane in place: three box passes approximate a Gaussian of the given radius (sigma ≈ radius / 2). */
export function blurPlane(a: Float32Array, w: number, h: number, radius: number): Float32Array {
  if (radius <= 0.25) return a;
  const sigma = radius / 2;
  // box sizes for 3 passes (Kovesi)
  const n = 3, wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal);
  if (wl % 2 === 0) wl--;
  const m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  const tmp = new Float32Array(a.length);
  for (let i = 0; i < n; i++) {
    const r = ((i < m ? wl : wl + 2) - 1) / 2;
    if (r < 1) continue;
    boxH(a, tmp, w, h, r);
    boxV(tmp, a, w, h, r);
  }
  return a;
}

function boxH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const k = 1 / (r + r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    let acc = 0;
    for (let x = -r - 1; x < r; x++) acc += src[row + Math.min(w - 1, Math.max(0, x))]!;
    for (let x = 0; x < w; x++) {
      acc += src[row + Math.min(w - 1, x + r)]! - src[row + Math.max(0, x - r - 1)]!;
      dst[row + x] = acc * k;
    }
  }
}
function boxV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number): void {
  const k = 1 / (r + r + 1);
  for (let x = 0; x < w; x++) {
    let acc = 0;
    for (let y = -r - 1; y < r; y++) acc += src[Math.min(h - 1, Math.max(0, y)) * w + x]!;
    for (let y = 0; y < h; y++) {
      acc += src[Math.min(h - 1, y + r) * w + x]! - src[Math.max(0, y - r - 1) * w + x]!;
      dst[y * w + x] = acc * k;
    }
  }
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
