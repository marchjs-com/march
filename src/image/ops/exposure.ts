// exposure: brightness in stops, as a camera does it (linear light × 2^amount). march/image/ops/exposure
import { defineOp, opOf, type ImageOp } from "../op.ts";

export interface ExposureParams { /** Stops (EV), −5…5. */ amount: number }
export const EXPOSURE = defineOp<ExposureParams>({
  type: "exposure", kind: "color", defaults: { amount: 0 },
  params: { amount: { min: -5, max: 5, step: 0.05, default: 0, centered: true, unit: "EV" } },
  identity: (p) => !p.amount,
  color: (c, p) => { const k = 2 ** p.amount; c[0] = c[0]! * k; c[1] = c[1]! * k; c[2] = c[2]! * k; },
  css: (p) => `brightness(${((2 ** p.amount) ** (1 / 2.2)).toFixed(3)})`,
});
/** Exposure in stops: `exposure(0.5)` is half a stop brighter. */
export const exposure = (amount = 0): ImageOp<ExposureParams> => opOf(EXPOSURE, { amount });
