// Getting images in: files, drops, pastes, URLs, the camera; decoded by the browser (HEIC / AVIF / WebP where it can),
// turned the right way up from EXIF, and read for the few metadata fields worth showing. Re-encoding through a canvas
// never writes metadata, so every export is stripped of location and camera data by construction.
import { rasterFrom, type ColorSpace, type Raster } from "./raster.ts";

/** What can be loaded. */
export type ImageInput = Blob | File | string | URL | HTMLImageElement | HTMLCanvasElement | ImageBitmap | OffscreenCanvas | HTMLVideoElement;

/** A decoded image. */
export interface LoadedImage {
  /** Upright pixels (EXIF orientation applied). */
  bitmap: ImageBitmap | HTMLImageElement | HTMLCanvasElement | OffscreenCanvas | HTMLVideoElement;
  width: number;
  height: number;
  /** MIME type when known. */
  type: string;
  /** File name when known. */
  name: string;
  /** Size in bytes when known. */
  bytes: number;
  /** Metadata read from the file (JPEG EXIF). */
  meta: ImageMeta;
}

/** Metadata worth showing (and warning about): never written back. */
export interface ImageMeta {
  orientation?: number | undefined;
  make?: string | undefined;
  model?: string | undefined;
  date?: string | undefined;
  /** The file carries a GPS position (export removes it). */
  gps?: boolean | undefined;
  /** Other personal fields found (artist, owner, serial numbers…). */
  personal?: string[] | undefined;
}

/** Can this browser decode a type? (HEIC is Safari only; AVIF / WebP nearly everywhere now.) */
export async function canDecode(type: string): Promise<boolean> {
  const probes: Record<string, string> = {
    "image/webp": "UklGRhoAAABXRUJQVlA4TA0AAAAvAAAAEAcQERGIiP4HAA==",
    "image/avif": "AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=",
  };
  if (/^image\/(png|jpe?g|gif|bmp)$/.test(type)) return true;
  if (typeof createImageBitmap !== "function") return false;
  const b64 = probes[type];
  if (!b64) return type === "image/heic" || type === "image/heif" ? /^((?!chrome|android).)*safari/i.test(globalThis.navigator?.userAgent ?? "") : false;
  try { const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0)); await createImageBitmap(new Blob([bin], { type })); return true; } catch { return false; }
}

/** Read orientation, camera and personal-data flags from a JPEG's EXIF (other formats: {}). */
export async function readMeta(blob: Blob): Promise<ImageMeta> {
  const buf = new DataView(await blob.slice(0, 256 * 1024).arrayBuffer());
  if (buf.byteLength < 4 || buf.getUint16(0) !== 0xffd8) return {};
  let off = 2;
  while (off + 4 < buf.byteLength) {
    const marker = buf.getUint16(off), len = buf.getUint16(off + 2);
    if (marker === 0xffe1 && buf.getUint32(off + 4) === 0x45786966) return parseTiff(buf, off + 10);
    if ((marker & 0xff00) !== 0xff00) break;
    off += 2 + len;
  }
  return {};
}

function parseTiff(v: DataView, base: number): ImageMeta {
  const meta: ImageMeta = {}, personal: string[] = [];
  if (base + 8 > v.byteLength) return meta;
  const le = v.getUint16(base) === 0x4949;
  const u16 = (o: number): number => v.getUint16(base + o, le), u32 = (o: number): number => v.getUint32(base + o, le);
  const str = (o: number, n: number): string => { let s = ""; for (let i = 0; i < n - 1 && base + o + i < v.byteLength; i++) { const c = v.getUint8(base + o + i); if (!c) break; s += String.fromCharCode(c); } return s.trim(); };
  const ifd = (o: number, sub: boolean): void => {
    if (o + 2 > v.byteLength - base) return;
    const n = u16(o);
    for (let i = 0; i < n; i++) {
      const e = o + 2 + i * 12; if (base + e + 12 > v.byteLength) return;
      const tag = u16(e), type = u16(e + 2), count = u32(e + 4), at = count > 4 && type === 2 ? u32(e + 8) : e + 8;
      if (tag === 0x0112) meta.orientation = u16(e + 8);
      else if (tag === 0x010f && type === 2) meta.make = str(at, count);
      else if (tag === 0x0110 && type === 2) meta.model = str(at, count);
      else if ((tag === 0x9003 || tag === 0x0132) && type === 2) meta.date ??= str(at, count);
      else if (tag === 0x8825) meta.gps = true;
      else if (tag === 0x013b) personal.push("artist");
      else if (tag === 0x8298) personal.push("copyright");
      else if (tag === 0xa430) personal.push("owner");
      else if (tag === 0xa431 || tag === 0xa435) personal.push("serial");
      else if (tag === 0x8769 && !sub) ifd(u32(e + 8), true);
    }
  };
  ifd(u32(4), false);
  if (personal.length) meta.personal = personal;
  return meta;
}

const isUrl = (x: unknown): x is string | URL => typeof x === "string" || x instanceof URL;

/**
 * Load and decode an image: a File / Blob (drop, paste, picker), a URL (fetched with CORS so the pixels can be read;
 * the server must allow it, and the page's CSP must allow it in connect-src / img-src), or something already decoded.
 */
export async function loadImage(input: ImageInput, opts: { signal?: AbortSignal | undefined } = {}): Promise<LoadedImage> {
  let blob: Blob | null = null, name = "";
  if (isUrl(input)) {
    const url = String(input);
    const res = await fetch(url, { mode: "cors", credentials: "omit", signal: opts.signal ?? null });
    if (!res.ok) throw new Error(`loadImage: ${res.status} ${url}`);
    blob = await res.blob();
    name = decodeURIComponent(url.split(/[?#]/)[0]!.split("/").pop() ?? "");
  } else if (typeof Blob !== "undefined" && input instanceof Blob) { blob = input; name = (input as File).name ?? ""; }
  if (blob) {
    const meta = await readMeta(blob).catch(() => ({}));
    let bitmap: ImageBitmap;
    try { bitmap = await createImageBitmap(blob, { imageOrientation: "from-image" } as ImageBitmapOptions); }
    catch { throw new Error(`loadImage: this browser cannot decode ${blob.type || "this file"}`); }
    return { bitmap, width: bitmap.width, height: bitmap.height, type: blob.type, name, bytes: blob.size, meta };
  }
  const s = input as { naturalWidth?: number; naturalHeight?: number; videoWidth?: number; videoHeight?: number; width: number; height: number };
  if ((input as HTMLImageElement).decode && !(input as HTMLImageElement).complete) await (input as HTMLImageElement).decode();
  return { bitmap: input as LoadedImage["bitmap"], width: s.naturalWidth || s.videoWidth || s.width, height: s.naturalHeight || s.videoHeight || s.height, type: "", name: "", bytes: 0, meta: {} };
}

/** Load straight into a raster (long edge capped by maxSide: previews). */
export async function loadRaster(input: ImageInput, opts: { maxSide?: number | undefined; space?: ColorSpace | undefined } = {}): Promise<Raster> {
  const img = await loadImage(input);
  return rasterFrom(img.bitmap, opts);
}

/** The image files in a drop or paste event (DataTransfer / ClipboardEvent). */
export function imageFiles(e: DragEvent | ClipboardEvent | DataTransfer | null | undefined): File[] {
  const dt = !e ? null : "items" in e && "files" in e ? (e as DataTransfer) : (e as DragEvent).dataTransfer ?? (e as ClipboardEvent).clipboardData;
  return dt ? [...dt.files].filter((f) => f.type.startsWith("image/")) : [];
}

/** One frame from a video element or a camera stream, as a canvas. */
export async function captureFrame(src: HTMLVideoElement | MediaStream): Promise<HTMLCanvasElement> {
  let video: HTMLVideoElement;
  if (src instanceof HTMLVideoElement) video = src;
  else { video = document.createElement("video"); video.muted = true; video.playsInline = true; video.srcObject = src; await video.play(); }
  const c = document.createElement("canvas");
  c.width = video.videoWidth; c.height = video.videoHeight;
  c.getContext("2d")!.drawImage(video, 0, 0);
  if (!(src instanceof HTMLVideoElement)) video.srcObject = null;
  return c;
}
