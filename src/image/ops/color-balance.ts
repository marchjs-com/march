// color-balance: pushes shadows, midtones and highlights separately towards cyan / red, magenta / green and
// yellow / blue (as a darkroom colour head does), optionally keeping each pixel's luminance.
import { defineOp, opOf, smooth, type ImageOp } from "../op.ts";
import { luminance } from "../raster.ts";

/** [cyan (−) … red (+), magenta (−) … green (+), yellow (−) … blue (+)], each −100…100. */
export type BalanceTriple = [number, number, number];
export interface ColorBalanceParams { shadows: BalanceTriple; midtones: BalanceTriple; highlights: BalanceTriple; preserveLuminosity: boolean }

const isZero = (t: readonly number[] | undefined): boolean => !t || t.every((v) => !v);

export const COLOR_BALANCE = defineOp<ColorBalanceParams>({
  type: "color-balance", kind: "color",
  defaults: { shadows: [0, 0, 0], midtones: [0, 0, 0], highlights: [0, 0, 0], preserveLuminosity: true },
  identity: (p) => isZero(p.shadows) && isZero(p.midtones) && isZero(p.highlights),
  color: (c, p) => {
    const y = luminance(c[0]!, c[1]!, c[2]!), L = Math.cbrt(Math.max(0, y));
    const ws = 1 - smooth(0, 0.6, L), wh = smooth(0.4, 1, L), wm = 1 - smooth(0, 0.5, Math.abs(L - 0.5));
    for (let k = 0; k < 3; k++) {
      const s = ws * (p.shadows[k] ?? 0) + wm * (p.midtones[k] ?? 0) + wh * (p.highlights[k] ?? 0);
      c[k] = c[k]! * 2 ** ((s / 100) * 0.7);
    }
    if (p.preserveLuminosity) {
      const y2 = luminance(c[0]!, c[1]!, c[2]!);
      if (y2 > 1e-7) { const k = y / y2; c[0] = c[0]! * k; c[1] = c[1]! * k; c[2] = c[2]! * k; }
    }
  },
});
/** Colour balance: `colorBalance({ shadows: [-10, 0, 15], highlights: [12, 0, -10] })` (teal shadows, warm highlights). */
export const colorBalance = (params: Partial<ColorBalanceParams> = {}): ImageOp<ColorBalanceParams> => opOf(COLOR_BALANCE, params);
