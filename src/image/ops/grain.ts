// grain: film grain: deterministic value noise (the same seed gives the same grain on every render and on export),
// strongest in the midtones, its size in full-image pixels so a preview and the export match.
import { defineOp, opOf, type ImageOp, type OpContext } from "../op.ts";
import { luminance } from "../raster.ts";

export interface GrainParams {
  /** 0–100 strength. */ amount: number;
  /** 1–100 grain size. */ size: number;
  /** 0–100: smooth (0) to rough, clumpy (100). */ roughness: number;
  /** Any integer: another seed, another grain pattern. */ seed: number;
}

/** Hash of a lattice point to −1…1. */
function hash(x: number, y: number, s: number): number {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(s, 2147483647)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}
/** Smooth value noise at x, y (−1…1). */
function noise(x: number, y: number, s: number): number {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy, s), b = hash(ix + 1, iy, s), c = hash(ix, iy + 1, s), d = hash(ix + 1, iy + 1, s);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

interface Prep { cell: number; inv: number; amp: number; rough: number; seed: number }

export const GRAIN = defineOp<GrainParams>({
  type: "grain", kind: "pixel", defaults: { amount: 0, size: 25, roughness: 50, seed: 1 },
  params: {
    amount: { min: 0, max: 100, step: 1, default: 0 },
    size: { min: 1, max: 100, step: 1, default: 25 },
    roughness: { min: 0, max: 100, step: 1, default: 50 },
    seed: { min: 0, max: 9999, step: 1, default: 1 },
  },
  identity: (p) => !p.amount,
  prepare: (p, ctx: OpContext): Prep => {
    const cell = 0.6 + (p.size / 100) * 3.4, px = cell * ctx.scale;
    // grain finer than a preview pixel averages out: fade it rather than alias
    return { cell, inv: 1 / ctx.scale, amp: (p.amount / 100) * 0.09 * Math.min(1, Math.sqrt(px)), rough: p.roughness / 100, seed: Math.round(p.seed) | 0 };
  },
  pixel: (d, i, x, y, _w, _h, _p, data) => {
    const q = data as Prep, fx = (x + 0.5) * q.inv / q.cell, fy = (y + 0.5) * q.inv / q.cell;
    const n = noise(fx, fy, q.seed) * (1 - q.rough * 0.5) + noise(fx * 2.7 + 17.3, fy * 2.7 + 5.1, q.seed + 7) * q.rough * 0.6;
    const Y = luminance(d[i]!, d[i + 1]!, d[i + 2]!), L = Math.cbrt(Math.max(0, Y)), w = 0.25 + 3 * L * Math.max(0, 1 - L);
    const L2 = Math.max(0, L + n * q.amp * w);
    if (Y > 1e-6) { const k = (L2 / L) ** 3; d[i] = d[i]! * k; d[i + 1] = d[i + 1]! * k; d[i + 2] = d[i + 2]! * k; }
    else { const g = L2 ** 3; d[i] = d[i]! + g; d[i + 1] = d[i + 1]! + g; d[i + 2] = d[i + 2]! + g; }
  },
});
/** Film grain: `grain(30)`, `grain({ amount: 40, size: 60, roughness: 80, seed: 7 })`. */
export const grain = (amount: number | Partial<GrainParams> = 0): ImageOp<GrainParams> => opOf(GRAIN, typeof amount === "number" ? { amount } : amount);
