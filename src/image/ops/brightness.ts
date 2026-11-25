// brightness: lifts or lowers the midtones and leaves black and white where they are (a gamma on display values).
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { perChannelEncoded } from "../color.ts";

export interface BrightnessParams { /** −100…100. */ amount: number }
export const BRIGHTNESS = defineOp<BrightnessParams>({
  type: "brightness", kind: "color", defaults: { amount: 0 },
  params: { amount: { min: -100, max: 100, step: 1, default: 0, centered: true } },
  identity: (p) => !p.amount,
  color: (c, p) => { const g = 2 ** (-p.amount / 100); perChannelEncoded(c, (e) => e ** g); },
  css: (p) => `brightness(${1 + p.amount / 250})`,
});
/** Midtone brightness −100…100: `brightness(20)`. */
export const brightness = (amount = 0): ImageOp<BrightnessParams> => opOf(BRIGHTNESS, { amount });
