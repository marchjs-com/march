// resize: scale the image to a size in pixels of the full image (a preview scales by ctx.scale), exactly, inside
// (contain) or filling and centre-cropping (cover). Lanczos-3 (sharp, premultiplied alpha) or bilinear (fast).
// march/image/ops/resize
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { resample, type Raster } from "../raster.ts";
import { lanczosResize, subRaster } from "../geometry.ts";

export type ResizeMethod = "lanczos" | "bilinear";
export interface ResizeParams {
  /** Target width in px (0: from the height and the aspect). */
  width: number;
  /** Target height in px (0: from the width and the aspect). */
  height: number;
  /** exact: stretch to width × height; contain: fit inside; cover: fill and crop the overflow (centred). */
  fit: "exact" | "contain" | "cover";
  method: ResizeMethod;
}

/** Resize a raster to w × h (no aspect handling). */
export function resizeRaster(r: Raster, w: number, h: number, method: ResizeMethod = "lanczos"): Raster {
  return method === "bilinear" ? resample(r, w, h) : lanczosResize(r, w, h);
}

/** Resize to fit a target box (see ResizeParams); width / height in px of this raster. */
export function fitResize(r: Raster, width: number, height: number, fit: ResizeParams["fit"] = "contain", method: ResizeMethod = "lanczos"): Raster {
  const W = r.width, H = r.height;
  if (!width && !height) return r;
  const tw = width || (W * height) / H, th = height || (H * width) / W;
  if (fit === "exact" || !width || !height) return resizeRaster(r, tw, th, method);
  if (fit === "contain") { const k = Math.min(tw / W, th / H); return resizeRaster(r, W * k, H * k, method); }
  // cover: the centred source window with the target's aspect, scaled to the target
  const k = Math.max(tw / W, th / H), sw = tw / k, sh = th / k, win = { x: (W - sw) / 2, y: (H - sh) / 2, w: sw, h: sh };
  if (method === "lanczos") return lanczosResize(r, tw, th, win);
  const k2 = Math.max(Math.round(tw) / W, Math.round(th) / H), mid = resample(r, Math.ceil(W * k2), Math.ceil(H * k2));
  const ox = Math.floor((mid.width - Math.round(tw)) / 2), oy = Math.floor((mid.height - Math.round(th)) / 2);
  return subRaster(mid, ox, oy, Math.round(tw), Math.round(th));
}

const scaled = (px: number, k: number): number => (px > 0 ? Math.max(1, Math.round(px * k)) : 0);

export const RESIZE = defineOp<ResizeParams>({
  type: "resize", kind: "geometry", defaults: { width: 0, height: 0, fit: "contain", method: "lanczos" },
  params: { width: { min: 0, max: 16384, step: 1, default: 0, unit: "px" }, height: { min: 0, max: 16384, step: 1, default: 0, unit: "px" } },
  identity: (p) => !p.width && !p.height,
  run: (r, p, ctx) => fitResize(r, scaled(p.width, ctx.scale), scaled(p.height, ctx.scale), p.fit, p.method),
  css: () => null,
});

/** `resize(1080, 1080, "cover")`, `resize(2048)` (height from the aspect). */
export const resize = (width = 0, height = 0, fit: ResizeParams["fit"] = "contain", method: ResizeMethod = "lanczos"): ImageOp<ResizeParams> =>
  opOf(RESIZE, { width, height, fit, method });
