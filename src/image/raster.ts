// Raster: the engine's working image. Pixels are linear-light floats (RGBA, straight alpha), so blurs, blends and
// exposure act like light; sRGB / Display-P3 encoding happens only on the way in and out (lookup tables, no pow per
// pixel). `space` says which primaries the linear values are in: the math is the same, the canvas gets the same space
// back on output, so a Display-P3 photo keeps its gamut.

/** Colour space of a raster's primaries. */
export type ColorSpace = "srgb" | "display-p3";

/** A linear-light RGBA image (Float32Array, straight alpha, 4 floats per pixel). */
export interface Raster {
  width: number;
  height: number;
  data: Float32Array;
  space: ColorSpace;
}

/** A blank raster (transparent black). */
export const raster = (width: number, height: number, space: ColorSpace = "srgb"): Raster => ({ width, height, data: new Float32Array(Math.max(0, width * height * 4)), space });
/** A copy of a raster (its own pixel array). */
export const cloneRaster = (r: Raster): Raster => ({ width: r.width, height: r.height, data: r.data.slice(), space: r.space });

/** sRGB (and Display-P3: same transfer curve) encoded 0–1 → linear. */
export const toLinear = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
/** Linear → encoded 0–1 (no clamping above 1). */
export const toEncoded = (v: number): number => (v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055);

let dec: Float32Array | null = null, enc: Uint8ClampedArray | null = null, encF: Float32Array | null = null;
const ENC_N = 4096;
/** 8-bit encoded → linear (256 entries). */
export function decodeTable(): Float32Array {
  if (!dec) { dec = new Float32Array(256); for (let i = 0; i < 256; i++) dec[i] = toLinear(i / 255); }
  return dec;
}
/** Linear 0–1 → 8-bit encoded, in 4096 steps (index = linear × 4095). */
export function encodeTable(): Uint8ClampedArray {
  if (!enc) { enc = new Uint8ClampedArray(ENC_N); for (let i = 0; i < ENC_N; i++) enc[i] = Math.round(toEncoded(i / (ENC_N - 1)) * 255); }
  return enc;
}
/** Linear 0–1 → encoded 0–1 float, in 4096 steps. */
export function encodeTableF(): Float32Array {
  if (!encF) { encF = new Float32Array(ENC_N); for (let i = 0; i < ENC_N; i++) encF[i] = toEncoded(i / (ENC_N - 1)); }
  return encF;
}
/** Fast linear → encoded 0–1 (table, clamped to 0–1). */
export const encodeFast = (v: number): number => encodeTableF()[v <= 0 ? 0 : v >= 1 ? ENC_N - 1 : (v * (ENC_N - 1) + 0.5) | 0]!;

/** Rec. 709 / sRGB luminance of linear RGB. */
export const luminance = (r: number, g: number, b: number): number => 0.2126 * r + 0.7152 * g + 0.0722 * b;

/** Pixels (ImageData-like, 8-bit encoded) → raster. */
export function fromPixels(px: { width: number; height: number; data: Uint8ClampedArray | Uint8Array; colorSpace?: string }, space?: ColorSpace): Raster {
  const t = decodeTable(), n = px.width * px.height, out = new Float32Array(n * 4), d = px.data;
  for (let i = 0; i < n * 4; i += 4) { out[i] = t[d[i]!]!; out[i + 1] = t[d[i + 1]!]!; out[i + 2] = t[d[i + 2]!]!; out[i + 3] = d[i + 3]! / 255; }
  return { width: px.width, height: px.height, data: out, space: space ?? (px.colorSpace === "display-p3" ? "display-p3" : "srgb") };
}

/** Raster → 8-bit encoded pixels (into `out` when given). Values outside 0–1 are clipped. */
export function toPixels(r: Raster, out?: Uint8ClampedArray): Uint8ClampedArray {
  const t = encodeTable(), d = r.data, n = r.width * r.height, o = out ?? new Uint8ClampedArray(n * 4), M = ENC_N - 1;
  for (let i = 0; i < n * 4; i += 4) {
    const a = d[i]!, b = d[i + 1]!, c = d[i + 2]!;
    o[i] = t[a <= 0 ? 0 : a >= 1 ? M : (a * M + 0.5) | 0]!;
    o[i + 1] = t[b <= 0 ? 0 : b >= 1 ? M : (b * M + 0.5) | 0]!;
    o[i + 2] = t[c <= 0 ? 0 : c >= 1 ? M : (c * M + 0.5) | 0]!;
    o[i + 3] = d[i + 3]! * 255 + 0.5;
  }
  return o;
}

/** Anything a canvas can draw. */
export type ImageSourceLike = CanvasImageSource | ImageBitmap | OffscreenCanvas;

/** Can this page make a Display-P3 canvas (and is the screen wide-gamut)? */
export function supportsP3(): boolean {
  try { return typeof matchMedia === "function" && matchMedia("(color-gamut: p3)").matches && typeof document !== "undefined" && !!document.createElement("canvas").getContext("2d", { colorSpace: "display-p3" } as CanvasRenderingContext2DSettings); } catch { return false; }
}

/** A 2D canvas (OffscreenCanvas when there is no document, e.g. in a worker). */
export function makeCanvas(w: number, h: number): HTMLCanvasElement | OffscreenCanvas {
  if (typeof document !== "undefined") { const c = document.createElement("canvas"); c.width = w; c.height = h; return c; }
  return new OffscreenCanvas(w, h);
}
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
const ctx2d = (c: HTMLCanvasElement | OffscreenCanvas, space: ColorSpace): Ctx => (c.getContext("2d", { colorSpace: space, willReadFrequently: true } as CanvasRenderingContext2DSettings) ?? c.getContext("2d")) as Ctx;

/** Draw an image source into a raster, scaled so its long edge is at most `maxSide` (default: its own size). */
export function rasterFrom(src: ImageSourceLike, opts: { maxSide?: number | undefined; space?: ColorSpace | undefined } = {}): Raster {
  const s = src as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number; width: number; height: number };
  const w0 = s.naturalWidth || s.videoWidth || s.width, h0 = s.naturalHeight || s.videoHeight || s.height;
  const k = opts.maxSide && Math.max(w0, h0) > opts.maxSide ? opts.maxSide / Math.max(w0, h0) : 1;
  const w = Math.max(1, Math.round(w0 * k)), h = Math.max(1, Math.round(h0 * k)), space = opts.space ?? "srgb";
  const c = makeCanvas(w, h), x = ctx2d(c, space);
  x.imageSmoothingQuality = "high";
  x.drawImage(src as CanvasImageSource, 0, 0, w, h);
  const id = x.getImageData(0, 0, w, h, { colorSpace: space } as ImageDataSettings);
  return fromPixels(id, space);
}

/** Write a raster onto a canvas (resizing the canvas to fit), in the raster's colour space. */
export function drawRaster(r: Raster, canvas: HTMLCanvasElement | OffscreenCanvas): void {
  if (canvas.width !== r.width) canvas.width = r.width;
  if (canvas.height !== r.height) canvas.height = r.height;
  const x = ctx2d(canvas, r.space);
  let id: ImageData;
  try { id = new ImageData(r.width, r.height, { colorSpace: r.space } as ImageDataSettings); } catch { id = x.createImageData(r.width, r.height); }
  toPixels(r, id.data);
  x.putImageData(id, 0, 0);
}

/** A raster on a fresh canvas. */
export function rasterToCanvas(r: Raster): HTMLCanvasElement | OffscreenCanvas { const c = makeCanvas(r.width, r.height); drawRaster(r, c); return c; }

/** Bilinear resample to a new size (fast; previews). Lanczos lives in march/image/ops/resize. */
export function resample(r: Raster, w: number, h: number): Raster {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  if (w === r.width && h === r.height) return cloneRaster(r);
  const out = raster(w, h, r.space), s = r.data, d = out.data, W = r.width, H = r.height;
  const sx = W / w, sy = H / h;
  // box average when shrinking a lot (no aliasing), bilinear otherwise
  if (sx >= 2 || sy >= 2) {
    for (let y = 0; y < h; y++) {
      const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
      for (let x = 0; x < w; x++) {
        const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
        let a = 0, b = 0, c = 0, e = 0, n = 0;
        for (let yy = y0; yy < y1 && yy < H; yy++) for (let xx = x0; xx < x1 && xx < W; xx++) { const i = (yy * W + xx) * 4; a += s[i]!; b += s[i + 1]!; c += s[i + 2]!; e += s[i + 3]!; n++; }
        const o = (y * w + x) * 4; d[o] = a / n; d[o + 1] = b / n; d[o + 2] = c / n; d[o + 3] = e / n;
      }
    }
    return out;
  }
  for (let y = 0; y < h; y++) {
    const fy = Math.min(H - 1, Math.max(0, (y + 0.5) * sy - 0.5)), y0 = Math.floor(fy), y1 = Math.min(H - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.min(W - 1, Math.max(0, (x + 0.5) * sx - 0.5)), x0 = Math.floor(fx), x1 = Math.min(W - 1, x0 + 1), tx = fx - x0;
      const i00 = (y0 * W + x0) * 4, i01 = (y0 * W + x1) * 4, i10 = (y1 * W + x0) * 4, i11 = (y1 * W + x1) * 4, o = (y * w + x) * 4;
      for (let k = 0; k < 4; k++) {
        const top = s[i00 + k]! + (s[i01 + k]! - s[i00 + k]!) * tx, bot = s[i10 + k]! + (s[i11 + k]! - s[i10 + k]!) * tx;
        d[o + k] = top + (bot - top) * ty;
      }
    }
  }
  return out;
}

/** Sample a raster at a fractional position (bilinear, edge clamped) into out[0..3]. */
export function sample(r: Raster, x: number, y: number, out: Float32Array | number[]): void {
  const W = r.width, H = r.height, s = r.data;
  x = Math.min(W - 1, Math.max(0, x)); y = Math.min(H - 1, Math.max(0, y));
  const x0 = Math.floor(x), y0 = Math.floor(y), x1 = Math.min(W - 1, x0 + 1), y1 = Math.min(H - 1, y0 + 1), tx = x - x0, ty = y - y0;
  const i00 = (y0 * W + x0) * 4, i01 = (y0 * W + x1) * 4, i10 = (y1 * W + x0) * 4, i11 = (y1 * W + x1) * 4;
  for (let k = 0; k < 4; k++) { const top = s[i00 + k]! + (s[i01 + k]! - s[i00 + k]!) * tx, bot = s[i10 + k]! + (s[i11 + k]! - s[i10 + k]!) * tx; out[k] = top + (bot - top) * ty; }
}
