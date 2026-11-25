// contrast: an S-curve on display values around the middle (more) or a flatter line (less); never clips hard.
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { perChannelEncoded } from "../color.ts";

export interface ContrastParams { /** −100…100. */ amount: number }
/** The contrast curve on a display value 0–1. */
export function contrastCurve(x: number, amount: number): number {
  if (amount >= 0) { const g = 1 + (amount / 100) * 1.6; return x < 0.5 ? 0.5 * (2 * x) ** g : 1 - 0.5 * (2 * (1 - x)) ** g; }
  return 0.5 + (x - 0.5) * (1 + (amount / 100) * 0.75);
}
export const CONTRAST = defineOp<ContrastParams>({
  type: "contrast", kind: "color", defaults: { amount: 0 },
  params: { amount: { min: -100, max: 100, step: 1, default: 0, centered: true } },
  identity: (p) => !p.amount,
  color: (c, p) => perChannelEncoded(c, (e) => contrastCurve(Math.min(1, e), p.amount) + Math.max(0, e - 1)),
  css: (p) => `contrast(${1 + p.amount / 140})`,
});
/** Contrast −100…100: `contrast(25)`. */
export const contrast = (amount = 0): ImageOp<ContrastParams> => opOf(CONTRAST, { amount });
