// shadows: opens up (+) or deepens (−) the dark parts only; hue and saturation stay.
import { defineOp, opOf, smooth, type ImageOp } from "../op.ts";
import { toneByLightness } from "../color.ts";

export interface ShadowsParams { /** −100…100. */ amount: number }
export const SHADOWS = defineOp<ShadowsParams>({
  type: "shadows", kind: "color", defaults: { amount: 0 },
  params: { amount: { min: -100, max: 100, step: 1, default: 0, centered: true } },
  identity: (p) => !p.amount,
  color: (c, p) => toneByLightness(c, (L) => { const w = 1 - smooth(0.08, 0.6, L); return L + (p.amount / 100) * w * (p.amount > 0 ? Math.max(0, 0.62 - L) * 0.55 : L * 0.45); }),
});
/** Shadows −100…100: `shadows(40)` shows the faces in a backlit photo. */
export const shadows = (amount = 0): ImageOp<ShadowsParams> => opOf(SHADOWS, { amount });
