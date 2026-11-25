// saturation: every colour's chroma together, in OKLab (lightness kept: no muddy greys). −100 is black and white.
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { withLch } from "../color.ts";

export interface SaturationParams { /** −100…100. */ amount: number }
export const SATURATION = defineOp<SaturationParams>({
  type: "saturation", kind: "color", defaults: { amount: 0 },
  params: { amount: { min: -100, max: 100, step: 1, default: 0, centered: true } },
  identity: (p) => !p.amount,
  color: (c, p) => withLch(c, (l) => { l[1] *= 1 + p.amount / 100; }),
  css: (p) => `saturate(${1 + p.amount / 100})`,
});
/** Saturation −100…100. */
export const saturation = (amount = 0): ImageOp<SaturationParams> => opOf(SATURATION, { amount });
