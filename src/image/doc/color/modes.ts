// Image › Mode and Edit › Assign / Convert to Profile. Each command is one undo step. Pixel conversions run tile by
// tile on every raster of the tree (pixel, text, shape, smart caches); solid fill layers convert their color too.
// Grayscale, bitmap and indexed keep RGB storage (r = g = b, or palette colors) with the mode recorded on the
// document; Lab mode keeps RGB pixels with doc.mode = "lab" (editing stays in RGB; the flag drives the picker and export).

import type { ColorMode, ImageDocument } from "../document.ts";
import { hasRaster, walk, type Layer, type Paint, type RGBA } from "../layers.ts";
import { TILE, keyTx, keyTy, type BitDepth, type TiledRaster } from "../tiles.ts";
import { converter, getProfile, type Intent } from "./profiles.ts";

/** Run fn over every stored tile of a raster as a document-space straight RGBA float block (written back). */
export function mapRasterTiles(r: TiledRaster, fn: (px: Float32Array, x: number, y: number, w: number, h: number) => void): void {
  for (const k of [...r.tiles.keys()]) {
    const x = keyTx(k) * TILE + r.ox, y = keyTy(k) * TILE + r.oy;
    const px = r.read(x, y, TILE, TILE);
    fn(px, x, y, TILE, TILE);
    r.write(x, y, TILE, TILE, px);
  }
}

function rasters(doc: ImageDocument): TiledRaster[] {
  const out: TiledRaster[] = [];
  for (const [l] of walk(doc.layers)) if (hasRaster(l)) out.push(l.raster);
  return out;
}
function mapPaintColors(p: Paint, f: (c: RGBA) => RGBA): Paint {
  if (p.type === "solid") return { ...p, color: f(p.color) };
  if (p.type === "gradient") return { ...p, gradient: { ...p.gradient, stops: p.gradient.stops.map((s) => ({ ...s, color: f(s.color) })) } };
  return p;
}
function mapLayerColors(l: Layer, f: (c: RGBA) => RGBA): void {
  if (l.kind === "fill") l.paint = mapPaintColors(l.paint, f);
  if (l.kind === "shape" && l.fillPaint) l.fillPaint = mapPaintColors(l.fillPaint, f);
  if (l.kind === "artboard" && l.background) l.background = f(l.background);
}

/** Edit › Assign Profile: metadata only, pixels keep their numbers (colors look different). */
export function assignProfile(doc: ImageDocument, name: string): void {
  doc.change("Assign Profile", () => { doc.profile = getProfile(name).name; });
}

/** Edit › Convert to Profile: pixel numbers change so colors look the same (within the destination gamut). */
export function convertToProfile(doc: ImageDocument, name: string, intent: Intent = "relative"): void {
  const dst = getProfile(name), cv = converter(doc.profile, dst, intent);
  doc.change("Convert to Profile", () => {
    for (const r of rasters(doc)) mapRasterTiles(r, (px) => cv.pixels(px));
    const f = (c: RGBA): RGBA => { const o = cv.color(c); return [o[0], o[1], o[2], c[3]]; };
    for (const [l] of walk(doc.layers)) mapLayerColors(l, f);
    doc.profile = dst.name;
    if (dst.kind === "gray" && doc.mode !== "gray") doc.mode = "gray";
    if (dst.kind === "rgb" && doc.mode === "gray") doc.mode = "rgb";
  });
}

const luma = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Luminance in the encoded space of the profile (what a gray conversion keeps). */
function grayOf(doc: ImageDocument): (r: number, g: number, b: number) => number {
  const cv = converter(doc.profile, "Gray Gamma 2.2", "relative");
  const gp = getProfile(doc.profile);
  if (gp.kind === "gray") return (r) => r;
  // the gray conversion is luminance (relative colorimetric to a gray profile of the same gamma family)
  return (r, g, b) => cv.color([r, g, b])[0];
}

/** Image › Mode › Grayscale (luminance). */
export function toGrayscale(doc: ImageDocument): void {
  const gray = grayOf(doc);
  doc.change("Grayscale", () => {
    for (const r of rasters(doc)) mapRasterTiles(r, (px) => {
      for (let i = 0; i < px.length; i += 4) { if (px[i + 3]! <= 0) continue; const v = gray(px[i]!, px[i + 1]!, px[i + 2]!); px[i] = px[i + 1] = px[i + 2] = v; }
    });
    for (const [l] of walk(doc.layers)) mapLayerColors(l, (c) => { const v = gray(c[0], c[1], c[2]); return [v, v, v, c[3]]; });
    doc.mode = "gray";
    doc.profile = "Gray Gamma 2.2";
  });
}

/** 8×8 ordered dither matrix (0–63). */
const BAYER8 = (() => {
  let m = [0];
  for (let n = 1; n < 8; n *= 2) {
    const next = new Array<number>(4 * n * n);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const v = 4 * m[y * n + x]!;
      next[y * 2 * n + x] = v; next[y * 2 * n + x + n] = v + 2; next[(y + n) * 2 * n + x] = v + 3; next[(y + n) * 2 * n + x + n] = v + 1;
    }
    m = next;
  }
  return Uint8Array.from(m);
})();

export type BitmapMethod = "threshold" | "pattern" | "diffusion";

/**
 * Image › Mode › Bitmap: 1-bit black / white by a 50 % threshold, an ordered pattern dither or Floyd–Steinberg
 * error diffusion (over each raster's tile-aligned bounds, so diffusion crosses tile edges).
 */
export function toBitmap(doc: ImageDocument, method: BitmapMethod = "diffusion", threshold = 0.5): void {
  const gray = grayOf(doc);
  doc.change("Bitmap", () => {
    for (const r of rasters(doc)) {
      const b = r.tileBounds();
      if (!b) continue;
      const px = r.read(b.x, b.y, b.w, b.h), w = b.w, h = b.h;
      const lum = new Float32Array(w * h);
      for (let i = 0; i < w * h; i++) lum[i] = gray(px[i * 4]!, px[i * 4 + 1]!, px[i * 4 + 2]!);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const i = y * w + x, old = lum[i]!;
        let v: number;
        if (method === "threshold") v = old >= threshold ? 1 : 0;
        else if (method === "pattern") v = old > (BAYER8[((b.y + y) & 7) * 8 + ((b.x + x) & 7)]! + 0.5) / 64 ? 1 : 0;
        else {
          v = old >= threshold ? 1 : 0;
          const e = old - v;
          if (x + 1 < w) lum[i + 1]! += (e * 7) / 16;
          if (y + 1 < h) {
            if (x > 0) lum[i + w - 1]! += (e * 3) / 16;
            lum[i + w]! += (e * 5) / 16;
            if (x + 1 < w) lum[i + w + 1]! += e / 16;
          }
        }
        px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v;
      }
      r.write(b.x, b.y, b.w, b.h, px);
    }
    for (const [l] of walk(doc.layers)) mapLayerColors(l, (c) => { const v = gray(c[0], c[1], c[2]) >= threshold ? 1 : 0; return [v, v, v, c[3]]; });
    doc.mode = "bitmap";
  });
}

/** Median cut: up to `colors` palette entries from straight RGBA floats (transparent pixels ignored). */
export function medianCut(px: Float32Array, colors = 256, maxSamples = 1 << 18): RGBA[] {
  const n = px.length >> 2, step = Math.max(1, Math.floor(n / maxSamples));
  const pts: number[] = [];
  for (let i = 0; i < n; i += step) if (px[i * 4 + 3]! > 0) pts.push(px[i * 4]!, px[i * 4 + 1]!, px[i * 4 + 2]!);
  if (!pts.length) return [[0, 0, 0, 1]];
  const data = new Float32Array(pts);
  type Box = { idx: Uint32Array };
  const all = new Uint32Array(data.length / 3);
  for (let i = 0; i < all.length; i++) all[i] = i;
  let boxes: Box[] = [{ idx: all }];
  const range = (b: Box): [number, number] => {
    let best = -1, ch = 0;
    for (let c = 0; c < 3; c++) {
      let lo = Infinity, hi = -Infinity;
      for (const i of b.idx) { const v = data[i * 3 + c]!; if (v < lo) lo = v; if (v > hi) hi = v; }
      if (hi - lo > best) { best = hi - lo; ch = c; }
    }
    return [best, ch];
  };
  while (boxes.length < colors) {
    let pick = -1, pr = 0, pc = 0;
    for (let i = 0; i < boxes.length; i++) {
      if (boxes[i]!.idx.length < 2) continue;
      const [r, c] = range(boxes[i]!);
      // weigh by population so dense ranges split first
      const score = r * Math.sqrt(boxes[i]!.idx.length);
      if (score > pr) { pr = score; pick = i; pc = c; }
    }
    if (pick < 0 || pr <= 0) break;
    const b = boxes[pick]!, sorted = [...b.idx].sort((x, y) => data[x * 3 + pc]! - data[y * 3 + pc]!), mid = sorted.length >> 1;
    boxes = [...boxes.slice(0, pick), { idx: Uint32Array.from(sorted.slice(0, mid)) }, { idx: Uint32Array.from(sorted.slice(mid)) }, ...boxes.slice(pick + 1)];
  }
  return boxes.map((b) => {
    const s = [0, 0, 0];
    for (const i of b.idx) { s[0]! += data[i * 3]!; s[1]! += data[i * 3 + 1]!; s[2]! += data[i * 3 + 2]!; }
    const k = 1 / Math.max(1, b.idx.length);
    return [s[0]! * k, s[1]! * k, s[2]! * k, 1] as RGBA;
  });
}

function nearestIndex(pal: RGBA[], r: number, g: number, b: number): number {
  let best = 0, bd = Infinity;
  for (let i = 0; i < pal.length; i++) {
    const c = pal[i]!, d = (c[0] - r) ** 2 * 0.3 + (c[1] - g) ** 2 * 0.59 + (c[2] - b) ** 2 * 0.11;
    if (d < bd) { bd = d; best = i; }
  }
  return best;
}

/** Map straight RGBA floats to a palette in place (optional Floyd–Steinberg diffusion). */
export function quantize(px: Float32Array, w: number, h: number, pal: RGBA[], dither: boolean): Float32Array {
  const err = dither ? new Float32Array(w * h * 3) : null;
  const memo = new Map<number, number>();
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const p = y * w + x, i = p * 4;
    if (px[i + 3]! <= 0) continue;
    let r = px[i]!, g = px[i + 1]!, b = px[i + 2]!;
    if (err) { r += err[p * 3]!; g += err[p * 3 + 1]!; b += err[p * 3 + 2]!; }
    const key = (Math.round(Math.max(0, Math.min(1, r)) * 255) << 16) | (Math.round(Math.max(0, Math.min(1, g)) * 255) << 8) | Math.round(Math.max(0, Math.min(1, b)) * 255);
    let k = memo.get(key);
    if (k === undefined) { k = nearestIndex(pal, r, g, b); memo.set(key, k); }
    const c = pal[k]!;
    if (err) {
      const e = [r - c[0], g - c[1], b - c[2]];
      const spread = (dx: number, dy: number, f: number): void => {
        const xx = x + dx, yy = y + dy;
        if (xx < 0 || xx >= w || yy >= h) return;
        const q = (yy * w + xx) * 3;
        err[q]! += e[0]! * f; err[q + 1]! += e[1]! * f; err[q + 2]! += e[2]! * f;
      };
      spread(1, 0, 7 / 16); spread(-1, 1, 3 / 16); spread(0, 1, 5 / 16); spread(1, 1, 1 / 16);
    }
    px[i] = c[0]; px[i + 1] = c[1]; px[i + 2] = c[2];
  }
  return px;
}

/** Image › Mode › Indexed Color: a median cut palette of the visible layers' pixels, optional diffusion dither. */
export function toIndexed(doc: ImageDocument, o: { colors?: number; dither?: boolean; palette?: RGBA[] } = {}): RGBA[] {
  let pal = o.palette ?? null;
  if (!pal) {
    // sample every raster (the palette must cover each layer, not only the top composite)
    const chunks: Float32Array[] = [];
    for (const r of rasters(doc)) for (const k of r.tiles.keys()) chunks.push(r.read(keyTx(k) * TILE + r.ox, keyTy(k) * TILE + r.oy, TILE, TILE));
    const all = new Float32Array(chunks.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of chunks) { all.set(c, at); at += c.length; }
    pal = medianCut(all, o.colors ?? 256);
  }
  const palette = pal;
  doc.change("Indexed Color", () => {
    for (const r of rasters(doc)) {
      const b = r.tileBounds();
      if (!b) continue;
      const px = r.read(b.x, b.y, b.w, b.h);
      quantize(px, b.w, b.h, palette, !!o.dither);
      r.write(b.x, b.y, b.w, b.h, px);
    }
    for (const [l] of walk(doc.layers)) mapLayerColors(l, (c) => { const p = palette[nearestIndex(palette, c[0], c[1], c[2])]!; return [p[0], p[1], p[2], c[3]]; });
    doc.mode = "indexed";
    doc.meta = { ...doc.meta, palette: palette.map((c) => [...c]) };
  });
  return palette;
}

/** Image › Mode › Lab Color: pixels stay RGB, the document is flagged Lab (pickers and export work in Lab). */
export function toLabMode(doc: ImageDocument): void {
  doc.change("Lab Color", () => { doc.mode = "lab"; doc.meta = { ...doc.meta, labStoredAsRgb: true }; });
}

/** Image › Mode › RGB Color (from gray, bitmap, indexed, Lab, CMYK). */
export function toRgbMode(doc: ImageDocument, profile = "sRGB IEC61966-2.1"): void {
  doc.change("RGB Color", () => {
    if (getProfile(doc.profile).kind === "gray") doc.profile = getProfile(profile).name;
    doc.mode = "rgb";
    const { palette: _p, labStoredAsRgb: _l, ...rest } = doc.meta;
    void _p; void _l;
    doc.meta = rest;
  });
}

/** Image › Mode › 8 / 16 / 32 Bits per Channel. */
export function setBitDepth(doc: ImageDocument, depth: BitDepth): void {
  if (doc.depth === depth) return;
  doc.change(`${depth} Bits/Channel`, () => {
    for (const [l] of walk(doc.layers)) if (hasRaster(l)) l.raster = l.raster.convert(depth);
    doc.depth = depth;
  });
}

/** One entry point for Image › Mode. */
export function setMode(doc: ImageDocument, mode: ColorMode, o: { bitmap?: BitmapMethod; colors?: number; dither?: boolean } = {}): void {
  switch (mode) {
    case "gray": toGrayscale(doc); break;
    case "bitmap": doc.change("Bitmap", () => { if (doc.mode !== "gray") toGrayscale(doc); toBitmap(doc, o.bitmap ?? "diffusion"); }); break;
    case "indexed": toIndexed(doc, { colors: o.colors ?? 256, dither: o.dither ?? true }); break;
    case "lab": toLabMode(doc); break;
    case "rgb": toRgbMode(doc); break;
    case "cmyk": doc.change("CMYK Color", () => { doc.mode = "cmyk"; doc.proof = { ...doc.proof, on: true }; }); break;
  }
}

export { luma };
