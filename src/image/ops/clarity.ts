// clarity: midtone local contrast at a wide radius (≈ 1.5 % of the short side): punchier structure (+) or a soft,
// dreamy glow (−). Deep shadows and bright highlights are spared.
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { localContrast } from "../blur.ts";

export interface ClarityParams { /** −100…100. */ amount: number }
/** Midtone weight on perceptual lightness: 1 in the middle, 0 at black and white. */
export const midtoneWeight = (L: number): number => { const t = (L - 0.5) / 0.5; return Math.max(0, 1 - t * t); };

export const CLARITY = defineOp<ClarityParams>({
  type: "clarity", kind: "spatial", defaults: { amount: 0 },
  params: { amount: { min: -100, max: 100, step: 1, default: 0, centered: true } },
  identity: (p) => !p.amount,
  run: (r, p, ctx) => {
    const sigma = Math.max(0.5, Math.min(ctx.fullWidth, ctx.fullHeight) * 0.015 * ctx.scale);
    return localContrast(r, sigma, (p.amount / 100) * (p.amount > 0 ? 0.8 : 0.9), midtoneWeight);
  },
});
/** Clarity −100…100. */
export const clarity = (amount = 0): ImageOp<ClarityParams> => opOf(CLARITY, { amount });
