// temperature: cooler (−, blue) or warmer (+, amber) light; overall brightness stays.
import { defineOp, opOf, type ImageOp } from "../op.ts";

export interface TemperatureParams { /** −100…100. */ amount: number }
/** Linear RGB gains for a temperature / tint pair (luminance kept). */
export function wbGains(temp: number, tint: number): [number, number, number] {
  const t = temp / 100, n = tint / 100;
  const r = (1 + 0.28 * t) * (1 + 0.08 * n), b = (1 - 0.32 * t) * (1 + 0.08 * n), g = 1 - 0.22 * n;
  const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return [r / y, g / y, b / y];
}
export const TEMPERATURE = defineOp<TemperatureParams>({
  type: "temperature", kind: "color", defaults: { amount: 0 },
  params: { amount: { min: -100, max: 100, step: 1, default: 0, centered: true } },
  identity: (p) => !p.amount,
  prepare: (p) => wbGains(p.amount, 0),
  colorWith: (c, _p, g) => { const k = g as number[]; c[0] = c[0]! * k[0]!; c[1] = c[1]! * k[1]!; c[2] = c[2]! * k[2]!; },
  css: (p) => (p.amount > 0 ? `sepia(${(p.amount / 400).toFixed(3)})` : null),
});
/** Colour temperature −100 (cool) … 100 (warm). */
export const temperature = (amount = 0): ImageOp<TemperatureParams> => opOf(TEMPERATURE, { amount });
