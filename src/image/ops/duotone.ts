// duotone: the image in two inks: shadows take one colour, highlights another, mixed in OKLab by lightness; a third
// (mid) colour makes it a tritone.
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { gradientTable, mapThrough } from "./gradient-map.ts";

export interface DuotoneParams {
  /** Shadow colour (#hex). */ shadow: string;
  /** Highlight colour (#hex). */ highlight: string;
  /** Optional midtone colour (tritone). */ mid?: string | undefined;
}

export const DUOTONE = defineOp<DuotoneParams>({
  type: "duotone", kind: "color",
  defaults: { shadow: "#1d2b53", highlight: "#ffd6a5" },
  prepare: (p) => gradientTable(p.mid
    ? [{ at: 0, color: p.shadow }, { at: 0.5, color: p.mid }, { at: 1, color: p.highlight }]
    : [{ at: 0, color: p.shadow }, { at: 1, color: p.highlight }]),
  colorWith: (c, _p, t) => mapThrough(c, t as Float32Array),
});
/** Duotone: `duotone("#14213d", "#fca311")`; a third colour makes a tritone. */
export function duotone(shadow?: string, highlight?: string, mid?: string): ImageOp<DuotoneParams> {
  const p: Partial<DuotoneParams> = {};
  if (shadow) p.shadow = shadow;
  if (highlight) p.highlight = highlight;
  if (mid) p.mid = mid;
  return opOf(DUOTONE, p);
}
