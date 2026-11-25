// crop: keep a rectangle of the image (0–1 fractions, so the same params work on a preview and on the full size),
// optionally turned about its centre and/or cut as a circle (transparent outside). march/image/ops/crop
// `cropFromState` turns ImageCropper's view state (frame fixed, image panned / zoomed / rotated / mirrored) into params.
import { defineOp, opOf, type ImageOp } from "../op.ts";
import type { Raster } from "../raster.ts";
import { rad, warpAffine } from "../geometry.ts";
import { coverScale, frameSize, type CropState } from "../../components/composite/image-cropper/crop.ts";

export interface CropParams {
  /** Left edge, 0–1 of the width (before turning). */
  x: number;
  /** Top edge, 0–1 of the height. */
  y: number;
  /** Width, 0–1 of the image width. */
  w: number;
  /** Height, 0–1 of the image height. */
  h: number;
  /** Degrees the image turns (clockwise) about the crop centre before the upright rectangle is cut. */
  angle: number;
  /** "circle": an ellipse inscribed in the rectangle, transparent outside. */
  shape: "rect" | "circle";
  /** Mirror the image horizontally first (ImageCropper's flip). */
  flip: boolean;
}

/** Cut the crop out of a raster: output is round(w·width) × round(h·height). */
export function cropRaster(r: Raster, p: CropParams): Raster {
  const W = r.width, H = r.height;
  const ow = Math.max(1, Math.round(p.w * W)), oh = Math.max(1, Math.round(p.h * H));
  const kx = (p.w * W) / ow, ky = (p.h * H) / oh, a = rad(p.angle || 0), c = Math.cos(a), s = Math.sin(a);
  const cx = (p.x + p.w / 2) * W, cy = (p.y + p.h / 2) * H;
  // source = centre + R(−angle) · (output − output centre)
  let m0 = c * kx, m1 = s * ky, m2 = cx - (m0 * ow) / 2 - (m1 * oh) / 2;
  const m3 = -s * kx, m4 = c * ky, m5 = cy - (m3 * ow) / 2 - (m4 * oh) / 2;
  if (p.flip) { m0 = -m0; m1 = -m1; m2 = W - m2; }
  const out = warpAffine(r, ow, oh, [m0, m1, m2, m3, m4, m5], "transparent");
  if (p.shape === "circle") {
    // anti-aliased ellipse: alpha × coverage from the normalised distance to the rim (about one pixel wide)
    const d = out.data, rx = ow / 2, ry = oh / 2, px = 1 / Math.min(rx, ry);
    for (let y = 0; y < oh; y++) for (let x = 0; x < ow; x++) {
      const dx = (x + 0.5 - rx) / rx, dy = (y + 0.5 - ry) / ry, dist = Math.sqrt(dx * dx + dy * dy);
      const cov = Math.min(1, Math.max(0, (1 - dist) / px + 0.5));
      d[(y * ow + x) * 4 + 3]! *= cov;
    }
  }
  return out;
}

export const CROP = defineOp<CropParams>({
  type: "crop", kind: "geometry",
  defaults: { x: 0, y: 0, w: 1, h: 1, angle: 0, shape: "rect", flip: false },
  params: {
    x: { min: 0, max: 1, step: 0.001, default: 0 }, y: { min: 0, max: 1, step: 0.001, default: 0 },
    w: { min: 0.01, max: 1, step: 0.001, default: 1 }, h: { min: 0.01, max: 1, step: 0.001, default: 1 },
    angle: { min: -45, max: 45, step: 0.1, default: 0, centered: true, unit: "°" },
  },
  identity: (p) => !p.x && !p.y && p.w === 1 && p.h === 1 && !p.angle && p.shape !== "circle" && !p.flip,
  run: (r, p) => cropRaster(r, p),
  css: () => null,
});

/** A crop: `crop({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })`, `crop({ ..., shape: "circle" })`. */
export const crop = (p: Partial<CropParams> = {}): ImageOp<CropParams> => opOf(CROP, p);

/**
 * ImageCropper's state as crop params: the view is viewW × viewH px, the image imgW × imgH px. The frame shows the image
 * mirrored (flip), turned by `rotate`, scaled and panned; the params cut exactly what the frame shows.
 */
export function cropFromState(state: CropState, viewW: number, viewH: number, imgW: number, imgH: number): CropParams {
  const [fw, fh] = frameSize(state, viewW, viewH);
  const S = coverScale(imgW, imgH, fw, fh, state.rotate) * state.zoom, a = rad(state.rotate), c = Math.cos(a), s = Math.sin(a);
  // frame centre relative to the image centre, in screen px, back into (mirrored) image px: R(−a) · v / S
  const vx = -state.x * fw, vy = -state.y * fh;
  const ox = (c * vx + s * vy) / S, oy = (-s * vx + c * vy) / S;
  const w = fw / S / imgW, h = fh / S / imgH;
  return { x: (imgW / 2 + ox) / imgW - w / 2, y: (imgH / 2 + oy) / imgH - h / 2, w, h, angle: state.rotate, shape: "rect", flip: !!state.flip };
}
