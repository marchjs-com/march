// pad: add a border (canvas extend) in px of the full image (a preview scales by ctx.scale) or in % of the side it
// grows along, filled with a colour or transparent; `ratio` then pads, centred, up to a target aspect (square posts,
// 9:16 stories). march/image/ops/pad
import { defineOp, opOf, type ImageOp } from "../op.ts";
import type { Raster } from "../raster.ts";
import { drawOver, filled, paint } from "../geometry.ts";

export interface PadParams {
  top: number;
  right: number;
  bottom: number;
  left: number;
  /** "px": pixels of the full image; "%": percent of the width (left / right) or the height (top / bottom). */
  unit: "px" | "%";
  /** "#rrggbb" or "transparent". */
  color: string;
  /** Target aspect (width / height) reached by more centred padding afterwards; 0: none. */
  ratio: number;
}

/** Pad a raster by whole pixels on each side, then up to an aspect (0: none). */
export function padRaster(r: Raster, top: number, right: number, bottom: number, left: number, color = "transparent", ratio = 0): Raster {
  let t = Math.max(0, Math.round(top)), rr = Math.max(0, Math.round(right)), b = Math.max(0, Math.round(bottom)), l = Math.max(0, Math.round(left));
  let w = r.width + l + rr, h = r.height + t + b;
  if (ratio > 0) {
    if (w / h < ratio) { const add = Math.round(h * ratio) - w; l += Math.floor(add / 2); rr += add - Math.floor(add / 2); w += add; }
    else if (w / h > ratio) { const add = Math.round(w / ratio) - h; t += Math.floor(add / 2); b += add - Math.floor(add / 2); h += add; }
  }
  if (!t && !rr && !b && !l) return r;
  const out = filled(w, h, paint(color), r.space);
  // copy (not blend) the image into place: its own transparency stays
  const s = r.data, d = out.data;
  if (paint(color)[3]) drawOver(out, r, l, t);
  else for (let y = 0; y < r.height; y++) d.set(s.subarray(y * r.width * 4, (y + 1) * r.width * 4), ((y + t) * w + l) * 4);
  return out;
}

export const PAD = defineOp<PadParams>({
  type: "pad", kind: "geometry", defaults: { top: 0, right: 0, bottom: 0, left: 0, unit: "px", color: "transparent", ratio: 0 },
  params: {
    top: { min: 0, max: 2000, step: 1, default: 0 }, right: { min: 0, max: 2000, step: 1, default: 0 },
    bottom: { min: 0, max: 2000, step: 1, default: 0 }, left: { min: 0, max: 2000, step: 1, default: 0 },
    ratio: { min: 0, max: 4, step: 0.01, default: 0 },
  },
  identity: (p) => !p.top && !p.right && !p.bottom && !p.left && !p.ratio,
  run: (r, p, ctx) => {
    const kx = p.unit === "%" ? r.width / 100 : ctx.scale, ky = p.unit === "%" ? r.height / 100 : ctx.scale;
    return padRaster(r, p.top * ky, p.right * kx, p.bottom * ky, p.left * kx, p.color, p.ratio);
  },
  css: () => null,
});

/** `pad({ top: 20, right: 20, bottom: 20, left: 20, color: "#ffffff" })`, `pad({ ratio: 1 })` (square). */
export const pad = (p: Partial<PadParams> = {}): ImageOp<PadParams> => opOf(PAD, p);
