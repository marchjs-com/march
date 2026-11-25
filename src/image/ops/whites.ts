// whites: moves the white point: the brightest tones go brighter (+, up to clipping) or duller (−).
import { defineOp, opOf, smooth, type ImageOp } from "../op.ts";
import { toneByLightness } from "../color.ts";

export interface WhitesParams { /** −100…100. */ amount: number }
export const WHITES = defineOp<WhitesParams>({
  type: "whites", kind: "color", defaults: { amount: 0 },
  params: { amount: { min: -100, max: 100, step: 1, default: 0, centered: true } },
  identity: (p) => !p.amount,
  color: (c, p) => toneByLightness(c, (L) => L * (1 + (p.amount / 100) * 0.25 * smooth(0.55, 1, L))),
});
/** Whites −100…100. */
export const whites = (amount = 0): ImageOp<WhitesParams> => opOf(WHITES, { amount });
