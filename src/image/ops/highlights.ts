// highlights: brings back (−) or brightens (+) the bright parts only; hue and saturation stay.
import { defineOp, opOf, smooth, type ImageOp } from "../op.ts";
import { toneByLightness } from "../color.ts";

export interface HighlightsParams { /** −100…100. */ amount: number }
export const HIGHLIGHTS = defineOp<HighlightsParams>({
  type: "highlights", kind: "color", defaults: { amount: 0 },
  params: { amount: { min: -100, max: 100, step: 1, default: 0, centered: true } },
  identity: (p) => !p.amount,
  color: (c, p) => toneByLightness(c, (L) => { const w = smooth(0.45, 0.95, L); return L + (p.amount / 100) * w * (p.amount < 0 ? L * 0.35 : Math.max(0, 1.05 - L) * 0.6); }),
});
/** Highlights −100…100: `highlights(-60)` recovers a bright sky. */
export const highlights = (amount = 0): ImageOp<HighlightsParams> => opOf(HIGHLIGHTS, { amount });
