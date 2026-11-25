// straighten: level a tilted photo. `detectHorizon` finds the tilt from strong edges that are nearly horizontal or
// vertical (a magnitude-weighted histogram of gradient orientations within ±15°) and returns the angle that levels
// it; the op turns by that angle and crops to the largest upright rectangle (rotate without expand).
// march/image/ops/straighten
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { luminance, resample, type Raster } from "../raster.ts";
import { rotateRaster } from "./rotate.ts";

export interface StraightenParams { /** Degrees, clockwise (what detectHorizon returns). */ angle: number }

const RANGE = 15, BIN = 0.1, BINS = Math.round((2 * RANGE) / BIN) + 1;

/** The angle (degrees, −15…15, clockwise positive) that levels the image's horizon / verticals; 0 when it finds none. */
export function detectHorizon(r: Raster): number {
  const k = Math.min(1, 480 / Math.max(r.width, r.height));
  const s = k < 1 ? resample(r, r.width * k, r.height * k) : r, W = s.width, H = s.height, d = s.data;
  if (W < 3 || H < 3) return 0;
  const L = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) L[i] = Math.sqrt(Math.max(0, luminance(d[i * 4]!, d[i * 4 + 1]!, d[i * 4 + 2]!))) * d[i * 4 + 3]!;
  // Sobel gradients of the interior
  const n = (W - 2) * (H - 2), mag = new Float32Array(n), ang = new Float32Array(n);
  let max = 0;
  for (let y = 1, j = 0; y < H - 1; y++) for (let x = 1; x < W - 1; x++, j++) {
    const i = y * W + x;
    const gx = L[i - W + 1]! + 2 * L[i + 1]! + L[i + W + 1]! - L[i - W - 1]! - 2 * L[i - 1]! - L[i + W - 1]!;
    const gy = L[i + W - 1]! + 2 * L[i + W]! + L[i + W + 1]! - L[i - W - 1]! - 2 * L[i - W]! - L[i - W + 1]!;
    const m = Math.hypot(gx, gy);
    mag[j] = m;
    if (m > max) max = m;
    // edge direction (perpendicular to the gradient), folded to (−45°, 45°]: horizontal and vertical lines agree
    let a = (Math.atan2(gx, -gy) * 180) / Math.PI;
    a = ((a % 90) + 90) % 90;
    ang[j] = a > 45 ? a - 90 : a;
  }
  if (max < 1e-4) return 0;
  const hist = new Float64Array(BINS), floor = max * 0.2;
  for (let j = 0; j < n; j++) {
    const m = mag[j]!, a = ang[j]!;
    if (m < floor || a < -RANGE || a > RANGE) continue;
    hist[Math.round((a + RANGE) / BIN)]! += m;
  }
  // smooth (±0.5°), pick the peak, then the weighted mean of the raw angles within 1° of it
  let peak = -1, best = 0;
  for (let b = 0; b < BINS; b++) {
    let v = 0;
    for (let t = -5; t <= 5; t++) { const c = b + t; if (c >= 0 && c < BINS) v += hist[c]!; }
    if (v > best) { best = v; peak = b; }
  }
  if (peak < 0) return 0;
  const centre = peak * BIN - RANGE;
  let sw = 0, sa = 0;
  for (let j = 0; j < n; j++) {
    const m = mag[j]!, a = ang[j]!;
    if (m >= floor && Math.abs(a - centre) <= 1) { sw += m; sa += m * a; }
  }
  const tilt = sw ? sa / sw : centre;
  return Math.round(-tilt * 100) / 100 || 0;
}

export const STRAIGHTEN = defineOp<StraightenParams>({
  type: "straighten", kind: "geometry", defaults: { angle: 0 },
  params: { angle: { min: -45, max: 45, step: 0.1, default: 0, centered: true, unit: "°" } },
  identity: (p) => !p.angle,
  run: (r, p) => rotateRaster(r, p.angle, false),
  css: () => null,
});

/** `straighten(detectHorizon(raster))`: level and crop. */
export const straighten = (angle = 0): ImageOp<StraightenParams> => opOf(STRAIGHTEN, { angle });
