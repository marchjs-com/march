// Export: the document, a region, a layer, an artboard or a slice as PNG / JPEG / WebP / AVIF / TIFF / SVG /
// .march-image, at any scale, over a matte, with metadata and a color profile. JPEG / WebP / AVIF (and PNG when asked)
// go through the runtime's canvas encoder (OffscreenCanvas.convertToBlob or canvas.toBlob); PNG, TIFF and SVG have
// their own encoders and work everywhere (Node too). Export As (several targets × @1x/@2x/@3x), size prediction and a
// quality sweep to fit a byte budget.

import type { ImageDocument } from "../document.ts";
import { renderLayer, renderRegion } from "../composite.ts";
import { saveDocument } from "../format.ts";
import { rectIntersect, type Rect } from "../tiles.ts";
import { encodePng, type RawImage } from "./png.ts";
import { encodeTiff } from "./tiff.ts";
import { exportSvg } from "./svg.ts";
import { layerBounds, sliceRects } from "./slices.ts";

export * from "./png.ts";
export * from "./tiff.ts";
export * from "./svg.ts";
export * from "./slices.ts";
export * from "./zlib.ts";

export type ExportFormat = "png" | "jpeg" | "webp" | "avif" | "tiff" | "svg" | "march-image";

export const MIME_TYPES: Record<ExportFormat, string> = {
  png: "image/png", jpeg: "image/jpeg", webp: "image/webp", avif: "image/avif", tiff: "image/tiff", svg: "image/svg+xml", "march-image": "application/x-march-image",
};
export const EXTENSIONS: Record<ExportFormat, string> = { png: "png", jpeg: "jpg", webp: "webp", avif: "avif", tiff: "tif", svg: "svg", "march-image": "march-image" };

export interface ExportMetadata { title?: string; author?: string; copyright?: string; description?: string; software?: string }

export interface ExportOptions {
  format: ExportFormat;
  /** 0–1 for JPEG / WebP / AVIF (default 0.9). */
  quality?: number | undefined;
  /** Output scale (2 = @2x). */
  scale?: number | undefined;
  /** Exact output size (overrides scale). */
  width?: number | undefined;
  height?: number | undefined;
  /** What to export (default: the whole document). */
  region?: Rect | undefined;
  layerId?: string | undefined;
  artboardId?: string | undefined;
  sliceId?: string | undefined;
  /** Composite over this color (formats without alpha use white when unset). */
  matte?: [number, number, number] | undefined;
  /** 8 (default) or 16 bits per channel (PNG, TIFF). */
  depth?: 8 | 16 | undefined;
  metadata?: ExportMetadata | undefined;
  /** "srgb" tags the file as sRGB; an ICC profile is embedded (PNG, TIFF); null writes none. */
  colorProfile?: "srgb" | { name: string; icc: Uint8Array } | null | undefined;
  /** TIFF compression. */
  tiffCompression?: "none" | "packbits" | "lzw" | undefined;
  /** PNG through the canvas encoder instead of March's (smaller files in browsers, no 16-bit, no metadata). */
  canvasPng?: boolean | undefined;
  /** Resampler for scaled exports (march/image's when present); default: box / bilinear. */
  resample?: ((px: Float32Array, w: number, h: number, dw: number, dh: number) => Float32Array) | undefined;
}

export interface ExportResult { bytes: Uint8Array; mime: string; width: number; height: number; format: ExportFormat }

// ——— encoders the runtime has ———

type CanvasLike = { getContext(t: "2d"): { putImageData(d: ImageData, x: number, y: number): void } | null };
const encodeCache = new Map<string, boolean>();

function makeCanvas(w: number, h: number): (CanvasLike & { convertToBlob?: (o: { type: string; quality?: number }) => Promise<Blob>; toBlob?: (cb: (b: Blob | null) => void, type: string, q?: number) => void }) | null {
  const g = globalThis as { OffscreenCanvas?: new (w: number, h: number) => unknown; document?: { createElement(t: string): unknown } };
  if (typeof g.OffscreenCanvas === "function") return new g.OffscreenCanvas(w, h) as never;
  if (g.document) { const c = g.document.createElement("canvas") as { width: number; height: number }; c.width = w; c.height = h; return c as never; }
  return null;
}

async function canvasEncode(rgba: Uint8ClampedArray, w: number, h: number, mime: string, quality?: number): Promise<Blob | null> {
  const c = makeCanvas(w, h);
  const ID = (globalThis as { ImageData?: typeof ImageData }).ImageData;
  if (!c || !ID) return null;
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.putImageData(new ID(rgba as Uint8ClampedArray<ArrayBuffer>, w, h), 0, 0);
  if (c.convertToBlob) return c.convertToBlob(quality == null ? { type: mime } : { type: mime, quality });
  if (c.toBlob) return new Promise((res) => c.toBlob!((b) => res(b), mime, quality));
  return null;
}

/** Can this runtime encode the format? (Canvas encoders are probed once: browsers fall back to PNG silently.) */
export async function canEncode(format: ExportFormat): Promise<boolean> {
  if (format === "png" || format === "tiff" || format === "svg" || format === "march-image") return true;
  const mime = MIME_TYPES[format];
  const hit = encodeCache.get(mime);
  if (hit !== undefined) return hit;
  let ok = false;
  try { const b = await canvasEncode(new Uint8ClampedArray(4), 1, 1, mime, 0.8); ok = !!b && b.type === mime; } catch { ok = false; }
  encodeCache.set(mime, ok);
  return ok;
}

/** Every format with whether this runtime can write it. */
export async function encodableFormats(): Promise<Record<ExportFormat, boolean>> {
  const out = {} as Record<ExportFormat, boolean>;
  for (const f of Object.keys(MIME_TYPES) as ExportFormat[]) out[f] = await canEncode(f);
  return out;
}

// ——— pixels ———

/** Box filter for shrinking, bilinear for enlarging (premultiplied RGBA). Fallback until march/image lands. */
export function resampleRGBA(px: Float32Array, w: number, h: number, dw: number, dh: number): Float32Array {
  const out = new Float32Array(dw * dh * 4);
  const sx = w / dw, sy = h / dh;
  if (sx >= 1 && sy >= 1) {
    for (let y = 0; y < dh; y++) {
      const y0 = y * sy, y1 = y0 + sy;
      for (let x = 0; x < dw; x++) {
        const x0 = x * sx, x1 = x0 + sx;
        let r = 0, g = 0, b = 0, a = 0, wsum = 0;
        for (let yy = Math.floor(y0); yy < Math.ceil(y1) && yy < h; yy++) {
          const wy = Math.min(yy + 1, y1) - Math.max(yy, y0);
          for (let xx = Math.floor(x0); xx < Math.ceil(x1) && xx < w; xx++) {
            const wt = wy * (Math.min(xx + 1, x1) - Math.max(xx, x0)), i = (yy * w + xx) * 4;
            r += px[i]! * wt; g += px[i + 1]! * wt; b += px[i + 2]! * wt; a += px[i + 3]! * wt; wsum += wt;
          }
        }
        const o = (y * dw + x) * 4, k = wsum ? 1 / wsum : 0;
        out[o] = r * k; out[o + 1] = g * k; out[o + 2] = b * k; out[o + 3] = a * k;
      }
    }
    return out;
  }
  for (let y = 0; y < dh; y++) {
    const fy = Math.max(0, Math.min(h - 1, (y + 0.5) * sy - 0.5)), y0 = Math.floor(fy), y1 = Math.min(h - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < dw; x++) {
      const fx = Math.max(0, Math.min(w - 1, (x + 0.5) * sx - 0.5)), x0 = Math.floor(fx), x1 = Math.min(w - 1, x0 + 1), tx = fx - x0;
      const o = (y * dw + x) * 4;
      for (let c = 0; c < 4; c++) {
        const a = px[(y0 * w + x0) * 4 + c]!, b = px[(y0 * w + x1) * 4 + c]!, cc = px[(y1 * w + x0) * 4 + c]!, d = px[(y1 * w + x1) * 4 + c]!;
        out[o + c] = (a * (1 - tx) + b * tx) * (1 - ty) + (cc * (1 - tx) + d * tx) * ty;
      }
    }
  }
  return out;
}

/** The rectangle and premultiplied pixels of an export target. */
export function exportPixels(doc: ImageDocument, o: Omit<ExportOptions, "format"> = {}): { rect: Rect; px: Float32Array } {
  let rect: Rect = doc.bounds;
  let px: Float32Array | null = null;
  if (o.layerId) {
    const l = doc.find(o.layerId);
    if (!l) throw new Error(`No layer ${o.layerId}`);
    rect = (o.region ?? layerBounds(doc, l)) ?? { x: 0, y: 0, w: 1, h: 1 };
    const s = renderLayer(doc, l, rect);
    premultiply(s);
    px = s;
  } else if (o.artboardId) {
    const a = doc.find(o.artboardId);
    if (!a || a.kind !== "artboard") throw new Error(`No artboard ${o.artboardId}`);
    rect = o.region ?? a.rect;
    const s = renderLayer(doc, a, rect);
    premultiply(s);
    if (a.background) {
      const [r, g, b, al] = a.background;
      for (let i = 0; i < s.length; i += 4) { const k = 1 - s[i + 3]!; s[i] = s[i]! + r * al * k; s[i + 1] = s[i + 1]! + g * al * k; s[i + 2] = s[i + 2]! + b * al * k; s[i + 3] = s[i + 3]! + al * k; }
    }
    px = s;
  } else if (o.sliceId) {
    const s = sliceRects(doc).find((x) => x.id === o.sliceId);
    if (!s) throw new Error(`No slice ${o.sliceId}`);
    rect = s.rect;
  } else if (o.region) rect = rectIntersect(o.region, doc.bounds) ?? o.region;
  if (!px) px = renderRegion(doc, rect);
  return { rect, px };
}

function premultiply(s: Float32Array): void {
  for (let i = 0; i < s.length; i += 4) { const a = s[i + 3]!; s[i] = s[i]! * a; s[i + 1] = s[i + 1]! * a; s[i + 2] = s[i + 2]! * a; }
}

/** Premultiplied float → straight 8 / 16-bit RGBA (over a matte when given). */
export function toRaw(px: Float32Array, w: number, h: number, depth: 8 | 16, matte?: [number, number, number] | null, alpha = true): RawImage {
  const max = depth === 8 ? 255 : 65535, ch = alpha && !matte ? 4 : 3;
  const data = depth === 8 ? new Uint8Array(w * h * ch) : new Uint16Array(w * h * ch);
  for (let i = 0, o = 0; i < w * h * 4; i += 4, o += ch) {
    const a = Math.min(1, Math.max(0, px[i + 3]!));
    let r = px[i]!, g = px[i + 1]!, b = px[i + 2]!;
    if (matte) { r += matte[0] * (1 - a); g += matte[1] * (1 - a); b += matte[2] * (1 - a); }
    else if (a > 0) { r /= a; g /= a; b /= a; }
    data[o] = Math.round(Math.min(1, Math.max(0, r)) * max); data[o + 1] = Math.round(Math.min(1, Math.max(0, g)) * max); data[o + 2] = Math.round(Math.min(1, Math.max(0, b)) * max);
    if (ch === 4) data[o + 3] = Math.round(a * max);
  }
  return { width: w, height: h, channels: ch as 3 | 4, depth, data };
}

/** Export a document (or a part of it) as file bytes. */
export async function exportImage(doc: ImageDocument, o: ExportOptions): Promise<ExportResult> {
  const fmt = o.format;
  if (fmt === "march-image") return { bytes: await saveDocument(doc), mime: MIME_TYPES[fmt], width: doc.width, height: doc.height, format: fmt };
  if (fmt === "svg") {
    const { rect } = o.layerId || o.artboardId || o.sliceId || o.region ? exportPixels(doc, { ...o, ...(o.layerId ? {} : {}) }) : { rect: doc.bounds };
    const s = await exportSvg(doc, { region: rect, title: o.metadata?.title });
    return { bytes: new TextEncoder().encode(s), mime: MIME_TYPES.svg, width: rect.w, height: rect.h, format: fmt };
  }
  const { rect, px: full } = exportPixels(doc, o);
  const scale = o.scale ?? 1;
  const dw = Math.max(1, Math.round(o.width ?? (o.height ? (rect.w * o.height) / rect.h : rect.w * scale)));
  const dh = Math.max(1, Math.round(o.height ?? (o.width ? (rect.h * o.width) / rect.w : rect.h * scale)));
  const px = dw === rect.w && dh === rect.h ? full : (o.resample ?? resampleRGBA)(full, rect.w, rect.h, dw, dh);
  const md = o.metadata ?? {};
  const opaque = fmt === "jpeg";
  const matte = o.matte ?? (opaque ? [1, 1, 1] as [number, number, number] : null);
  if (fmt === "tiff") {
    const raw = toRaw(px, dw, dh, o.depth ?? 8, matte);
    const text: NonNullable<Parameters<typeof encodeTiff>[1]>["text"] = { software: md.software ?? "March" };
    if (md.title) text.title = md.title;
    if (md.description) text.description = md.description;
    if (md.author) text.artist = md.author;
    if (md.copyright) text.copyright = md.copyright;
    const icc = o.colorProfile && o.colorProfile !== "srgb" ? o.colorProfile.icc : undefined;
    const bytes = encodeTiff(raw, { compression: o.tiffCompression ?? "lzw", dpi: doc.dpi * scale, text, ...(icc ? { icc } : {}) });
    return { bytes, mime: MIME_TYPES.tiff, width: dw, height: dh, format: fmt };
  }
  if (fmt === "png" && !o.canvasPng) {
    const raw = toRaw(px, dw, dh, o.depth ?? 8, matte);
    const text: Record<string, string> = { Software: md.software ?? "March" };
    if (md.title) text.Title = md.title;
    if (md.author) text.Author = md.author;
    if (md.copyright) text.Copyright = md.copyright;
    if (md.description) text.Description = md.description;
    const bytes = await encodePng(raw, { dpi: doc.dpi * scale, text, colorProfile: o.colorProfile === undefined ? "srgb" : o.colorProfile });
    return { bytes, mime: MIME_TYPES.png, width: dw, height: dh, format: fmt };
  }
  const mime = MIME_TYPES[fmt];
  if (!(await canEncode(fmt))) throw new Error(`This runtime cannot encode ${fmt.toUpperCase()}`);
  const raw = toRaw(px, dw, dh, 8, matte, true);
  const rgba = new Uint8ClampedArray(dw * dh * 4);
  if (raw.channels === 4) rgba.set(raw.data as Uint8Array);
  else for (let i = 0, o2 = 0; i < rgba.length; i += 4, o2 += 3) { rgba[i] = raw.data[o2]!; rgba[i + 1] = raw.data[o2 + 1]!; rgba[i + 2] = raw.data[o2 + 2]!; rgba[i + 3] = 255; }
  const blob = await canvasEncode(rgba, dw, dh, mime, fmt === "png" ? undefined : o.quality ?? 0.9);
  if (!blob) throw new Error(`This runtime cannot encode ${fmt.toUpperCase()}`);
  return { bytes: new Uint8Array(await blob.arrayBuffer()), mime, width: dw, height: dh, format: fmt };
}

// ——— Export As ———

export interface ExportAsTarget {
  /** "document", or one layer / artboard / slice. */
  target: "document" | { layerId: string } | { artboardId: string } | { sliceId: string };
  /** Scales (default [1]); each becomes a file with an @Nx suffix (none for 1). */
  scales?: number[] | undefined;
  format: ExportFormat;
  quality?: number | undefined;
  /** File name without extension (default: the target's name). */
  name?: string | undefined;
  suffix?: string | undefined;
}
export interface ExportedFile { name: string; bytes: Uint8Array; mime: string; width: number; height: number }

/** A safe file name (no path characters; Turkish and other letters kept). */
export const fileSafe = (s: string): string => s.replace(/[\\/:*?"<>|\u0000-\u001f]+/g, "-").replace(/\s+/g, " ").trim().slice(0, 120) || "untitled";

/** Export several targets at several scales: one file each, named "<name><suffix>@2x.png". */
export async function exportAs(doc: ImageDocument, targets: ExportAsTarget[], common: Partial<ExportOptions> = {}): Promise<ExportedFile[]> {
  const out: ExportedFile[] = [];
  const used = new Set<string>();
  for (const t of targets) {
    let base = t.name, sel: Partial<ExportOptions> = {};
    if (t.target === "document") base ??= doc.name.replace(/\.[^.]+$/, "");
    else if ("layerId" in t.target) { sel = { layerId: t.target.layerId }; base ??= doc.find(t.target.layerId)?.name ?? "layer"; }
    else if ("artboardId" in t.target) { sel = { artboardId: t.target.artboardId }; base ??= doc.find(t.target.artboardId)?.name ?? "artboard"; }
    else { const sid = t.target.sliceId; sel = { sliceId: sid }; base ??= sliceRects(doc).find((s) => s.id === sid)?.name ?? "slice"; }
    for (const scale of t.scales ?? [1]) {
      const r = await exportImage(doc, { ...common, ...sel, format: t.format, quality: t.quality ?? common.quality, scale });
      let name = `${fileSafe(base)}${t.suffix ?? ""}${scale === 1 ? "" : `@${scale}x`}.${EXTENSIONS[t.format]}`;
      for (let i = 2; used.has(name); i++) name = name.replace(/(-\d+)?(\.[^.]+)$/, `-${i}$2`);
      used.add(name);
      out.push({ name, bytes: r.bytes, mime: r.mime, width: r.width, height: r.height });
    }
  }
  return out;
}

// ——— Export for web ———

/** The encoded size in bytes for these options (encodes once). */
export async function predictSize(doc: ImageDocument, o: ExportOptions): Promise<number> {
  return (await exportImage(doc, o)).bytes.length;
}

/**
 * The highest quality whose file fits `maxBytes` (binary search over quality for JPEG / WebP / AVIF; PNG / TIFF have no
 * quality: the scale is reduced instead). Returns the export and the settings used, or the smallest try when nothing fits.
 */
export async function fitToBudget(doc: ImageDocument, o: ExportOptions & { maxBytes: number; minQuality?: number; minScale?: number; steps?: number }): Promise<ExportResult & { quality: number; scale: number; fits: boolean }> {
  const lossy = o.format === "jpeg" || o.format === "webp" || o.format === "avif";
  const steps = o.steps ?? 7;
  let best: (ExportResult & { quality: number; scale: number; fits: boolean }) | null = null;
  let smallest: (ExportResult & { quality: number; scale: number; fits: boolean }) | null = null;
  const take = (r: ExportResult, quality: number, scale: number): void => {
    const x = { ...r, quality, scale, fits: r.bytes.length <= o.maxBytes };
    if (!smallest || r.bytes.length < smallest.bytes.length) smallest = x;
    if (x.fits && (!best || quality * scale > best.quality * best.scale)) best = x;
  };
  if (lossy) {
    let lo = o.minQuality ?? 0.3, hi = o.quality ?? 0.95;
    const top = await exportImage(doc, { ...o, quality: hi });
    take(top, hi, o.scale ?? 1);
    if (top.bytes.length > o.maxBytes) {
      for (let i = 0; i < steps; i++) {
        const q = (lo + hi) / 2;
        const r = await exportImage(doc, { ...o, quality: q });
        take(r, q, o.scale ?? 1);
        if (r.bytes.length <= o.maxBytes) lo = q; else hi = q;
      }
    }
  } else {
    let lo = o.minScale ?? 0.25, hi = o.scale ?? 1;
    const top = await exportImage(doc, { ...o, scale: hi });
    take(top, 1, hi);
    if (top.bytes.length > o.maxBytes) {
      for (let i = 0; i < steps; i++) {
        const s = (lo + hi) / 2;
        const r = await exportImage(doc, { ...o, scale: s });
        take(r, 1, s);
        if (r.bytes.length <= o.maxBytes) lo = s; else hi = s;
      }
    }
  }
  return (best ?? smallest)!;
}
