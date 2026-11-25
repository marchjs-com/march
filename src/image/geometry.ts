// Geometry helpers the geometry ops share: inverse mapping (every output pixel asks where it comes from, bilinear,
// premultiplied so transparent edges do not fringe), affine and homography warps, exact 90° turns and mirrors, a
// separable Lanczos-3 resize, the largest upright rectangle inside a rotated one, and fill colours.
// Coordinates: continuous pixel space, pixel i covers [i, i + 1] (its centre is i + 0.5); rotation angles are degrees,
// positive = clockwise on screen (y points down), as canvas `rotate` does.
import { raster, type Raster } from "./raster.ts";
import { hexToLin } from "./color.ts";

/** A rectangle in 0–1 fractions of an image. */
export interface FracRect { x: number; y: number; w: number; h: number }
/** A point [x, y]. */
export type Pt = readonly [number, number];

export const rad = (deg: number): number => (deg * Math.PI) / 180;
const clampN = (v: number, lo: number, hi: number): number => (v < lo ? lo : v > hi ? hi : v);

/** A fill colour: "#rgb" / "#rrggbb" (linear RGBA, opaque) or "transparent" / empty (all zero). */
export function paint(color: string | null | undefined): [number, number, number, number] {
  if (!color || color === "transparent") return [0, 0, 0, 0];
  const [r, g, b] = hexToLin(color);
  return [r, g, b, 1];
}

/** A raster filled with one colour. */
export function filled(w: number, h: number, color: readonly number[], space: Raster["space"] = "srgb"): Raster {
  const out = raster(w, h, space), d = out.data;
  if (color[0] || color[1] || color[2] || color[3]) for (let i = 0; i < d.length; i += 4) { d[i] = color[0]!; d[i + 1] = color[1]!; d[i + 2] = color[2]!; d[i + 3] = color[3]!; }
  return out;
}

/** Draw `src` over `dst` at integer x, y ("over", straight alpha), clipped to dst; `mask` (src size, 0–1) scales its alpha. */
export function drawOver(dst: Raster, src: Raster, x: number, y: number, mask?: Float32Array | null): void {
  const D = dst.data, S = src.data, W = dst.width, H = dst.height;
  for (let sy = 0; sy < src.height; sy++) {
    const ty = y + sy;
    if (ty < 0 || ty >= H) continue;
    for (let sx = 0; sx < src.width; sx++) {
      const tx = x + sx;
      if (tx < 0 || tx >= W) continue;
      const si = (sy * src.width + sx) * 4, di = (ty * W + tx) * 4;
      const a = S[si + 3]! * (mask ? mask[sy * src.width + sx]! : 1);
      if (a <= 0) continue;
      const b = D[di + 3]!, oa = a + b * (1 - a);
      if (oa <= 0) continue;
      for (let k = 0; k < 3; k++) D[di + k] = (S[si + k]! * a + D[di + k]! * b * (1 - a)) / oa;
      D[di + 3] = oa;
    }
  }
}

/** Put a raster on a solid background (same size): a new raster. */
export function flatten(r: Raster, color: readonly number[]): Raster {
  const out = filled(r.width, r.height, color, r.space);
  drawOver(out, r, 0, 0);
  return out;
}

/**
 * Bilinear sample at index coordinates (pixel i's centre is i), premultiplied, written to out[o..o+3] (straight alpha).
 * edge "clamp" repeats the border; "transparent" fades to nothing over the half pixel past the border.
 */
export function bilinearAt(r: Raster, x: number, y: number, out: Float32Array, o: number, edge: "clamp" | "transparent"): void {
  const W = r.width, H = r.height, s = r.data;
  let cover = 1;
  if (edge === "transparent") {
    cover = clampN(x + 1, 0, 1) * clampN(W - x, 0, 1) * clampN(y + 1, 0, 1) * clampN(H - y, 0, 1);
    if (cover <= 0) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; return; }
  }
  x = clampN(x, 0, W - 1); y = clampN(y, 0, H - 1);
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = x0 + 1 < W ? x0 + 1 : x0, y1 = y0 + 1 < H ? y0 + 1 : y0, tx = x - x0, ty = y - y0;
  const i00 = (y0 * W + x0) * 4, i01 = (y0 * W + x1) * 4, i10 = (y1 * W + x0) * 4, i11 = (y1 * W + x1) * 4;
  const w00 = (1 - tx) * (1 - ty), w01 = tx * (1 - ty), w10 = (1 - tx) * ty, w11 = tx * ty;
  const a00 = s[i00 + 3]! * w00, a01 = s[i01 + 3]! * w01, a10 = s[i10 + 3]! * w10, a11 = s[i11 + 3]! * w11;
  const a = a00 + a01 + a10 + a11;
  if (a <= 1e-9) { out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0; return; }
  for (let k = 0; k < 3; k++) out[o + k] = (s[i00 + k]! * a00 + s[i01 + k]! * a01 + s[i10 + k]! * a10 + s[i11 + k]! * a11) / a;
  out[o + 3] = a * cover;
}

/**
 * Affine inverse mapping: output pixel centre (x, y) reads the source at (m0·x + m1·y + m2, m3·x + m4·y + m5)
 * (continuous coordinates on both sides).
 */
export function warpAffine(src: Raster, w: number, h: number, m: readonly number[], edge: "clamp" | "transparent" = "transparent"): Raster {
  const out = raster(w, h, src.space), d = out.data;
  const [a, b, c, e, f, g] = m as [number, number, number, number, number, number];
  for (let y = 0; y < h; y++) {
    const cy = y + 0.5;
    for (let x = 0; x < w; x++) {
      const cx = x + 0.5;
      bilinearAt(src, a * cx + b * cy + c - 0.5, e * cx + f * cy + g - 0.5, d, (y * w + x) * 4, edge);
    }
  }
  return out;
}

/** Homography inverse mapping: output pixel centre p reads the source at H·p (H row-major 3×3, continuous coordinates). */
export function warpHomography(src: Raster, w: number, h: number, H: readonly number[], edge: "clamp" | "transparent" = "transparent"): Raster {
  const out = raster(w, h, src.space), d = out.data;
  for (let y = 0; y < h; y++) {
    const cy = y + 0.5;
    for (let x = 0; x < w; x++) {
      const cx = x + 0.5, z = H[6]! * cx + H[7]! * cy + H[8]!;
      const o = (y * w + x) * 4;
      if (Math.abs(z) < 1e-12) { d[o] = d[o + 1] = d[o + 2] = d[o + 3] = 0; continue; }
      bilinearAt(src, (H[0]! * cx + H[1]! * cy + H[2]!) / z - 0.5, (H[3]! * cx + H[4]! * cy + H[5]!) / z - 0.5, d, o, edge);
    }
  }
  return out;
}

/** The homography (row-major 3×3, h22 = 1) that maps the four `from` points onto the four `to` points. */
export function solveHomography(from: readonly Pt[], to: readonly Pt[]): number[] {
  // 8 equations, 8 unknowns: Gaussian elimination with partial pivoting
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = from[i]!, [u, v] = to[i]!;
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r]![c]!) > Math.abs(A[p]![c]!)) p = r;
    [A[c], A[p]] = [A[p]!, A[c]!];
    const piv = A[c]![c]!;
    if (Math.abs(piv) < 1e-12) return [1, 0, 0, 0, 1, 0, 0, 0, 1];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const k = A[r]![c]! / piv;
      if (k) for (let j = c; j < 9; j++) A[r]![j] = A[r]![j]! - k * A[c]![j]!;
    }
  }
  const hm = A.map((row, i) => row[8]! / row[i]!);
  return [...hm, 1];
}

/** Turn a raster by quarter turns clockwise (exact: pixels move, nothing is resampled). */
export function rotate90(r: Raster, turns: number): Raster {
  const t = ((Math.round(turns) % 4) + 4) % 4, W = r.width, H = r.height, s = r.data;
  if (t === 0) return { width: W, height: H, data: s.slice(), space: r.space };
  const ow = t === 2 ? W : H, oh = t === 2 ? H : W, out = raster(ow, oh, r.space), d = out.data;
  for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
    // where output (x, y) comes from
    const sx = t === 1 ? y : t === 2 ? W - 1 - x : W - 1 - y;
    const sy = t === 1 ? H - 1 - x : t === 2 ? H - 1 - y : x;
    const i = (sy * W + sx) * 4, o = (y * ow + x) * 4;
    d[o] = s[i]!; d[o + 1] = s[i + 1]!; d[o + 2] = s[i + 2]!; d[o + 3] = s[i + 3]!;
  }
  return out;
}

/** Mirror a raster (exact). */
export function mirror(r: Raster, horizontal: boolean, vertical: boolean): Raster {
  const W = r.width, H = r.height, s = r.data, out = raster(W, H, r.space), d = out.data;
  for (let y = 0; y < H; y++) {
    const sy = vertical ? H - 1 - y : y;
    for (let x = 0; x < W; x++) {
      const i = (sy * W + (horizontal ? W - 1 - x : x)) * 4, o = (y * W + x) * 4;
      d[o] = s[i]!; d[o + 1] = s[i + 1]!; d[o + 2] = s[i + 2]!; d[o + 3] = s[i + 3]!;
    }
  }
  return out;
}

/** Copy an integer rectangle out of a raster (clipped). */
export function subRaster(r: Raster, x: number, y: number, w: number, h: number): Raster {
  const out = raster(w, h, r.space), d = out.data, s = r.data;
  for (let yy = 0; yy < h; yy++) {
    const sy = y + yy;
    if (sy < 0 || sy >= r.height) continue;
    const x0 = Math.max(0, x), x1 = Math.min(r.width, x + w);
    if (x1 > x0) d.set(s.subarray((sy * r.width + x0) * 4, (sy * r.width + x1) * 4), (yy * w + (x0 - x)) * 4);
  }
  return out;
}

/** Size of the largest upright rectangle inside a w × h rectangle turned by `deg` degrees. */
export function innerRect(w: number, h: number, deg: number): [number, number] {
  const a = rad(deg), s = Math.abs(Math.sin(a)), c = Math.abs(Math.cos(a));
  if (s < 1e-10) return [w, h];
  if (c < 1e-10) return [h, w];
  const long = Math.max(w, h), short = Math.min(w, h), wide = w >= h;
  if (short <= 2 * s * c * long || Math.abs(s - c) < 1e-10) {
    // half constrained: two corners touch the long side
    const x = 0.5 * short;
    return wide ? [x / s, x / c] : [x / c, x / s];
  }
  const cos2 = c * c - s * s;
  return [(w * c - h * s) / cos2, (h * c - w * s) / cos2];
}

/** The Lanczos kernel with `a` lobes (3: Lanczos-3). */
export function lanczos(x: number, a = 3): number {
  if (x === 0) return 1;
  if (x <= -a || x >= a) return 0;
  const px = Math.PI * x;
  return (a * Math.sin(px) * Math.sin(px / a)) / (px * px);
}

interface Taps { idx: Int32Array; w: Float32Array; n: number; lo: number; hi: number }
/** Per output sample: the source indices and normalised weights along one axis. */
function axisTaps(len: number, s0: number, sl: number, m: number): Taps {
  const scale = sl / m, f = Math.max(1, scale), support = 3 * f, n = Math.ceil(support) * 2 + 1;
  const idx = new Int32Array(m * n), w = new Float32Array(m * n);
  let lo = len, hi = 0;
  for (let i = 0; i < m; i++) {
    const c = s0 + (i + 0.5) * scale - 0.5, left = Math.floor(c - support) + 1;
    let sum = 0;
    for (let t = 0; t < n; t++) {
      const j = left + t, k = lanczos((j - c) / f), jj = j < 0 ? 0 : j >= len ? len - 1 : j;
      idx[i * n + t] = jj; w[i * n + t] = k; sum += k;
      if (k !== 0) { if (jj < lo) lo = jj; if (jj > hi) hi = jj; }
    }
    if (sum) for (let t = 0; t < n; t++) w[i * n + t] = w[i * n + t]! / sum;
  }
  return { idx, w, n, lo: Math.min(lo, len - 1), hi: Math.max(hi, 0) };
}

/**
 * Separable Lanczos-3 resize to w × h (alpha premultiplied while filtering, the kernel widened when shrinking so it
 * averages instead of aliasing). `from` picks a source window in pixels (fractional allowed: cover-fit crops).
 */
export function lanczosResize(r: Raster, w: number, h: number, from?: { x: number; y: number; w: number; h: number }): Raster {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const W = r.width, H = r.height, s = r.data, win = from ?? { x: 0, y: 0, w: W, h: H };
  const tx = axisTaps(W, win.x, win.w, w), ty = axisTaps(H, win.y, win.h, h);
  // horizontal pass over the rows the vertical pass reads (premultiplied)
  const rows = ty.hi - ty.lo + 1, mid = new Float32Array(rows * w * 4);
  for (let y = 0; y < rows; y++) {
    const row = (y + ty.lo) * W;
    for (let x = 0; x < w; x++) {
      let a = 0, b = 0, c = 0, e = 0;
      for (let t = 0, k = x * tx.n; t < tx.n; t++, k++) {
        const wt = tx.w[k]!;
        if (!wt) continue;
        const i = (row + tx.idx[k]!) * 4, al = s[i + 3]! * wt;
        a += s[i]! * al; b += s[i + 1]! * al; c += s[i + 2]! * al; e += al;
      }
      const o = (y * w + x) * 4; mid[o] = a; mid[o + 1] = b; mid[o + 2] = c; mid[o + 3] = e;
    }
  }
  const out = raster(w, h, r.space), d = out.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let a = 0, b = 0, c = 0, e = 0;
      for (let t = 0, k = y * ty.n; t < ty.n; t++, k++) {
        const wt = ty.w[k]!;
        if (!wt) continue;
        const i = ((ty.idx[k]! - ty.lo) * w + x) * 4;
        a += mid[i]! * wt; b += mid[i + 1]! * wt; c += mid[i + 2]! * wt; e += mid[i + 3]! * wt;
      }
      const o = (y * w + x) * 4;
      if (e > 1e-7) { d[o] = Math.max(0, a / e); d[o + 1] = Math.max(0, b / e); d[o + 2] = Math.max(0, c / e); d[o + 3] = Math.min(1, e); }
    }
  }
  return out;
}
