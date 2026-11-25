// hue: turns every hue around the colour wheel (OKLCh), lightness and chroma kept.
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { withLch } from "../color.ts";

export interface HueParams { /** Degrees −180…180. */ angle: number }
export const HUE = defineOp<HueParams>({
  type: "hue", kind: "color", defaults: { angle: 0 },
  params: { angle: { min: -180, max: 180, step: 1, default: 0, centered: true, unit: "°" } },
  identity: (p) => !(p.angle % 360),
  color: (c, p) => withLch(c, (l) => { l[2] += p.angle; }),
  css: (p) => `hue-rotate(${p.angle}deg)`,
});
/** Hue rotation in degrees. */
export const hue = (angle = 0): ImageOp<HueParams> => opOf(HUE, { angle });
