// Getting images out: PNG / JPEG / WebP / AVIF (where the browser encodes it) with a quality, a predicted file size,
// a size target (the best quality under N bytes), a resize, and srcset sets. Nothing but pixels is written: no EXIF, no
// location (see io.ts).
import { drawRaster, makeCanvas, resample, type Raster } from "./raster.ts";

/** Output format. */
export type ImageType = "image/png" | "image/jpeg" | "image/webp" | "image/avif";

export interface ExportOptions {
  type?: ImageType | undefined;
  /** 0–1 for lossy formats (default 0.9). */
  quality?: number | undefined;
  /** Output width (height follows the aspect unless given). */
  width?: number | undefined;
  height?: number | undefined;
  /** Best quality whose file is at most this many bytes (lossy formats; binary search, ≤ 7 encodes). */
  maxBytes?: number | undefined;
  /** Fill for transparent pixels in JPEG (default white). */
  background?: string | undefined;
}

type AnyCanvas = HTMLCanvasElement | OffscreenCanvas;
const blobOf = (c: AnyCanvas, type: string, quality?: number): Promise<Blob | null> =>
  "convertToBlob" in c ? (c as OffscreenCanvas).convertToBlob(quality == null ? { type } : { type, quality }).catch(() => null) : new Promise((res) => (c as HTMLCanvasElement).toBlob(res, type, quality));

const encodable = new Map<string, boolean>();
/** Does this browser encode a type (AVIF is not everywhere)? */
export async function canEncode(type: ImageType): Promise<boolean> {
  if (type === "image/png") return true;
  if (!encodable.has(type)) { const b = await blobOf(makeCanvas(2, 2), type, 0.5); encodable.set(type, !!b && b.type === type); }
  return encodable.get(type)!;
}

/** The raster on a canvas at the export size (JPEG gets a background under transparency). */
function prepared(r: Raster, o: ExportOptions): AnyCanvas {
  const w = o.width ? Math.round(o.width) : r.width, h = o.height ? Math.round(o.height) : o.width ? Math.round((r.height * o.width) / r.width) : r.height;
  const src = w !== r.width || h !== r.height ? resample(r, w, h) : r;
  const c = makeCanvas(w, h);
  drawRaster(src, c);
  if (o.type === "image/jpeg") {
    const out = makeCanvas(w, h), x = out.getContext("2d") as CanvasRenderingContext2D;
    x.fillStyle = o.background ?? "#fff"; x.fillRect(0, 0, w, h); x.drawImage(c as CanvasImageSource, 0, 0);
    return out;
  }
  return c;
}

/** Encode a raster. With maxBytes: the highest quality that fits (or the lowest tried). */
export async function exportImage(r: Raster, o: ExportOptions = {}): Promise<Blob> {
  const type = o.type ?? "image/png";
  if (!(await canEncode(type))) throw new Error(`exportImage: this browser cannot encode ${type}`);
  const c = prepared(r, { ...o, type });
  if (!o.maxBytes || type === "image/png") { const b = await blobOf(c, type, o.quality ?? 0.9); if (!b) throw new Error("exportImage: encoding failed"); return b; }
  let lo = 0.05, hi = Math.min(1, o.quality ?? 0.95), best: Blob | null = null;
  const top = await blobOf(c, type, hi);
  if (top && top.size <= o.maxBytes) return top;
  for (let i = 0; i < 6; i++) {
    const q = (lo + hi) / 2, b = await blobOf(c, type, q);
    if (b && b.size <= o.maxBytes) { best = b; lo = q; } else hi = q;
  }
  return best ?? (await blobOf(c, type, 0.05))!;
}

/** Predicted file size in bytes: encode a smaller copy and scale by the pixel count (fast, ±15 % typically). */
export async function predictSize(r: Raster, o: ExportOptions = {}): Promise<number> {
  const type = o.type ?? "image/png", w = o.width ?? r.width, h = o.height ?? (o.width ? (r.height * o.width) / r.width : r.height);
  const k = Math.min(1, 512 / Math.max(w, h)), sw = Math.max(1, Math.round(w * k)), sh = Math.max(1, Math.round(h * k));
  const b = await blobOf(prepared(r, { ...o, type, width: sw, height: sh }), type, o.quality ?? 0.9);
  if (!b) return 0;
  // headers do not grow with the pixels; detail per pixel falls a little as the image grows (≈ area^0.92)
  const head = type === "image/png" ? 60 : 600;
  return Math.round(head + Math.max(0, b.size - head) * ((w * h) / (sw * sh)) ** 0.92);
}

/** One file per width (never wider than the source), for `srcset` / `<Picture>`: [{ width, blob, url }]. */
export async function exportSrcset(r: Raster, widths: readonly number[] = [480, 960, 1440, 1920], o: ExportOptions = {}): Promise<{ width: number; height: number; blob: Blob; url: string }[]> {
  const ws = [...new Set(widths.map((w) => Math.min(r.width, Math.round(w))))].sort((a, b) => a - b);
  const out = [];
  for (const width of ws) {
    const blob = await exportImage(r, { ...o, width });
    out.push({ width, height: Math.round((r.height * width) / r.width), blob, url: URL.createObjectURL(blob) });
  }
  return out;
}

/** The `srcset` attribute for exported files. */
export const srcsetAttr = (files: readonly { width: number; url: string }[]): string => files.map((f) => `${f.url} ${f.width}w`).join(", ");

/** Save a blob as a download (a temporary link; revoked after). */
export function download(blob: Blob, name: string): void {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob); a.download = name; a.rel = "noopener";
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
