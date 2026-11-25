// texture: fine-detail local contrast (a radius of ≈ 3 px): brings out skin pores, fabric and foliage (+) or smooths
// them (−) without touching the larger shapes.
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { localContrast } from "../blur.ts";

export interface TextureParams { /** −100…100. */ amount: number }
export const TEXTURE = defineOp<TextureParams>({
  type: "texture", kind: "spatial", defaults: { amount: 0 },
  params: { amount: { min: -100, max: 100, step: 1, default: 0, centered: true } },
  identity: (p) => !p.amount,
  run: (r, p, ctx) => localContrast(r, Math.max(0.5, 3 * ctx.scale), (p.amount / 100) * (p.amount > 0 ? 1.2 : 0.9), (L) => 0.3 + 0.7 * Math.min(1, L * 3)),
});
/** Texture −100…100. */
export const texture = (amount = 0): ImageOp<TextureParams> => opOf(TEXTURE, { amount });
