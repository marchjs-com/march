// tint: green (−) or magenta (+) cast correction; overall brightness stays.
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { wbGains } from "./temperature.ts";

export interface TintParams { /** −100…100. */ amount: number }
export const TINT = defineOp<TintParams>({
  type: "tint", kind: "color", defaults: { amount: 0 },
  params: { amount: { min: -100, max: 100, step: 1, default: 0, centered: true } },
  identity: (p) => !p.amount,
  prepare: (p) => wbGains(0, p.amount),
  colorWith: (c, _p, g) => { const k = g as number[]; c[0] = c[0]! * k[0]!; c[1] = c[1]! * k[1]!; c[2] = c[2]! * k[2]!; },
});
/** Tint −100 (green) … 100 (magenta). */
export const tint = (amount = 0): ImageOp<TintParams> => opOf(TINT, { amount });
