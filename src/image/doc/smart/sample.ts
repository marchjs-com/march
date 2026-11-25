// Resampling for smart objects and warped text — a small, self-contained sampler TO BE SWAPPED for
// transform/resample.ts when it lands. Inverse mapping with bilinear filtering on premultiplied RGBA (supersampled
// when the placement shrinks the source, so downscales do not alias), and a triangle-mesh mapper for any forward map
// (warps): each cell of a grid becomes two triangles mapped affinely.

import type { Rect } from "../tiles.ts";

export type Mat3 = number[];

export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** 3×3 row-major product a · b. */
export function mul3(a: Mat3, b: Mat3): Mat3 {
  const o: Mat3 = new Array(9).fill(0);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) o[r * 3 + c] = a[r * 3]! * b[c]! + a[r * 3 + 1]! * b[3 + c]! + a[r * 3 + 2]! * b[6 + c]!;
  return o;
}

export function invert3(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m as [number, number, number, number, number, number, number, number, number];
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-12) return null;
  const k = 1 / det;
  return [A * k, -(b * i - c * h) * k, (b * f - c * e) * k, B * k, (a * i - c * g) * k, -(a * f - c * d) * k, C * k, -(a * h - b * g) * k, (a * e - b * d) * k];
}

export const applyMat = (m: Mat3, x: number, y: number): [number, number] => {
  const w = m[6]! * x + m[7]! * y + m[8]!;
  return [(m[0]! * x + m[1]! * y + m[2]!) / w, (m[3]! * x + m[4]! * y + m[5]!) / w];
};

export const translate3 = (x: number, y: number): Mat3 => [1, 0, x, 0, 1, y, 0, 0, 1];
export const scale3 = (sx: number, sy = sx): Mat3 => [sx, 0, 0, 0, sy, 0, 0, 0, 1];

/** Bounds of a w × h source placed through m (integer pixels). */
export function placedBounds(m: Mat3, w: number, h: number): Rect {
  const pts = [applyMat(m, 0, 0), applyMat(m, w, 0), applyMat(m, w, h), applyMat(m, 0, h)];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs) + 1e-6), y0 = Math.floor(Math.min(...ys) + 1e-6);
  return { x: x0, y: y0, w: Math.ceil(Math.max(...xs) - 1e-6) - x0, h: Math.ceil(Math.max(...ys) - 1e-6) - y0 };
}

/** Bilinear sample of premultiplied RGBA at continuous pixel coordinates (pixel centers at .5); outside = 0. */
function bilinear(src: Float32Array, sw: number, sh: number, fx: number, fy: number, acc: Float64Array, wgt: number): void {
  const x = fx - 0.5, y = fy - 0.5;
  const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
  for (let dy = 0; dy < 2; dy++) {
    const yy = y0 + dy;
    if (yy < 0 || yy >= sh) continue;
    const wy = dy ? ty : 1 - ty;
    if (wy === 0) continue;
    for (let dx = 0; dx < 2; dx++) {
      const xx = x0 + dx;
      if (xx < 0 || xx >= sw) continue;
      const w = (dx ? tx : 1 - tx) * wy * wgt;
      if (w === 0) continue;
      const k = (yy * sw + xx) * 4;
      acc[0]! += src[k]! * w; acc[1]! += src[k + 1]! * w; acc[2]! += src[k + 2]! * w; acc[3]! += src[k + 3]! * w;
    }
  }
}

/**
 * Place a premultiplied sw × sh source through a projective matrix (source pixels → document pixels) into the
 * document region `r`. Returns premultiplied RGBA over r.
 */
export function sampleProjective(src: Float32Array, sw: number, sh: number, m: Mat3, r: Rect): Float32Array {
  const out = new Float32Array(r.w * r.h * 4);
  const inv = invert3(m);
  if (!inv) return out;
  // how much the placement shrinks: supersample to average the source area
  const sx = Math.hypot(m[0]!, m[3]!), sy = Math.hypot(m[1]!, m[4]!);
  const n = Math.max(1, Math.min(4, Math.ceil(1 / Math.max(1e-6, Math.min(sx, sy)) - 1e-9)));
  const acc = new Float64Array(4), wgt = 1 / (n * n);
  for (let y = 0; y < r.h; y++) {
    for (let x = 0; x < r.w; x++) {
      acc.fill(0);
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const px = r.x + x + (i + 0.5) / n, py = r.y + y + (j + 0.5) / n;
        const w = inv[6]! * px + inv[7]! * py + inv[8]!;
        if (w <= 0) continue;
        bilinear(src, sw, sh, (inv[0]! * px + inv[1]! * py + inv[2]!) / w, (inv[3]! * px + inv[4]! * py + inv[5]!) / w, acc, wgt);
      }
      const k = (y * r.w + x) * 4;
      out[k] = acc[0]!; out[k + 1] = acc[1]!; out[k + 2] = acc[2]!; out[k + 3] = acc[3]!;
    }
  }
  return out;
}

/**
 * Map a premultiplied source (covering `srcRect` in its own space) through a forward map, sampled on a grid of
 * cols × rows cells (two affine triangles each). `vertex(i, j)` gives the destination of grid point (i, j), where grid
 * point (i, j) is at srcRect.x + i·w/cols, srcRect.y + j·h/rows. Returns premultiplied RGBA over the destination bounds.
 */
export function meshMap(src: Float32Array, srcRect: Rect, cols: number, rows: number, vertex: (i: number, j: number) => [number, number], clip?: Rect): { rect: Rect; px: Float32Array } {
  const V: [number, number][] = [];
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) {
    const v = vertex(i, j);
    V.push(v);
    x0 = Math.min(x0, v[0]); y0 = Math.min(y0, v[1]); x1 = Math.max(x1, v[0]); y1 = Math.max(y1, v[1]);
  }
  let rect: Rect = { x: Math.floor(x0), y: Math.floor(y0), w: Math.ceil(x1) - Math.floor(x0), h: Math.ceil(y1) - Math.floor(y0) };
  if (clip) {
    const ax = Math.max(rect.x, clip.x), ay = Math.max(rect.y, clip.y);
    rect = { x: ax, y: ay, w: Math.max(0, Math.min(rect.x + rect.w, clip.x + clip.w) - ax), h: Math.max(0, Math.min(rect.y + rect.h, clip.y + clip.h) - ay) };
  }
  const px = new Float32Array(rect.w * rect.h * 4);
  if (!rect.w || !rect.h) return { rect, px };
  const sw = srcRect.w, sh = srcRect.h, cw = sw / cols, ch = sh / rows;
  const acc = new Float64Array(4);
  const tri = (a: number, b: number, c: number, sa: [number, number], sb: [number, number], sc: [number, number]): void => {
    const [ax, ay] = V[a]!, [bx, by] = V[b]!, [cx, cy] = V[c]!;
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    if (Math.abs(den) < 1e-12) return;
    const tx0 = Math.max(rect.x, Math.floor(Math.min(ax, bx, cx))), tx1 = Math.min(rect.x + rect.w, Math.ceil(Math.max(ax, bx, cx)));
    const ty0 = Math.max(rect.y, Math.floor(Math.min(ay, by, cy))), ty1 = Math.min(rect.y + rect.h, Math.ceil(Math.max(ay, by, cy)));
    for (let y = ty0; y < ty1; y++) for (let x = tx0; x < tx1; x++) {
      const qx = x + 0.5, qy = y + 0.5;
      const l1 = ((by - cy) * (qx - cx) + (cx - bx) * (qy - cy)) / den, l2 = ((cy - ay) * (qx - cx) + (ax - cx) * (qy - cy)) / den, l3 = 1 - l1 - l2;
      if (l1 < -1e-6 || l2 < -1e-6 || l3 < -1e-6) continue;
      acc.fill(0);
      bilinear(src, sw, sh, l1 * sa[0] + l2 * sb[0] + l3 * sc[0], l1 * sa[1] + l2 * sb[1] + l3 * sc[1], acc, 1);
      const k = ((y - rect.y) * rect.w + (x - rect.x)) * 4;
      px[k] = acc[0]!; px[k + 1] = acc[1]!; px[k + 2] = acc[2]!; px[k + 3] = acc[3]!;
    }
  };
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
    const s00: [number, number] = [i * cw, j * ch], s10: [number, number] = [(i + 1) * cw, j * ch], s01: [number, number] = [i * cw, (j + 1) * ch], s11: [number, number] = [(i + 1) * cw, (j + 1) * ch];
    tri(a, b, d, s00, s10, s11);
    tri(a, d, c, s00, s11, s01);
  }
  return { rect, px };
}

/** Premultiply / unpremultiply in place. */
export function premul(px: Float32Array): Float32Array {
  for (let i = 0; i < px.length; i += 4) { const a = px[i + 3]!; px[i]! *= a; px[i + 1]! *= a; px[i + 2]! *= a; }
  return px;
}
export function unpremul(px: Float32Array): Float32Array {
  for (let i = 0; i < px.length; i += 4) { const a = px[i + 3]!; if (a > 0) { px[i]! /= a; px[i + 1]! /= a; px[i + 2]! /= a; } }
  return px;
}
