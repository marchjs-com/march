// seam-carve: content-aware resize. A seam is a connected top-to-bottom path of one pixel per row; the cheapest one
// by gradient energy (dynamic programming) crosses flat areas, so removing it shrinks the image around what matters,
// and duplicating the cheapest seams grows it. Heights work on the transposed image. `protect` (0–1 rect) is never cut.
// The work is capped (seams × pixels): past the cap the image is first Lanczos-resized part of the way, so previews stay
// interactive. Target size in px of the full image (a preview scales by ctx.scale). march/image/ops/seam-carve
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { luminance, raster, type Raster } from "../raster.ts";
import { lanczosResize, type FracRect } from "../geometry.ts";

export interface SeamCarveParams {
  /** Target width in px (0: unchanged). */
  width: number;
  /** Target height in px (0: unchanged). */
  height: number;
  /** Area to keep whole, 0–1 fractions of the image (null: none). */
  protect: FracRect | null;
}

/** Seams × pixels one call may spend before resizing part of the way (a few hundred ms on a preview). */
const BUDGET = 8e6;
const PROTECTED = 1e4;

interface Work { r: Raster; mask: Uint8Array }

const lumOf = (r: Raster): Float32Array => {
  const n = r.width * r.height, d = r.data, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = Math.sqrt(Math.max(0, luminance(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!))) * d[i * 4 + 3]!;
  return out;
};

/** Gradient energy (|dx| + |dy| of perceptual luminance) of the first cw columns (row stride W); protected pixels cost a lot. */
function energy(lum: Float32Array, mask: Uint8Array, W: number, cw: number, H: number, E: Float32Array): void {
  for (let y = 0; y < H; y++) {
    const row = y * W, up = (y > 0 ? y - 1 : y) * W, dn = (y < H - 1 ? y + 1 : y) * W;
    for (let x = 0; x < cw; x++) {
      const xl = x > 0 ? x - 1 : x, xr = x < cw - 1 ? x + 1 : x;
      E[row + x] = Math.abs(lum[row + xr]! - lum[row + xl]!) + Math.abs(lum[dn + x]! - lum[up + x]!) + (mask[row + x] ? PROTECTED : 0);
    }
  }
}

/** The cheapest vertical seam over the first cw columns: seam[y] = x. */
function findSeam(E: Float32Array, M: Float32Array, W: number, cw: number, H: number, seam: Int32Array): void {
  for (let x = 0; x < cw; x++) M[x] = E[x]!;
  for (let y = 1; y < H; y++) {
    const row = y * W, prev = row - W;
    for (let x = 0; x < cw; x++) {
      let best = M[prev + x]!;
      if (x > 0 && M[prev + x - 1]! < best) best = M[prev + x - 1]!;
      if (x < cw - 1 && M[prev + x + 1]! < best) best = M[prev + x + 1]!;
      M[row + x] = E[row + x]! + best;
    }
  }
  const last = (H - 1) * W;
  let bx = 0;
  for (let x = 1; x < cw; x++) if (M[last + x]! < M[last + bx]!) bx = x;
  seam[H - 1] = bx;
  for (let y = H - 2; y >= 0; y--) {
    const row = y * W;
    let x = bx;
    if (bx > 0 && M[row + bx - 1]! < M[row + x]!) x = bx - 1;
    if (bx < cw - 1 && M[row + bx + 1]! < M[row + x]!) x = bx + 1;
    seam[y] = bx = x;
  }
}

/** Nearest-neighbour resample of a mask. */
function maskTo(mask: Uint8Array, W: number, H: number, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) { const sy = Math.min(H - 1, Math.floor(((y + 0.5) * H) / h)); for (let x = 0; x < w; x++) out[y * w + x] = mask[sy * W + Math.min(W - 1, Math.floor(((x + 0.5) * W) / w))]!; }
  return out;
}

function resizeWork(wk: Work, w: number, h: number): Work {
  return { r: lanczosResize(wk.r, w, h), mask: maskTo(wk.mask, wk.r.width, wk.r.height, w, h) };
}

/** Remove n vertical seams. */
function removeSeams(wk: Work, n: number): Work {
  const { r } = wk, W = r.width, H = r.height, px = r.data.slice(), lum = lumOf(r), mask = wk.mask.slice();
  const E = new Float32Array(W * H), M = new Float32Array(W * H), seam = new Int32Array(H);
  let cw = W;
  for (let s = 0; s < n && cw > 1; s++) {
    energy(lum, mask, W, cw, H, E);
    findSeam(E, M, W, cw, H, seam);
    for (let y = 0; y < H; y++) {
      const row = y * W, x = seam[y]!;
      px.copyWithin((row + x) * 4, (row + x + 1) * 4, (row + cw) * 4);
      lum.copyWithin(row + x, row + x + 1, row + cw);
      mask.copyWithin(row + x, row + x + 1, row + cw);
    }
    cw--;
  }
  const out = raster(cw, H, r.space), om = new Uint8Array(cw * H);
  for (let y = 0; y < H; y++) { out.data.set(px.subarray(y * W * 4, (y * W + cw) * 4), y * cw * 4); om.set(mask.subarray(y * W, y * W + cw), y * cw); }
  return { r: out, mask: om };
}

/** Insert n (≤ width / 2) seams: the n cheapest, found by removing them from a copy, each duplicated (blended with its right neighbour). */
function insertSeams(wk: Work, n: number): Work {
  const { r } = wk, W = r.width, H = r.height, lum = lumOf(r), mask = wk.mask.slice(), idx = new Int32Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) idx[y * W + x] = x;
  const E = new Float32Array(W * H), M = new Float32Array(W * H), seam = new Int32Array(H), dup = new Uint16Array(W * H);
  let cw = W;
  for (let s = 0; s < n && cw > 1; s++) {
    energy(lum, mask, W, cw, H, E);
    findSeam(E, M, W, cw, H, seam);
    for (let y = 0; y < H; y++) {
      const row = y * W, x = seam[y]!;
      dup[row + idx[row + x]!]!++;
      lum.copyWithin(row + x, row + x + 1, row + cw);
      mask.copyWithin(row + x, row + x + 1, row + cw);
      idx.copyWithin(row + x, row + x + 1, row + cw);
    }
    cw--;
  }
  const added = W - cw, ow = W + added, out = raster(ow, H, r.space), d = out.data, s = r.data, om = new Uint8Array(ow * H);
  for (let y = 0; y < H; y++) {
    let o = y * ow;
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4, j = (y * W + Math.min(W - 1, x + 1)) * 4, m = wk.mask[y * W + x]!;
      d[o * 4] = s[i]!; d[o * 4 + 1] = s[i + 1]!; d[o * 4 + 2] = s[i + 2]!; d[o * 4 + 3] = s[i + 3]!; om[o++] = m;
      for (let k = dup[y * W + x]!; k > 0; k--) {
        for (let c = 0; c < 4; c++) d[o * 4 + c] = (s[i + c]! + s[j + c]!) / 2;
        om[o++] = m;
      }
    }
  }
  return { r: out, mask: om };
}

/** Width to `target` by seams (with the budget's pre-resize). */
function carveWidth(wk: Work, target: number): Work {
  target = Math.max(1, Math.round(target));
  const W = wk.r.width, H = wk.r.height, allowed = Math.max(1, Math.floor(BUDGET / (W * H)));
  if (target === W) return wk;
  if (target < W) {
    if (W - target > allowed) wk = resizeWork(wk, target + allowed, H);
    return removeSeams(wk, wk.r.width - target);
  }
  if (target - W > allowed) wk = resizeWork(wk, target - allowed, H);
  while (wk.r.width < target) wk = insertSeams(wk, Math.min(target - wk.r.width, Math.max(1, Math.floor(wk.r.width / 2))));
  return wk;
}

function transpose(wk: Work): Work {
  const { r, mask } = wk, W = r.width, H = r.height, out = raster(H, W, r.space), s = r.data, d = out.data, om = new Uint8Array(W * H);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4, o = (x * H + y) * 4;
    d[o] = s[i]!; d[o + 1] = s[i + 1]!; d[o + 2] = s[i + 2]!; d[o + 3] = s[i + 3]!; om[x * H + y] = mask[y * W + x]!;
  }
  return { r: out, mask: om };
}

/** Content-aware resize of a raster to width × height px (0 keeps that side). */
export function seamCarveRaster(r: Raster, width: number, height: number, protect: FracRect | null = null): Raster {
  const W = r.width, H = r.height, mask = new Uint8Array(W * H);
  if (protect) {
    const x0 = Math.max(0, Math.floor(protect.x * W)), x1 = Math.min(W, Math.ceil((protect.x + protect.w) * W));
    const y0 = Math.max(0, Math.floor(protect.y * H)), y1 = Math.min(H, Math.ceil((protect.y + protect.h) * H));
    for (let y = y0; y < y1; y++) mask.fill(1, y * W + x0, y * W + x1);
  }
  let wk: Work = { r, mask };
  if (width && Math.round(width) !== W) wk = carveWidth(wk, width);
  if (height && Math.round(height) !== H) wk = transpose(carveWidth(transpose(wk), height));
  return wk.r;
}

export const SEAM_CARVE = defineOp<SeamCarveParams>({
  type: "seam-carve", kind: "geometry", defaults: { width: 0, height: 0, protect: null },
  params: { width: { min: 0, max: 16384, step: 1, default: 0, unit: "px" }, height: { min: 0, max: 16384, step: 1, default: 0, unit: "px" } },
  identity: (p) => !p.width && !p.height,
  run: (r, p, ctx) => seamCarveRaster(r, p.width > 0 ? Math.max(1, Math.round(p.width * ctx.scale)) : 0, p.height > 0 ? Math.max(1, Math.round(p.height * ctx.scale)) : 0, p.protect),
  css: () => null,
});

/** `seamCarve(800, 0)`: 800 px wide, content-aware; `seamCarve(800, 0, { x: 0.4, y: 0.2, w: 0.2, h: 0.6 })` keeps a face. */
export const seamCarve = (width = 0, height = 0, protect: FracRect | null = null): ImageOp<SeamCarveParams> => opOf(SEAM_CARVE, { width, height, protect });
