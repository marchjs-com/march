// Shared neighbourhood helpers for spatial ops: a fast Gaussian (three box passes, O(1) per pixel at any radius) on a
// single channel or on all four, luminance planes, and a high-pass "detail" layer (clarity, texture, sharpen).
import { luminance, type Raster } from "./raster.ts";

/** Box radii for three passes approximating a Gaussian of sigma. */
function boxes(sigma: number): [number, number, number] {
  const n = 3, wIdeal = Math.sqrt((12 * sigma * sigma) / n + 1);
  let wl = Math.floor(wIdeal); if (wl % 2 === 0) wl--;
  const wu = wl + 2, m = Math.round((12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4));
  const r = (i: number): number => ((i < m ? wl : wu) - 1) / 2;
  return [r(0), r(1), r(2)];
}

/** One box pass along rows (horizontal) of a strided plane, from src to dst. */
function boxH(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, stride: number, ch: number): void {
  const iarr = 1 / (r + r + 1);
  for (let y = 0; y < h; y++) {
    const row = y * w;
    const first = src[row * stride + ch]!;
    let val = (r + 1) * first;
    for (let j = 0; j < r; j++) val += src[(row + Math.min(j, w - 1)) * stride + ch]!;
    for (let x = 0; x < w; x++) {
      val += src[(row + Math.min(x + r, w - 1)) * stride + ch]! - (x - r - 1 >= 0 ? src[(row + x - r - 1) * stride + ch]! : first);
      dst[(row + x) * stride + ch] = val * iarr;
    }
  }
}
/** One box pass along columns. */
function boxV(src: Float32Array, dst: Float32Array, w: number, h: number, r: number, stride: number, ch: number): void {
  const iarr = 1 / (r + r + 1);
  for (let x = 0; x < w; x++) {
    const first = src[x * stride + ch]!;
    let val = (r + 1) * first;
    for (let j = 0; j < r; j++) val += src[(Math.min(j, h - 1) * w + x) * stride + ch]!;
    for (let y = 0; y < h; y++) {
      val += src[(Math.min(y + r, h - 1) * w + x) * stride + ch]! - (y - r - 1 >= 0 ? src[((y - r - 1) * w + x) * stride + ch]! : first);
      dst[(y * w + x) * stride + ch] = val * iarr;
    }
  }
}

/** Gaussian blur of a plane with `stride` floats per pixel, channels `chs` (new array; the input is not changed). */
export function gaussPlane(src: Float32Array, w: number, h: number, sigma: number, stride = 1, chs: readonly number[] = [0]): Float32Array {
  const out = src.slice();
  if (sigma < 0.3 || w < 2 || h < 2) return out;
  const tmp = new Float32Array(src.length);
  for (const r of boxes(sigma)) {
    if (r < 1) continue;
    for (const c of chs) { boxH(out, tmp, w, h, r, stride, c); boxV(tmp, out, w, h, r, stride, c); }
  }
  return out;
}

/** Gaussian blur of a raster (RGB, and alpha when `alpha`), as a new raster. */
export function gaussian(r: Raster, sigma: number, alpha = false): Raster {
  return { width: r.width, height: r.height, space: r.space, data: gaussPlane(r.data, r.width, r.height, sigma, 4, alpha ? [0, 1, 2, 3] : [0, 1, 2]) };
}

/** Luminance plane (linear) of a raster. */
export function lumaPlane(r: Raster): Float32Array {
  const n = r.width * r.height, out = new Float32Array(n), d = r.data;
  for (let i = 0, j = 0; i < n; i++, j += 4) out[i] = luminance(d[j]!, d[j + 1]!, d[j + 2]!);
  return out;
}

/** Perceptual lightness plane (cube root of luminance, ≈ OKLab L), where local contrast feels even. */
export function lightPlane(r: Raster): Float32Array {
  const l = lumaPlane(r);
  for (let i = 0; i < l.length; i++) l[i] = Math.cbrt(Math.max(0, l[i]!));
  return l;
}

/**
 * Add local contrast: each pixel's lightness moves away from its blurred surroundings by `amount` (−1…1 and beyond),
 * scaled by `weight(L)` (midtone protection), keeping hue. Clarity, texture and sharpening are this at different radii.
 */
export function localContrast(r: Raster, sigma: number, amount: number, weight: (L: number) => number = () => 1): Raster {
  if (!amount) return r;
  const L = lightPlane(r), B = gaussPlane(L, r.width, r.height, sigma), d = r.data, n = r.width * r.height;
  for (let i = 0, j = 0; i < n; i++, j += 4) {
    const l = L[i]!, nl = Math.max(0, l + (l - B[i]!) * amount * weight(l));
    const k = l > 1e-5 ? (nl / l) ** 3 : 1;
    d[j] = d[j]! * k; d[j + 1] = d[j + 1]! * k; d[j + 2] = d[j + 2]! * k;
  }
  return r;
}
