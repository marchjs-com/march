// perspective: rectify a quadrilateral (four corners in 0–1 of the image) into an upright rectangle with a homography
// (bilinear). The output size follows the quad's edge lengths. `keystone` makes corners for the usual two sliders
// (converging verticals / horizontals). march/image/ops/perspective
import { defineOp, opOf, type ImageOp } from "../op.ts";
import type { Raster } from "../raster.ts";
import { solveHomography, warpHomography, type Pt } from "../geometry.ts";

/** Four corners: top-left, top-right, bottom-right, bottom-left, each [x, y] in 0–1. */
export type Quad = [Pt, Pt, Pt, Pt];
export interface PerspectiveParams { corners: Quad }

const IDENTITY: Quad = [[0, 0], [1, 0], [1, 1], [0, 1]];
const dist = (a: Pt, b: Pt): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

/** Rectify a quad of a raster (see PerspectiveParams). */
export function perspectiveRaster(r: Raster, corners: readonly Pt[]): Raster {
  const W = r.width, H = r.height, q = corners.map(([x, y]) => [x * W, y * H] as const);
  const [tl, tr, br, bl] = q as unknown as Quad;
  const ow = Math.max(1, Math.round(Math.max(dist(tl, tr), dist(bl, br)))), oh = Math.max(1, Math.round(Math.max(dist(tl, bl), dist(tr, br))));
  const Hm = solveHomography([[0, 0], [ow, 0], [ow, oh], [0, oh]], q);
  return warpHomography(r, ow, oh, Hm, "transparent");
}

export const PERSPECTIVE = defineOp<PerspectiveParams>({
  type: "perspective", kind: "geometry", defaults: { corners: IDENTITY },
  identity: (p) => p.corners.every((c, i) => c[0] === IDENTITY[i]![0] && c[1] === IDENTITY[i]![1]),
  run: (r, p) => perspectiveRaster(r, p.corners),
  css: () => null,
});

/** `perspective([[0.1, 0], [0.9, 0], [1, 1], [0, 1]])`: the quad becomes the whole output. */
export const perspective = (corners: Quad = IDENTITY): ImageOp<PerspectiveParams> => opOf(PERSPECTIVE, { corners });

/**
 * Corners for keystone sliders (−100…100). vertical > 0 widens the top (fixes a building that narrows upwards: the top
 * corners move in, then stretch to full width); < 0 the bottom. horizontal > 0 does the same for the right edge
 * (its corners move towards the middle vertically), < 0 the left. Up to 30 % of the side moves at ±100.
 */
export function keystone(vertical = 0, horizontal = 0): Quad {
  const k = 0.3 / 100, v = Math.max(-100, Math.min(100, vertical)) * k, h = Math.max(-100, Math.min(100, horizontal)) * k;
  const top = Math.max(0, v) / 2, bottom = Math.max(0, -v) / 2, right = Math.max(0, h) / 2, left = Math.max(0, -h) / 2;
  return [[top, left], [1 - top, right], [1 - bottom, 1 - right], [bottom, 1 - left]];
}
