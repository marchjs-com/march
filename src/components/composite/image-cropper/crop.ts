// Crop geometry: a frame fixed at the center of the view, the image under it panned, zoomed, rotated and mirrored.
// The image always covers the frame, at any angle (the limits below are exact for the rotated rectangle).
import { clamp } from "../../../core/util.ts";
export interface CropState {
  /** 1 = the smallest scale that covers the frame. */
  zoom: number;
  /** Degrees, any value (90° steps and fine angles). */
  rotate: number;
  /** Mirrored horizontally. */
  flip: boolean;
  /** Image center offset from the frame center, in frame widths / heights (−0.5–0.5 typical). */
  x: number;
  y: number;
  /** Frame aspect (width / height); null = free. */
  aspect: number | null;
  /** Frame size as a share of the view (0–1). */
  w: number;
  h: number;
}
/** Starting crop: the whole image, no rotation or flip. */
export const DEFAULT_CROP: CropState = { zoom: 1, rotate: 0, flip: false, x: 0, y: 0, aspect: null, w: 0.84, h: 0.84 };

const rad = (d: number): number => (d * Math.PI) / 180;
/** Scale (screen px per image px) at zoom 1: the rotated image just covers a fw × fh frame. */
export function coverScale(iw: number, ih: number, fw: number, fh: number, deg: number): number {
  const c = Math.abs(Math.cos(rad(deg))), s = Math.abs(Math.sin(rad(deg)));
  return Math.max((fw * c + fh * s) / iw, (fw * s + fh * c) / ih);
}

/** Keep the pan so that the frame stays inside the image. Returns [x, y] in frame units. */
export function clampPan(st: CropState, iw: number, ih: number, fw: number, fh: number): [number, number] {
  const S = coverScale(iw, ih, fw, fh, st.rotate) * st.zoom, a = rad(st.rotate), c = Math.cos(a), s = Math.sin(a);
  // pan in image-aligned axes
  const px = st.x * fw, py = st.y * fh;
  let ux = px * c + py * s, uy = -px * s + py * c;
  const absCos = Math.abs(c), absSin = Math.abs(s);
  const mx = Math.max(0, (iw * S - (fw * absCos + fh * absSin)) / 2), my = Math.max(0, (ih * S - (fw * absSin + fh * absCos)) / 2);
  ux = clamp(ux, -mx, mx);
  uy = clamp(uy, -my, my);
  return [(ux * c - uy * s) / fw, (ux * s + uy * c) / fh];
}

/** The frame (fw × fh px) in a view of vw × vh px for a state: aspect-fitted, centered. */
export function frameSize(st: CropState, vw: number, vh: number): [number, number] {
  let fw = st.w * vw, fh = st.h * vh;
  if (st.aspect) { if (fw / fh > st.aspect) fw = fh * st.aspect; else fh = fw / st.aspect; }
  return [Math.max(16, fw), Math.max(16, fh)];
}

/**
 * Draw the cropped image on a canvas. `width` is the output width (default: the image's own resolution across the
 * frame); the height follows the frame's aspect.
 */
export function cropToCanvas(img: CanvasImageSource & { naturalWidth?: number; naturalHeight?: number; width?: number | SVGAnimatedLength; height?: number | SVGAnimatedLength },
  st: CropState, view: { width: number; height: number }, opts: { width?: number; canvas?: HTMLCanvasElement } = {}): HTMLCanvasElement {
  const iw = img.naturalWidth || Number(img.width) || 1, ih = img.naturalHeight || Number(img.height) || 1;
  const [fw, fh] = frameSize(st, view.width, view.height);
  const S = coverScale(iw, ih, fw, fh, st.rotate) * st.zoom;
  const outW = Math.round(Math.min(4096, opts.width ?? fw / S)), outH = Math.round((outW * fh) / fw);
  const cv = opts.canvas ?? globalThis.document.createElement("canvas");
  cv.width = outW;
  cv.height = outH;
  const ctx = cv.getContext("2d");
  if (!ctx) return cv;
  const k = outW / fw;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, outW, outH);
  ctx.translate(outW / 2, outH / 2);
  ctx.scale(k, k);
  ctx.translate(st.x * fw, st.y * fh);
  ctx.rotate(rad(st.rotate));
  ctx.scale(S * (st.flip ? -1 : 1), S);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, -iw / 2, -ih / 2, iw, ih);
  return cv;
}
