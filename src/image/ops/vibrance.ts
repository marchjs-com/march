// vibrance: saturation that favours dull colours and spares skin tones and already vivid ones.
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { withLch, hueDist } from "../color.ts";

export interface VibranceParams { /** −100…100. */ amount: number }
export const VIBRANCE = defineOp<VibranceParams>({
  type: "vibrance", kind: "color", defaults: { amount: 0 },
  params: { amount: { min: -100, max: 100, step: 1, default: 0, centered: true } },
  identity: (p) => !p.amount,
  color: (c, p) => withLch(c, (l) => {
    const dull = Math.max(0, 1 - l[1] / 0.25), skin = Math.max(0, 1 - hueDist(l[2], 55) / 35) * 0.6;
    l[1] *= 1 + (p.amount / 100) * (p.amount > 0 ? dull * (1 - skin) : 1);
  }),
  css: (p) => `saturate(${1 + p.amount / 200})`,
});
/** Vibrance −100…100. */
export const vibrance = (amount = 0): ImageOp<VibranceParams> => opOf(VIBRANCE, { amount });
