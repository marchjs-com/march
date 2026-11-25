// invert: the negative: every display value v becomes 1 − v.
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { perChannelEncoded } from "../color.ts";

export type InvertParams = Record<string, never>;
export const INVERT = defineOp<InvertParams>({
  type: "invert", kind: "color", defaults: {},
  color: (c) => perChannelEncoded(c, (e) => 1 - Math.min(1, e)),
  css: () => "invert(1)",
});
/** The negative. */
export const invert = (): ImageOp<InvertParams> => opOf(INVERT, {});
