// curves: tone curves on display (encoded) values: one master RGB curve, then one per channel (red, green, blue).
// Points are [x, y] pairs in 0–1 through which a monotone spline runs (no overshoot).
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { curveTable, readTable } from "../color.ts";
import { toEncoded, toLinear } from "../raster.ts";

/** A curve: [input, output] points, both 0–1 display values. */
export type CurvePoints = [number, number][];
export interface CurvesParams { rgb: CurvePoints; r: CurvePoints; g: CurvePoints; b: CurvePoints }

/** Does this curve leave every value as it is (no points, or every point on the diagonal from 0 to 1)? */
export function isIdentityCurve(pts: readonly (readonly [number, number])[] | undefined): boolean {
  if (!pts || pts.length === 0) return true;
  if (pts.length < 2) return false;
  let lo = 1, hi = 0;
  for (const [x, y] of pts) { if (Math.abs(x - y) > 1e-6) return false; lo = Math.min(lo, x); hi = Math.max(hi, x); }
  return lo <= 1e-6 && hi >= 1 - 1e-6;
}

const line = (): CurvePoints => [[0, 0], [1, 1]];
type Tables = [Float32Array | null, Float32Array | null, Float32Array | null, Float32Array | null];

export const CURVES = defineOp<CurvesParams>({
  type: "curves", kind: "color",
  defaults: { rgb: line(), r: line(), g: line(), b: line() },
  identity: (p) => isIdentityCurve(p.rgb) && isIdentityCurve(p.r) && isIdentityCurve(p.g) && isIdentityCurve(p.b),
  prepare: (p): Tables => [p.rgb, p.r, p.g, p.b].map((c) => (isIdentityCurve(c) ? null : curveTable(c, 1024))) as Tables,
  colorWith: (c, _p, data) => {
    const t = data as Tables;
    for (let k = 0; k < 3; k++) {
      const v = c[k]!;
      if (v <= 0) continue;
      let e = toEncoded(v);
      const over = Math.max(0, e - 1);
      e = Math.min(1, e);
      if (t[0]) e = readTable(t[0], e);
      const own = t[k + 1];
      if (own) e = readTable(own, e);
      c[k] = toLinear(e + over);
    }
  },
});
/** Tone curves: `curves({ rgb: [[0, 0], [0.25, 0.2], [0.75, 0.8], [1, 1]] })` is a gentle S. */
export const curves = (params: Partial<CurvesParams> = {}): ImageOp<CurvesParams> => opOf(CURVES, params);
