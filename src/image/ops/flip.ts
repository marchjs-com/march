// flip: mirror the image horizontally and / or vertically (exact, no resampling). march/image/ops/flip
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { mirror } from "../geometry.ts";

export interface FlipParams {
  /** Mirror left ↔ right. */
  horizontal: boolean;
  /** Mirror top ↔ bottom. */
  vertical: boolean;
}

export const FLIP = defineOp<FlipParams>({
  type: "flip", kind: "geometry", defaults: { horizontal: false, vertical: false },
  identity: (p) => !p.horizontal && !p.vertical,
  run: (r, p) => mirror(r, !!p.horizontal, !!p.vertical),
  css: () => null,
});

/** `flip()` mirrors left ↔ right; `flip(false, true)` top ↔ bottom. */
export const flip = (horizontal = true, vertical = false): ImageOp<FlipParams> => opOf(FLIP, { horizontal, vertical });
