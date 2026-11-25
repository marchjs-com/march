// vignette: darkens (−) or lightens (+) the edges of the frame; midpoint sets how far in it reaches, roundness goes
// from a rounded rectangle (−) through the frame's own ellipse (0) to a circle (+), feather softens the edge.
import { defineOp, opOf, smooth, type ImageOp } from "../op.ts";

export interface VignetteParams {
  /** −100 (dark edges) … 100 (light edges). */ amount: number;
  /** 0–100: how far towards the centre it starts (low reaches further in). */ midpoint: number;
  /** −100 (rectangle) … 100 (circle). */ roundness: number;
  /** 0–100 edge softness. */ feather: number;
}

export const VIGNETTE = defineOp<VignetteParams>({
  type: "vignette", kind: "pixel", defaults: { amount: 0, midpoint: 50, roundness: 0, feather: 50 },
  params: {
    amount: { min: -100, max: 100, step: 1, default: 0, centered: true },
    midpoint: { min: 0, max: 100, step: 1, default: 50 },
    roundness: { min: -100, max: 100, step: 1, default: 0, centered: true },
    feather: { min: 0, max: 100, step: 1, default: 50 },
  },
  identity: (p) => !p.amount,
  pixel: (d, i, x, y, w, h, p) => {
    const round = p.roundness / 100, m = Math.min(w, h);
    // circle: both axes in short-side units; ellipse: each axis in its own half-size
    const sx = round > 0 ? 1 + (w / m - 1) * round : 1, sy = round > 0 ? 1 + (h / m - 1) * round : 1;
    const u = Math.abs(((x + 0.5) / w) * 2 - 1) * sx, v = Math.abs(((y + 0.5) / h) * 2 - 1) * sy;
    const n = 2 + Math.max(0, -round) * 4, dist = (u ** n + v ** n) ** (1 / n);
    const c = 0.35 + (p.midpoint / 100) * 0.85, hw = 0.03 + (p.feather / 100) * 0.6, k = smooth(c - hw, c + hw, dist) * (p.amount / 100);
    if (k < 0) { const f = 1 + k; d[i] = d[i]! * f; d[i + 1] = d[i + 1]! * f; d[i + 2] = d[i + 2]! * f; }
    else if (k > 0) for (let j = i; j < i + 3; j++) d[j] = d[j]! + (1 - d[j]!) * k;
  },
});
/** Vignette: `vignette(-30)` darkens the corners; `vignette({ amount: -50, roundness: 100 })` a round one. */
export const vignette = (amount: number | Partial<VignetteParams> = 0): ImageOp<VignetteParams> => opOf(VIGNETTE, typeof amount === "number" ? { amount } : amount);
