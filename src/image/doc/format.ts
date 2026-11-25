// .march-image: the lossless document format. Layout: "MARCHIMG" · u32 version · u32 header length · header JSON
// (UTF-8) · blobs. The header is the document's fields and layer tree with pixel data replaced by references to blobs
// ({ $raster }, { $mask }, { $f32 }, { $u8 }). Blobs are deflated (CompressionStream) when the runtime has it; every
// tile is its own blob, so empty tiles cost nothing.

import { ImageDocument } from "./document.ts";
import { Mask, TiledRaster, keyTx, keyTy, tileKey, newTile, type BitDepth, type PixelArray } from "./tiles.ts";
import { hasRaster, walk, type Layer } from "./layers.ts";

export const FORMAT_MAGIC = "MARCHIMG";
export const FORMAT_VERSION = 1;
export const MIME = "application/x-march-image";

const enc = new TextEncoder(), dec = new TextDecoder();

async function deflate(u: Uint8Array): Promise<Uint8Array | null> {
  const CS = (globalThis as { CompressionStream?: typeof CompressionStream }).CompressionStream;
  if (!CS) return null;
  const s = new Blob([u as BlobPart]).stream().pipeThrough(new CS("deflate-raw"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}
async function inflate(u: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!DS) throw new Error("This runtime cannot read compressed .march-image files");
  const s = new Blob([u as BlobPart]).stream().pipeThrough(new DS("deflate-raw"));
  return new Uint8Array(await new Response(s).arrayBuffer());
}

const bytesOf = (a: ArrayBufferView): Uint8Array => new Uint8Array(a.buffer, a.byteOffset, a.byteLength);

/** Fields of the document written to the header. */
const FIELDS = ["name", "width", "height", "dpi", "mode", "depth", "profile", "activeId", "selected", "selection", "quickMask", "channels", "paths", "guides", "grid", "slices", "notes", "counts", "samplers", "dataSets", "globalLight", "proof", "meta"] as const;

export interface SaveOptions {
  /** Deflate the blobs (default true where the runtime can). */
  compress?: boolean | undefined;
  /** Include a flattened preview PNG-ready RGBA (for file browsers): width of the preview. */
  thumbnail?: number | undefined;
  /** Include the history snapshots. */
  snapshots?: boolean | undefined;
}

/** Serialize a document to bytes. */
export async function saveDocument(doc: ImageDocument, o: SaveOptions = {}): Promise<Uint8Array> {
  const blobs: Uint8Array[] = [];
  const raw: Uint8Array[] = [];
  const add = (u: Uint8Array): number => { raw.push(u); return raw.length - 1; };
  const encode = (v: unknown): unknown => {
    if (v instanceof TiledRaster) {
      const tiles: [number, number, number][] = [];
      for (const [k, t] of v.tiles) tiles.push([keyTx(k), keyTy(k), add(bytesOf(t).slice())]);
      return { $raster: { depth: v.depth, ox: v.ox, oy: v.oy, tiles } };
    }
    if (v instanceof Mask) return { $mask: { w: v.width, h: v.height, outside: v.outside, blob: add(v.data.slice()) } };
    if (v instanceof Float32Array) return { $f32: add(bytesOf(v).slice()) };
    if (v instanceof Uint8Array || v instanceof Uint8ClampedArray) return { $u8: add(bytesOf(v).slice()) };
    if (Array.isArray(v)) return v.map(encode);
    if (v && typeof v === "object") { const o2: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v)) o2[k] = encode(x); return o2; }
    return v;
  };
  const header: Record<string, unknown> = { app: "march", layers: encode(doc.layers) };
  for (const k of FIELDS) header[k] = encode((doc as unknown as Record<string, unknown>)[k]!);
  // one deflate stream over all blobs (per-blob streams cost more time than they save)
  let total = 0;
  for (const u of raw) total += u.byteLength;
  const body = new Uint8Array(total);
  const index: [number, number][] = [];
  let offset = 0;
  for (const u of raw) { body.set(u, offset); index.push([offset, u.byteLength]); offset += u.byteLength; }
  const z = o.compress !== false ? await deflate(body) : null;
  header.blobs = index;
  header.z = z ? 1 : 0;
  const data = z ?? body;
  const hb = enc.encode(JSON.stringify(header));
  const out = new Uint8Array(16 + hb.byteLength + data.byteLength);
  out.set(enc.encode(FORMAT_MAGIC), 0);
  const dv = new DataView(out.buffer);
  dv.setUint32(8, FORMAT_VERSION, true);
  dv.setUint32(12, hb.byteLength, true);
  out.set(hb, 16);
  out.set(data, 16 + hb.byteLength);
  return out;
}

/** True when the bytes are a .march-image file. */
export const isMarchImage = (u: Uint8Array): boolean => u.byteLength > 16 && dec.decode(u.subarray(0, 8)) === FORMAT_MAGIC;

/** Read a document from bytes. */
export async function loadDocument(u: Uint8Array): Promise<ImageDocument> {
  if (!isMarchImage(u)) throw new Error("Not a .march-image file");
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  const version = dv.getUint32(8, true);
  if (version > FORMAT_VERSION) throw new Error(`.march-image version ${version} is newer than this reader (${FORMAT_VERSION})`);
  const hl = dv.getUint32(12, true);
  const header = JSON.parse(dec.decode(u.subarray(16, 16 + hl))) as Record<string, unknown>;
  const rest = u.subarray(16 + hl);
  const body = header.z ? await inflate(rest) : rest;
  const index = header.blobs as [number, number][];
  const blob = async (i: number): Promise<Uint8Array> => {
    const [off, len] = index[i]!;
    return body.slice(off, off + len);
  };
  const decode = async (v: unknown): Promise<unknown> => {
    if (Array.isArray(v)) return Promise.all(v.map(decode));
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (o.$raster) {
        const d = o.$raster as { depth: BitDepth; ox: number; oy: number; tiles: [number, number, number][] };
        const r = new TiledRaster(d.depth);
        r.ox = d.ox; r.oy = d.oy;
        for (const [tx, ty, bi] of d.tiles) {
          const b = await blob(bi), t = newTile(d.depth);
          bytesOf(t).set(b);
          r.tiles.set(tileKey(tx, ty), t as PixelArray);
        }
        return r;
      }
      if (o.$mask) {
        const d = o.$mask as { w: number; h: number; outside: number; blob: number };
        const m = new Mask(d.w, d.h);
        m.data.set(await blob(d.blob));
        m.outside = d.outside;
        return m;
      }
      if (o.$f32 != null) { const b = await blob(o.$f32 as number); return new Float32Array(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength)); }
      if (o.$u8 != null) return blob(o.$u8 as number);
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(o)) out[k] = await decode(x);
      return out;
    }
    return v;
  };
  const doc = new ImageDocument({ width: header.width as number, height: header.height as number, background: "transparent" });
  doc.layers = (await decode(header.layers)) as Layer[];
  for (const k of FIELDS) if (k in header) (doc as unknown as Record<string, unknown>)[k] = await decode(header[k]!);
  doc.history.clear();
  doc.dirtySinceSave = false;
  return doc;
}

/** Check a document's structure (tests, file import): every raster in the document's depth, ids unique. */
export function validateDocument(doc: ImageDocument): string[] {
  const problems: string[] = [];
  const ids = new Set<string>();
  for (const [l] of walk(doc.layers)) {
    if (ids.has(l.id)) problems.push(`duplicate layer id ${l.id}`);
    ids.add(l.id);
    if (hasRaster(l) && l.raster.depth !== doc.depth) problems.push(`layer ${l.name}: ${l.raster.depth}-bit raster in a ${doc.depth}-bit document`);
    if (l.mask && (l.mask.mask.width !== doc.width || l.mask.mask.height !== doc.height)) problems.push(`layer ${l.name}: mask size differs from the document`);
  }
  return problems;
}
