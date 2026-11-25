// rotate: turn the image by any angle (clockwise positive). Quarter turns move pixels exactly; other angles resample
// (bilinear) and either grow the canvas (transparent or `background` corners) or crop to the largest upright
// rectangle inside. march/image/ops/rotate
import { defineOp, opOf, type ImageOp } from "../op.ts";
import type { Raster } from "../raster.ts";
import { flatten, innerRect, paint, rad, rotate90, warpAffine } from "../geometry.ts";

export interface RotateParams {
  /** Degrees, clockwise. */
  angle: number;
  /** true: the canvas grows to hold the whole image; false: crop to the largest inner rectangle. */
  expand: boolean;
  /** Corner fill when expanding ("#rrggbb"; empty / "transparent": transparent). */
  background: string;
}

/** Turn a raster (see RotateParams). */
export function rotateRaster(r: Raster, angle: number, expand = true, background = ""): Raster {
  const a = ((angle % 360) + 360) % 360;
  if (Math.abs(a - Math.round(a / 90) * 90) < 1e-9) return rotate90(r, Math.round(a / 90));
  const W = r.width, H = r.height, t = rad(angle), c = Math.cos(t), s = Math.sin(t);
  let ow: number, oh: number;
  if (expand) { ow = Math.ceil(W * Math.abs(c) + H * Math.abs(s) - 1e-6); oh = Math.ceil(W * Math.abs(s) + H * Math.abs(c) - 1e-6); }
  else { const [iw, ih] = innerRect(W, H, angle); ow = Math.max(1, Math.floor(iw + 1e-6)); oh = Math.max(1, Math.floor(ih + 1e-6)); }
  // source = image centre + R(−angle) · (output − output centre)
  const m = [c, s, W / 2 - (c * ow) / 2 - (s * oh) / 2, -s, c, H / 2 + (s * ow) / 2 - (c * oh) / 2];
  const out = warpAffine(r, ow, oh, m, expand ? "transparent" : "clamp");
  const bg = paint(background);
  return expand && bg[3] ? flatten(out, bg) : out;
}

export const ROTATE = defineOp<RotateParams>({
  type: "rotate", kind: "geometry", defaults: { angle: 0, expand: true, background: "" },
  params: { angle: { min: -180, max: 180, step: 0.1, default: 0, centered: true, unit: "°" } },
  identity: (p) => !(p.angle % 360),
  run: (r, p) => rotateRaster(r, p.angle, p.expand, p.background),
  css: () => null,
});

/** `rotate(90)` (exact), `rotate(12, false)` (crop to fit), `rotate(30, true, "#ffffff")`. */
export const rotate = (angle = 0, expand = true, background = ""): ImageOp<RotateParams> => opOf(ROTATE, { angle, expand, background });
