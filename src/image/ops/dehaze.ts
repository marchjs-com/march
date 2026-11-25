// dehaze: removes atmospheric haze (+) with the dark-channel prior (haze lifts the darkest channel of every patch: the
// airlight is estimated from the haziest pixels, a transmission map from the dark channel, and the scene recovered as
// (I − A) / t + A), or adds a veil of haze (−).
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { gaussPlane } from "../blur.ts";
import { encodeFast, toLinear } from "../raster.ts";

export interface DehazeParams { /** −100 (add haze) … 100 (remove). */ amount: number }

/** Running minimum over a window of 2r+1 along one line (van Herk / Gil-Werman: O(1) per sample), edges clamped. */
function minLine(src: Float32Array, dst: Float32Array, n: number, r: number, off: number, stride: number, g: Float32Array, h: Float32Array): void {
  const k = 2 * r + 1, m = n + 2 * r;
  const at = (j: number): number => src[off + Math.min(n - 1, Math.max(0, j - r)) * stride]!;
  for (let j = 0; j < m; j++) g[j] = j % k === 0 ? at(j) : Math.min(g[j - 1]!, at(j));
  for (let j = m - 1; j >= 0; j--) h[j] = j === m - 1 || (j + 1) % k === 0 ? at(j) : Math.min(h[j + 1]!, at(j));
  for (let i = 0; i < n; i++) dst[off + i * stride] = Math.min(h[i]!, g[i + 2 * r]!);
}
/** Minimum filter of a plane over a (2r+1)² square. */
export function minFilter(src: Float32Array, w: number, hgt: number, r: number): Float32Array {
  if (r < 1) return src.slice();
  const tmp = new Float32Array(src.length), out = new Float32Array(src.length), len = Math.max(w, hgt) + 2 * r;
  const g = new Float32Array(len), h = new Float32Array(len);
  for (let y = 0; y < hgt; y++) minLine(src, tmp, w, r, y * w, 1, g, h);
  for (let x = 0; x < w; x++) minLine(tmp, out, hgt, r, x, w, g, h);
  return out;
}

export const DEHAZE = defineOp<DehazeParams>({
  type: "dehaze", kind: "spatial", defaults: { amount: 0 },
  params: { amount: { min: -100, max: 100, step: 1, default: 0, centered: true } },
  identity: (p) => !p.amount,
  run: (r, p) => {
    const w = r.width, hgt = r.height, n = w * hgt, d = r.data, a = p.amount / 100;
    if (!n) return r;
    // work on display values, where the dark-channel prior holds
    const e = new Float32Array(n * 3), dark = new Float32Array(n);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const R = encodeFast(d[j]!), G = encodeFast(d[j + 1]!), B = encodeFast(d[j + 2]!);
      e[i * 3] = R; e[i * 3 + 1] = G; e[i * 3 + 2] = B; dark[i] = Math.min(R, G, B);
    }
    const rad = Math.max(1, Math.round(Math.min(w, hgt) * 0.01));
    const dc = minFilter(dark, w, hgt, rad);
    // airlight: mean colour of the 0.1 % haziest pixels
    const bins = new Uint32Array(1024), want = Math.max(1, Math.round(n * 0.001));
    for (let i = 0; i < n; i++) bins[Math.min(1023, (dc[i]! * 1023) | 0)]!++;
    let cut = 1023;
    for (let acc = 0; cut > 0; cut--) { acc += bins[cut]!; if (acc >= want) break; }
    const A = [0, 0, 0];
    let count = 0;
    for (let i = 0; i < n; i++) if (Math.min(1023, (dc[i]! * 1023) | 0) >= cut) { count++; for (let k = 0; k < 3; k++) A[k] = A[k]! + e[i * 3 + k]!; }
    for (let k = 0; k < 3; k++) A[k] = A[k]! / Math.max(1, count);
    for (let k = 0; k < 3; k++) A[k] = Math.max(0.05, A[k]!);
    if (a < 0) {
      const veil = -a * 0.6;
      for (let i = 0, j = 0; i < n; i++, j += 4) for (let k = 0; k < 3; k++) d[j + k] = toLinear(e[i * 3 + k]! + (A[k]! - e[i * 3 + k]!) * veil);
      return r;
    }
    const norm = new Float32Array(n);
    for (let i = 0; i < n; i++) norm[i] = Math.min(e[i * 3]! / A[0]!, e[i * 3 + 1]! / A[1]!, e[i * 3 + 2]! / A[2]!);
    // the min filter makes blocks: blur the transmission so edges do not halo
    const t = gaussPlane(minFilter(norm, w, hgt, rad), w, hgt, rad * 1.5);
    for (let i = 0, j = 0; i < n; i++, j += 4) {
      const tt = Math.max(0.1, 1 - 0.95 * t[i]!);
      for (let k = 0; k < 3; k++) {
        const I = e[i * 3 + k]!, J = (I - A[k]!) / tt + A[k]!;
        d[j + k] = toLinear(Math.min(1, Math.max(0, I + (J - I) * a)));
      }
    }
    return r;
  },
});
/** Dehaze −100…100. */
export const dehaze = (amount = 0): ImageOp<DehazeParams> => opOf(DEHAZE, { amount });
