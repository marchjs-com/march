// blacks: moves the black point: the darkest tones go deeper (−) or lift towards grey (+).
import { defineOp, opOf, smooth, type ImageOp } from "../op.ts";
import { toneByLightness } from "../color.ts";

export interface BlacksParams { /** −100…100. */ amount: number }
export const BLACKS = defineOp<BlacksParams>({
  type: "blacks", kind: "color", defaults: { amount: 0 },
  params: { amount: { min: -100, max: 100, step: 1, default: 0, centered: true } },
  identity: (p) => !p.amount,
  color: (c, p) => toneByLightness(c, (L) => { const w = 1 - smooth(0, 0.4, L); return p.amount < 0 ? L * (1 + (p.amount / 100) * 0.6 * w) : L + (p.amount / 100) * 0.12 * w; }),
});
/** Blacks −100…100. */
export const blacks = (amount = 0): ImageOp<BlacksParams> => opOf(BLACKS, { amount });
