// posterize: reduces each channel to a few flat steps (on display values), the screen-print / poster look.
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { perChannelEncoded } from "../color.ts";

export interface PosterizeParams { /** Steps per channel, 2–32. */ levels: number }
export const POSTERIZE = defineOp<PosterizeParams>({
  type: "posterize", kind: "color", defaults: { levels: 6 },
  params: { levels: { min: 2, max: 32, step: 1, default: 6 } },
  color: (c, p) => { const n = Math.max(1, Math.round(p.levels) - 1); perChannelEncoded(c, (e) => Math.round(Math.min(1, e) * n) / n); },
});
/** Posterize to `levels` steps per channel. */
export const posterize = (levels = 6): ImageOp<PosterizeParams> => opOf(POSTERIZE, { levels });
