// PSD / PSB reader: header, color mode data, image resources (resolution, ICC profile, guides, slices, layer comps,
// alpha channel names, paths), layer records (channels, masks, vector masks, blending ranges, tagged blocks), 8 / 16 /
// 32-bit channel data (raw, RLE, zip, zip with prediction), the merged image and the global blocks (Lr16 / Lr32,
// linked smart object files). Grayscale and CMYK files become RGB layers (CMYK converted naively: no color management).

import { ImageDocument, type AlphaChannel, type Guide, type PathItem, type Slice } from "../doc/document.ts";
import { Mask, TiledRaster, type BitDepth, type Rect } from "../doc/tiles.ts";
import { baseLayer, newId, type AdjustmentLayer, type ArtboardLayer, type BlendIf, type FillLayer, type GroupLayer, type Layer, type LayerBase, type PixelLayer, type ShapeLayer, type SmartLayer, type TextLayer } from "../doc/layers.ts";
import { zlibInflate } from "../doc/export/zlib.ts";
import { Reader, unpackBits } from "./binary.ts";
import { readDescriptor, readVersioned, num, str, items, sub, plain, type Descriptor } from "./descriptor.ts";
import { ADJUST_BY_KEY, BLEND_FROM_KEY, COLOR_TAG_CODES, locksFromFlags } from "./maps.ts";
import { colorFrom, paintFrom, styleFrom } from "./fx.ts";
import { readPathRecords } from "./path.ts";
import { readTySh, textFromTySh } from "./text.ts";
import { decodeJson } from "./json.ts";

export interface PsdReadOptions {
  /** Skip layer pixels (fast structure-only read). */
  skipPixels?: boolean | undefined;
}

/** Where PSD-only data of a layer is kept (layer.data.psd), so a write can give it back. */
export interface PsdLayerData {
  id?: number | undefined;
  /** Tagged blocks this reader does not map, written back unchanged. */
  blocks?: { key: string; bytes: Uint8Array }[] | undefined;
  /** The adjustment block as read (written back while the params are unchanged). */
  adjustment?: { key: string; bytes: Uint8Array; params: string } | undefined;
  /** The TySh block as read (written back while the text model is unchanged). */
  text?: { bytes: Uint8Array; model: string } | undefined;
  /** SoLd / PlLd blocks of a smart object. */
  smart?: { key: string; bytes: Uint8Array }[] | undefined;
  /** Vector mask invert flag. */
  vectorInvert?: boolean | undefined;
  /** The layer's effects as read (lfx2 / lmfx descriptor), plain. */
  effects?: unknown;
}

const PSB_BIG = new Set(["LMsk", "Lr16", "Lr32", "Layr", "Mt16", "Mt32", "Mtrn", "Alph", "FMsk", "lnk2", "FEid", "FXid", "PxSD"]);
const MODES: Record<number, string> = { 0: "bitmap", 1: "gray", 2: "indexed", 3: "rgb", 4: "cmyk", 7: "multichannel", 8: "duotone", 9: "lab" };

interface ChannelInfo { id: number; length: number; data?: Uint8Array | undefined }
interface MaskInfo { rect: Rect; defaultColor: number; flags: number; density?: number | undefined; feather?: number | undefined; vDensity?: number | undefined; vFeather?: number | undefined; real?: { rect: Rect; flags: number; defaultColor: number } | undefined }
interface Rec {
  rect: Rect; channels: ChannelInfo[]; blend: string; opacity: number; clipping: number; flags: number;
  mask?: MaskInfo | undefined; ranges: number[][]; name: string; blocks: { key: string; data: Uint8Array }[];
}
interface Ctx { width: number; height: number; depth: BitDepth; mode: number; psb: boolean; warnings: string[]; links: Map<string, { name: string; type: string; data: Uint8Array }> }

function rectOf(r: Reader): Rect {
  const top = r.i32(), left = r.i32(), bottom = r.i32(), right = r.i32();
  return { x: left, y: top, w: Math.max(0, right - left), h: Math.max(0, bottom - top) };
}

function readBlocks(r: Reader, end: number, psb: boolean, out: { key: string; data: Uint8Array }[]): void {
  while (r.pos + 12 <= end) {
    const sig = r.sig();
    if (sig !== "8BIM" && sig !== "8B64") { r.pos -= 3; continue; } // resync over padding
    const key = r.sig();
    const len = psb && PSB_BIG.has(key) ? r.u64() : r.u32();
    if (r.pos + len > end) { out.push({ key, data: r.bytes(end - r.pos) }); break; }
    out.push({ key, data: r.bytes(len) });
  }
  r.pos = end;
}

function readMaskData(r: Reader): MaskInfo | undefined {
  const len = r.u32();
  if (!len) return undefined;
  const end = r.pos + len;
  const m: MaskInfo = { rect: rectOf(r), defaultColor: r.u8(), flags: r.u8() };
  if (m.flags & 16 && r.pos < end) {
    const p = r.u8();
    if (p & 1) m.density = r.u8() / 255;
    if (p & 2) m.feather = r.f64();
    if (p & 4) m.vDensity = r.u8() / 255;
    if (p & 8) m.vFeather = r.f64();
  }
  if (end - r.pos >= 18) {
    const flags = r.u8(), defaultColor = r.u8();
    m.real = { flags, defaultColor, rect: rectOf(r) };
  }
  r.pos = end;
  return m;
}

function readRecord(r: Reader, psb: boolean): Rec {
  const rect = rectOf(r);
  const n = r.u16();
  const channels: ChannelInfo[] = [];
  for (let i = 0; i < n; i++) channels.push({ id: r.i16(), length: psb ? r.u64() : r.u32() });
  const sig = r.sig();
  if (sig !== "8BIM") throw new Error(`PSD: bad layer record signature "${sig}"`);
  const blend = r.sig(), opacity = r.u8(), clipping = r.u8(), flags = r.u8();
  r.u8();
  const extra = r.u32(), end = r.pos + extra;
  const mask = readMaskData(r);
  const rl = r.u32(), rend = r.pos + rl;
  const ranges: number[][] = [];
  while (r.pos + 8 <= rend) ranges.push([r.u8(), r.u8(), r.u8(), r.u8(), r.u8(), r.u8(), r.u8(), r.u8()]);
  r.pos = rend;
  const name = r.pascal(4);
  const blocks: { key: string; data: Uint8Array }[] = [];
  readBlocks(r, end, psb, blocks);
  return { rect, channels, blend, opacity, clipping, flags, mask, ranges, name, blocks };
}

/** Decode one channel's pixels (big-endian samples, w × h). */
async function decodeChannel(r: Reader, len: number, w: number, h: number, depth: BitDepth, psb: boolean): Promise<Uint8Array> {
  const end = r.pos + len;
  const bps = depth / 8, rowBytes = w * bps;
  const out = new Uint8Array(rowBytes * h);
  if (len < 2 || !w || !h) { r.pos = Math.min(end, r.u.length); return out; }
  const comp = r.u16();
  if (comp === 0) out.set(r.bytes(Math.min(out.length, end - r.pos)));
  else if (comp === 1) {
    const counts: number[] = [];
    for (let y = 0; y < h; y++) counts.push(psb ? r.u32() : r.u16());
    let o = 0;
    for (let y = 0; y < h; y++) { unpackBits(r.bytes(counts[y]!), out.subarray(o, o + rowBytes)); o += rowBytes; }
  } else if (comp === 2 || comp === 3) {
    const z = await zlibInflate(r.u.subarray(r.pos, end));
    out.set(z.subarray(0, out.length));
    if (comp === 3) unpredict(out, w, h, depth);
  } else throw new Error(`PSD: unknown compression ${comp}`);
  r.pos = end;
  return out;
}

/** Undo zip prediction: per-row deltas (8 / 16-bit), byte planes then deltas (32-bit). */
function unpredict(u: Uint8Array, w: number, h: number, depth: BitDepth): void {
  if (depth === 8) {
    for (let y = 0; y < h; y++) { const o = y * w; for (let x = 1; x < w; x++) u[o + x] = (u[o + x]! + u[o + x - 1]!) & 255; }
  } else if (depth === 16) {
    for (let y = 0; y < h; y++) {
      const o = y * w * 2;
      let prev = (u[o]! << 8) | u[o + 1]!;
      for (let x = 1; x < w; x++) {
        const i = o + x * 2, v = (((u[i]! << 8) | u[i + 1]!) + prev) & 0xffff;
        u[i] = v >> 8; u[i + 1] = v & 255; prev = v;
      }
    }
  } else {
    const row = new Uint8Array(w * 4);
    for (let y = 0; y < h; y++) {
      const o = y * w * 4;
      for (let x = 1; x < w * 4; x++) u[o + x] = (u[o + x]! + u[o + x - 1]!) & 255;
      for (let x = 0; x < w; x++) { row[x * 4] = u[o + x]!; row[x * 4 + 1] = u[o + w + x]!; row[x * 4 + 2] = u[o + 2 * w + x]!; row[x * 4 + 3] = u[o + 3 * w + x]!; }
      u.set(row, o);
    }
  }
}

function sampleReader(u: Uint8Array, depth: BitDepth): (i: number) => number {
  if (depth === 8) return (i) => u[i]! / 255;
  const dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
  if (depth === 16) return (i) => dv.getUint16(i * 2) / 65535;
  return (i) => dv.getFloat32(i * 4);
}

/** Planar channels → raster (strips of 64 rows; transparent tiles stay unstored). */
function channelsToRaster(ctx: Ctx, rect: Rect, ch: Map<number, Uint8Array>, raster: TiledRaster): void {
  const { w, h } = rect;
  if (!w || !h) return;
  const get = (id: number): ((i: number) => number) | null => { const u = ch.get(id); return u ? sampleReader(u, ctx.depth) : null; };
  const a = get(-1);
  const mode = ctx.mode;
  const c0 = get(0), c1 = get(1), c2 = get(2), c3 = get(3);
  const strip = 64;
  const buf = new Float32Array(w * strip * 4);
  for (let y0 = 0; y0 < h; y0 += strip) {
    const sh = Math.min(strip, h - y0);
    for (let y = 0; y < sh; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y0 + y) * w + x, o = (y * w + x) * 4;
        let r = 0, g = 0, b = 0;
        if (mode === 1 || mode === 8) r = g = b = c0 ? c0(i) : 0;
        else if (mode === 4) {
          // stored inverted (1 = no ink): naive CMYK → RGB without a profile
          const k = c3 ? c3(i) : 1;
          r = (c0 ? c0(i) : 1) * k; g = (c1 ? c1(i) : 1) * k; b = (c2 ? c2(i) : 1) * k;
        } else { r = c0 ? c0(i) : 0; g = c1 ? c1(i) : 0; b = c2 ? c2(i) : 0; }
        buf[o] = r; buf[o + 1] = g; buf[o + 2] = b; buf[o + 3] = a ? a(i) : 1;
      }
    }
    raster.write(rect.x, rect.y + y0, w, sh, sh === strip ? buf : buf.subarray(0, w * sh * 4));
  }
}

function maskFrom(ctx: Ctx, rect: Rect, data: Uint8Array | undefined, defaultColor: number): Mask {
  const m = new Mask(ctx.width, ctx.height, defaultColor);
  m.outside = defaultColor;
  if (!data || !rect.w || !rect.h) return m;
  const s = sampleReader(data, ctx.depth);
  for (let y = 0; y < rect.h; y++) {
    const dy = rect.y + y;
    if (dy < 0 || dy >= ctx.height) continue;
    for (let x = 0; x < rect.w; x++) {
      const dx = rect.x + x;
      if (dx < 0 || dx >= ctx.width) continue;
      m.data[dy * ctx.width + dx] = Math.round(Math.min(1, Math.max(0, s(y * rect.w + x))) * 255);
    }
  }
  return m;
}

/** Layer info structure (count, records, channel data). */
async function readLayerInfo(r: Reader, ctx: Ctx, skipPixels: boolean): Promise<{ recs: Rec[]; mergedAlpha: boolean }> {
  if (r.left < 2) return { recs: [], mergedAlpha: false };
  const count = r.i16();
  const recs: Rec[] = [];
  for (let i = 0; i < Math.abs(count); i++) recs.push(readRecord(r, ctx.psb));
  for (const rec of recs) {
    for (const c of rec.channels) {
      const rect = c.id === -2 ? rec.mask?.rect ?? rec.rect : c.id === -3 ? rec.mask?.real?.rect ?? rec.rect : rec.rect;
      if (skipPixels) { r.skip(c.length); continue; }
      c.data = await decodeChannel(r, c.length, rect.w, rect.h, ctx.depth, ctx.psb);
    }
  }
  return { recs, mergedAlpha: count < 0 };
}

function readLinks(data: Uint8Array, ctx: Ctx): void {
  const r = new Reader(data);
  while (r.left > 8) {
    const size = r.u64(), start = r.pos;
    if (!size || start + size > data.length) break;
    try {
      const type = r.sig(), version = r.u32();
      const id = r.pascal(1), name = r.unicode(), fileType = r.sig();
      r.sig();
      const len = r.u64();
      if (r.u8()) { r.u32(); readDescriptor(r); }
      if (type === "liFD") ctx.links.set(id, { name, type: fileType.trim(), data: r.bytes(Math.min(len, r.left)).slice() });
      else ctx.warnings.push(`linked smart object "${name}" (external file, version ${version}) not embedded`);
    } catch { /* a damaged link entry: skip it */ }
    r.pos = start + size;
    while (r.pos % 4 && r.left) r.pos++;
  }
}

/** A 3×3 projective matrix (row-major) mapping the w × h source rectangle onto four corners (TL, TR, BR, BL). */
export function quadMatrix(w: number, h: number, q: number[]): number[] {
  const src = [[0, 0], [w, 0], [w, h], [0, h]], A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i]!, X = q[i * 2]!, Y = q[i * 2 + 1]!;
    A.push([x!, y!, 1, 0, 0, 0, -x! * X, -y! * X, X]);
    A.push([0, 0, 0, x!, y!, 1, -x! * Y, -y! * Y, Y]);
  }
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r2 = c + 1; r2 < 8; r2++) if (Math.abs(A[r2]![c]!) > Math.abs(A[p]![c]!)) p = r2;
    [A[c], A[p]] = [A[p]!, A[c]!];
    const d = A[c]![c]!;
    if (Math.abs(d) < 1e-12) return [1, 0, q[0] ?? 0, 0, 1, q[1] ?? 0, 0, 0, 1];
    for (let k = c; k < 9; k++) A[c]![k]! /= d;
    for (let r2 = 0; r2 < 8; r2++) if (r2 !== c) { const f = A[r2]![c]!; for (let k = c; k < 9; k++) A[r2]![k]! -= f * A[c]![k]!; }
  }
  return [...A.map((row) => row[8]!), 1];
}

function parseResources(u: Uint8Array): { id: number; name: string; data: Uint8Array }[] {
  const r = new Reader(u), out: { id: number; name: string; data: Uint8Array }[] = [];
  while (r.left >= 12) {
    const sig = r.sig();
    if (sig !== "8BIM" && sig !== "MeSa" && sig !== "AgHg" && sig !== "PHUT" && sig !== "DCSR") break;
    const id = r.u16(), name = r.pascal(2), len = r.u32();
    out.push({ id, name, data: r.bytes(Math.min(len, r.left)).slice() });
    if (len % 2 && r.left) r.skip(1);
  }
  return out;
}

/** The profile description of an ICC profile ('desc' tag, v2 text or v4 mluc). */
export function iccName(icc: Uint8Array): string | null {
  try {
    const r = new Reader(icc);
    r.pos = 128;
    const n = r.u32();
    for (let i = 0; i < n; i++) {
      const sig = r.sig(), off = r.u32(), len = r.u32();
      if (sig !== "desc") continue;
      const t = new Reader(icc.subarray(off, off + len));
      const type = t.sig(); t.skip(4);
      if (type === "desc") { const c = t.u32(); return t.ascii(c).replace(/\0+$/, ""); }
      if (type === "mluc") {
        const recs = t.u32(); t.u32();
        if (!recs) return null;
        t.skip(4); const l = t.u32(), o = t.u32();
        const s = new Reader(icc.subarray(off + o, off + o + l));
        let out = "";
        for (let k = 0; k < l / 2; k++) out += String.fromCharCode(s.u16());
        return out.replace(/\0+$/, "");
      }
    }
  } catch { /* not a profile */ }
  return null;
}

function readSlices(data: Uint8Array): Slice[] {
  const r = new Reader(data);
  if (r.u32() !== 6) return [];
  r.skip(16); r.unicode();
  const n = r.u32(), out: Slice[] = [];
  for (let i = 0; i < n; i++) {
    const id = r.u32(); r.u32();
    const origin = r.u32();
    if (origin === 1) r.u32();
    const name = r.unicode(); r.u32();
    const left = r.i32(), top = r.i32(), right = r.i32(), bottom = r.i32();
    const url = r.unicode(); r.unicode(); r.unicode();
    const alt = r.unicode(); r.u8(); r.unicode(); r.u32(); r.u32(); r.skip(4);
    const s: Slice = { id: `s${id}`, name: name || `Slice ${id}`, rect: { x: left, y: top, w: right - left, h: bottom - top }, kind: origin === 0 ? "auto" : origin === 1 ? "layer" : "user" };
    if (url) s.url = url;
    if (alt) s.alt = alt;
    out.push(s);
  }
  return out;
}

function blendIfFrom(ranges: number[][]): BlendIf | undefined {
  const chans: BlendIf["channel"][] = ["gray", "red", "green", "blue"];
  for (let c = 0; c < Math.min(4, ranges.length); c++) {
    const v = ranges[c]!;
    if (v[0] === 0 && v[1] === 0 && v[2] === 255 && v[3] === 255 && v[4] === 0 && v[5] === 0 && v[6] === 255 && v[7] === 255) continue;
    return { channel: chans[c]!, thisLayer: [v[0]!, v[1]!, v[2]!, v[3]!], underlying: [v[4]!, v[5]!, v[6]!, v[7]!] };
  }
  return undefined;
}

/** Read a PSD or PSB file into a document. PSD-only data is kept in doc.meta.psd and layer.data.psd. */
export async function readPsd(bytes: Uint8Array, opts: PsdReadOptions = {}): Promise<ImageDocument> {
  const r = new Reader(bytes);
  if (r.sig() !== "8BPS") throw new Error("Not a PSD file");
  const version = r.u16();
  if (version !== 1 && version !== 2) throw new Error(`PSD: unsupported version ${version}`);
  const psb = version === 2;
  r.psb = psb;
  r.skip(6);
  const nch = r.u16(), height = r.u32(), width = r.u32(), bits = r.u16(), mode = r.u16();
  if (bits !== 8 && bits !== 16 && bits !== 32) throw new Error(`PSD: ${bits}-bit files are not supported`);
  if (mode !== 1 && mode !== 3 && mode !== 4 && mode !== 8) throw new Error(`PSD: color mode ${MODES[mode] ?? mode} is not supported (RGB, grayscale, duotone and CMYK are)`);
  const depth = bits as BitDepth;
  const ctx: Ctx = { width, height, depth, mode, psb, warnings: [], links: new Map() };
  if (mode === 4) ctx.warnings.push("CMYK converted to RGB naively (no color profile applied)");
  if (mode === 8) ctx.warnings.push("duotone read as grayscale");

  const cmLen = r.u32();
  r.skip(cmLen);
  const resources = parseResources(r.bytes(r.u32()));

  // layer and mask information
  const lmLen = r.len();
  const lmEnd = r.pos + lmLen;
  let recs: Rec[] = [], mergedAlpha = false;
  const globals: { key: string; data: Uint8Array }[] = [];
  if (lmLen) {
    const liLen = r.len();
    const liEnd = r.pos + liLen;
    if (liLen) ({ recs, mergedAlpha } = await readLayerInfo(r.sub(liLen), ctx, !!opts.skipPixels));
    r.pos = liEnd;
    if (r.pos + 4 <= lmEnd) { const gl = r.u32(); r.skip(Math.min(gl, lmEnd - r.pos)); }
    readBlocks(r, lmEnd, psb, globals);
    for (const g of globals) {
      if ((g.key === "Lr16" || g.key === "Lr32") && !recs.length) {
        const gr = new Reader(g.data); gr.psb = psb;
        // some writers put the section length first
        const maybe = psb ? Number(new DataView(g.data.buffer, g.data.byteOffset).getBigUint64(0)) : new DataView(g.data.buffer, g.data.byteOffset).getUint32(0);
        if (g.data.length >= 8 && maybe > 0 && maybe <= g.data.length - (psb ? 8 : 4) && maybe >= g.data.length - (psb ? 8 : 4) - 4) gr.pos = psb ? 8 : 4;
        ({ recs, mergedAlpha } = await readLayerInfo(gr, ctx, !!opts.skipPixels));
      } else if (g.key === "lnk2" || g.key === "lnkD" || g.key === "lnk3") readLinks(g.data, ctx);
    }
  }
  r.pos = lmEnd;

  const doc = new ImageDocument({ width, height, depth, background: "transparent", mode: mode === 4 ? "cmyk" : mode === 1 || mode === 8 ? "gray" : "rgb" });
  const meta: Record<string, unknown> = { version, mode: MODES[mode], channels: nch, warnings: ctx.warnings };

  // image resources
  const alphaNames: string[] = [];
  let uniNames: string[] | null = null;
  const keptRes: { id: number; name: string; data: Uint8Array }[] = [];
  for (const res of resources) {
    const rr = new Reader(res.data);
    try {
      if (res.id === 1005) { doc.dpi = Math.round(rr.fixed() * 100) / 100; }
      else if (res.id === 1039) { meta.icc = res.data; const n = iccName(res.data); if (n) doc.profile = n; }
      else if (res.id === 1032) {
        rr.u32(); rr.u32(); rr.u32();
        const n = rr.u32();
        const guides: Guide[] = [];
        for (let i = 0; i < n; i++) { const loc = rr.i32() / 32, dir = rr.u8(); guides.push({ id: newId("g"), axis: dir === 0 ? "x" : "y", pos: loc }); }
        doc.guides = guides;
      } else if (res.id === 1050) doc.slices = readSlices(res.data).filter((s) => s.kind !== "auto");
      else if (res.id === 1065) { rr.u32(); const d = readDescriptor(rr); meta.layerComps = res.data; meta.comps = items(d, "list").map((it) => (it.t === "Objc" ? { name: str(it.v, "Nm  "), id: num(it.v, "compID") } : null)).filter(Boolean); }
      else if (res.id === 1006) { while (rr.left) alphaNames.push(rr.pascal(1)); }
      else if (res.id === 1045) { uniNames = []; while (rr.left >= 4) uniNames.push(rr.unicode()); }
      else if ((res.id >= 2000 && res.id <= 2997) || res.id === 1025) {
        const { path } = readPathRecords(rr, width, height);
        const p: PathItem = { id: newId("p"), name: res.id === 1025 ? "Work Path" : res.name || `Path ${res.id - 1999}`, path };
        if (res.id === 1025) p.work = true;
        doc.paths.push(p);
      } else keptRes.push(res);
    } catch (e) { ctx.warnings.push(`resource ${res.id}: ${(e as Error).message}`); }
  }
  if (keptRes.length) meta.resources = keptRes;

  // layers
  const layers = opts.skipPixels ? buildTree(recs, ctx, doc, true) : buildTree(recs, ctx, doc, false);
  doc.layers = layers;
  for (const g of globals) {
    if (g.key === "mrCh") {
      try { const m = decodeJson(new TextDecoder().decode(g.data).replace(/ +$/, "")) as Record<string, unknown>; for (const [k, v] of Object.entries(m)) (doc as unknown as Record<string, unknown>)[k] = v; } catch { ctx.warnings.push("unreadable March data block"); }
    }
  }

  // merged image: the only pixels of a flat file; alpha channels after the color (and transparency) channels
  const colorCh = mode === 4 ? 4 : mode === 3 ? 3 : 1;
  const names = uniNames ?? alphaNames;
  const extras = nch - colorCh;
  const hasTransparency = extras > names.length || mergedAlpha;
  if (r.left >= 2) {
    const need = !layers.length || extras > (hasTransparency ? 1 : 0);
    if (need && !opts.skipPixels) {
      const comp = r.u16();
      const planes: Uint8Array[] = [];
      const bps = depth / 8, rowBytes = width * bps;
      if (comp === 1) {
        const counts: number[] = [];
        for (let i = 0; i < nch * height; i++) counts.push(psb ? r.u32() : r.u16());
        for (let c = 0; c < nch; c++) {
          const p = new Uint8Array(rowBytes * height);
          for (let y = 0; y < height; y++) unpackBits(r.bytes(counts[c * height + y]!), p.subarray(y * rowBytes, (y + 1) * rowBytes));
          planes.push(p);
        }
      } else if (comp === 0) {
        for (let c = 0; c < nch; c++) planes.push(r.bytes(Math.min(rowBytes * height, r.left)).slice());
      } else {
        const z = await zlibInflate(r.bytes(r.left));
        for (let c = 0; c < nch; c++) { const p = z.slice(c * rowBytes * height, (c + 1) * rowBytes * height); if (comp === 3) unpredict(p, width, height, depth); planes.push(p); }
      }
      if (!layers.length) {
        const l = doc.newPixelLayer("Background");
        const ch = new Map<number, Uint8Array>();
        for (let c = 0; c < colorCh; c++) if (planes[c]) ch.set(c, planes[c]!);
        if (hasTransparency && planes[colorCh]) ch.set(-1, planes[colorCh]!);
        channelsToRaster(ctx, { x: 0, y: 0, w: width, h: height }, ch, l.raster);
        if (!hasTransparency) { l.data = { background: true }; l.locks.position = true; }
        doc.layers = [l];
      }
      const first = colorCh + (hasTransparency ? 1 : 0);
      const chans: AlphaChannel[] = [];
      for (let c = first, k = 0; c < nch; c++, k++) {
        const m = maskFrom(ctx, { x: 0, y: 0, w: width, h: height }, planes[c], 0);
        chans.push({ id: newId("c"), name: names[k] ?? `Alpha ${k + 1}`, mask: m, visible: false, color: [1, 0, 0, 1], opacity: 0.5 });
      }
      doc.channels = chans;
    }
  }

  doc.meta = { ...doc.meta, psd: meta };
  const top = doc.layers[doc.layers.length - 1];
  doc.activeId = top?.id ?? null;
  doc.selected = top ? [top.id] : [];
  doc.history.clear();
  doc.dirtySinceSave = false;
  return doc;
}

const HANDLED = new Set(["luni", "lyid", "lsct", "lsdk", "iOpa", "lspf", "lclr", "lfx2", "lmfx", "lrFX", "vmsk", "vsms", "vscg", "SoCo", "GdFl", "PtFl", "TySh", "SoLd", "PlLd", "SoLE", "artb", "artd", "abdd", "mrCh", ...ADJUST_BY_KEY.keys()]);

function buildTree(recs: Rec[], ctx: Ctx, doc: ImageDocument, skipPixels: boolean): Layer[] {
  const root: Layer[] = [];
  const stack: Layer[][] = [root];
  for (let i = 0; i < recs.length; i++) {
    const rec = recs[i]!;
    const blocks = new Map(rec.blocks.map((b) => [b.key, b.data]));
    const sect = blocks.get("lsct") ?? blocks.get("lsdk");
    const sectType = sect ? new Reader(sect).u32() : 0;
    if (sectType === 3) { stack.push([]); continue; }
    let layer: Layer;
    try { layer = makeLayer(rec, blocks, ctx, doc, skipPixels); }
    catch (e) { ctx.warnings.push(`layer "${rec.name}": ${(e as Error).message}`); layer = { ...baseLayer("pixel", rec.name), raster: new TiledRaster(ctx.depth) }; }
    if (sectType === 1 || sectType === 2) {
      const children = stack.length > 1 ? stack.pop()! : [];
      const g = layer as GroupLayer | ArtboardLayer;
      if (g.kind !== "group" && g.kind !== "artboard") { ctx.warnings.push(`group "${rec.name}" had an unexpected kind`); }
      (g as GroupLayer).children = children;
      (g as GroupLayer).collapsed = sectType === 2;
    }
    stack[stack.length - 1]!.push(layer);
  }
  while (stack.length > 1) { const orphans = stack.pop()!; stack[stack.length - 1]!.push(...orphans); }
  return root;
}

function makeLayer(rec: Rec, blocks: Map<string, Uint8Array>, ctx: Ctx, doc: ImageDocument, skipPixels: boolean): Layer {
  const psd: PsdLayerData = {};
  const rd = (k: string): Reader | null => { const b = blocks.get(k); if (!b) return null; const x = new Reader(b); x.psb = ctx.psb; return x; };
  let name = rec.name;
  const lu = rd("luni");
  if (lu) name = lu.unicode();
  const id = rd("lyid");
  if (id) psd.id = id.u32();

  const sect = rd("lsct") ?? rd("lsdk");
  const sectType = sect ? sect.u32() : 0;
  let blendKey = rec.blend;
  if (sect && sect.left >= 8) { sect.sig(); blendKey = sect.sig(); }

  const chans = new Map<number, Uint8Array>();
  for (const c of rec.channels) if (c.data) chans.set(c.id, c.data);
  const pixels = (): TiledRaster => { const t = new TiledRaster(ctx.depth); if (!skipPixels) channelsToRaster(ctx, rec.rect, chans, t); return t; };

  const vscg = rd("vscg");
  const vsms = rd("vsms"), vmsk = rd("vmsk");
  const vec = vsms ?? vmsk;
  const tysh = blocks.get("TySh");
  const smart = blocks.get("SoLd") ?? blocks.get("SoLE") ?? blocks.get("PlLd");
  const adjust = [...blocks.keys()].map((k) => ADJUST_BY_KEY.get(k)).find(Boolean);
  const fillKey = ["SoCo", "GdFl", "PtFl"].find((k) => blocks.has(k));
  const artb = rd("artb") ?? rd("artd") ?? rd("abdd");

  let layer: Layer;
  if (sectType === 1 || sectType === 2) {
    if (artb) {
      const d = readVersioned(artb);
      const rc = sub(d, "artboardRect");
      const rect = { x: num(rc, "Left"), y: num(rc, "Top "), w: num(rc, "Rght") - num(rc, "Left"), h: num(rc, "Btom") - num(rc, "Top ") };
      const bgType = num(d, "artboardBackgroundType", 1);
      layer = { ...baseLayer("artboard", name), rect, background: bgType === 3 ? null : bgType === 2 ? [0, 0, 0, 1] : bgType === 4 ? colorFrom(sub(d, "Clr ")) : [1, 1, 1, 1], children: [], collapsed: sectType === 2 } as ArtboardLayer;
    } else layer = { ...baseLayer("group", name), children: [], collapsed: sectType === 2 } as GroupLayer;
  } else if (tysh) {
    const t = readTySh(new Reader(tysh));
    const text = textFromTySh(t);
    layer = { ...baseLayer("text", name), text, raster: pixels() } as TextLayer;
    psd.text = { bytes: tysh, model: JSON.stringify(text) };
  } else if (smart) {
    const key = blocks.has("SoLd") ? "SoLd" : blocks.has("SoLE") ? "SoLE" : "PlLd";
    const sr = new Reader(smart);
    let d: Descriptor | null = null;
    try {
      if (key === "PlLd") { sr.sig(); sr.u32(); const uid = sr.pascal(1); sr.u32(); sr.u32(); sr.u32(); sr.u32(); const q: number[] = []; for (let i = 0; i < 8; i++) q.push(sr.f64()); d = { name: "", classId: "null", items: { Idnt: { t: "TEXT", v: uid }, Trnf: { t: "VlLs", v: q.map((v) => ({ t: "doub" as const, v })) } } }; }
      else { sr.sig(); sr.u32(); d = readVersioned(sr); }
    } catch { d = null; }
    const uid = str(d ?? undefined, "Idnt");
    const link = ctx.links.get(uid);
    const sz = sub(d ?? undefined, "Sz  ");
    const q = items(d ?? undefined, "Trnf").map((it) => (it.t === "doub" ? it.v : 0));
    const w = num(sz, "Wdth", rec.rect.w || 1), h = num(sz, "Hght", rec.rect.h || 1);
    const matrix = q.length === 8 ? quadMatrix(w, h, q) : [1, 0, rec.rect.x, 0, 1, rec.rect.y, 0, 0, 1];
    const source: SmartLayer["source"] = { doc: link ? { format: "embedded", fileType: link.type, fileName: link.name, id: uid, bytes: link.data } : { format: "missing", id: uid }, width: w, height: h };
    if (link?.name) source.name = link.name;
    layer = { ...baseLayer("smart", name), source, matrix, filters: [], filtersEnabled: true, raster: pixels() } as SmartLayer;
    psd.smart = [...blocks.entries()].filter(([k]) => k === "SoLd" || k === "SoLE" || k === "PlLd").map(([k, bytes]) => ({ key: k, bytes }));
  } else if (adjust) {
    const bytes = blocks.get(adjust.key)!;
    let params: Record<string, unknown> = {};
    if (adjust.read) { try { const ar = new Reader(bytes); ar.psb = ctx.psb; params = adjust.read(ar); } catch (e) { ctx.warnings.push(`adjustment ${adjust.key}: ${(e as Error).message}`); } }
    layer = { ...baseLayer("adjustment", name), adjust: { id: adjust.op, params } } as AdjustmentLayer;
    psd.adjustment = { key: adjust.key, bytes, params: JSON.stringify(params) };
  } else if (vscg || (fillKey && vsms)) {
    const fr = vscg ?? rd(fillKey!)!;
    let paint;
    if (vscg) { const k = fr.sig(); paint = paintFrom(k, readVersioned(fr)); } else paint = paintFrom(fillKey!, readVersioned(fr));
    const path = readPathRecords(skipHeader(vec!), ctx.width, ctx.height).path;
    layer = { ...baseLayer("shape", name), path, fillPaint: paint, stroke: null, raster: pixels() } as ShapeLayer;
  } else if (fillKey) {
    layer = { ...baseLayer("fill", name), paint: paintFrom(fillKey, readVersioned(rd(fillKey)!)) } as FillLayer;
  } else layer = { ...baseLayer("pixel", name), raster: pixels() } as PixelLayer;

  const base: LayerBase = layer;
  base.visible = !(rec.flags & 2);
  base.opacity = rec.opacity / 255;
  base.blend = BLEND_FROM_KEY[blendKey] ?? "normal";
  if ((layer.kind === "group" || layer.kind === "artboard") && blendKey === "pass") base.blend = "pass-through";
  if (layer.kind !== "group" && layer.kind !== "artboard" && base.blend === "pass-through") base.blend = "normal";
  base.clip = rec.clipping === 1;
  const io = rd("iOpa");
  if (io) base.fill = io.u8() / 255;
  const lp = rd("lspf");
  if (lp) base.locks = locksFromFlags(lp.u32());
  if (rec.flags & 1) base.locks.transparency = true;
  const lc = rd("lclr");
  if (lc) base.color = COLOR_TAG_CODES[lc.u16()] ?? "none";
  const bi = blendIfFrom(rec.ranges);
  if (bi) base.blendIf = bi;

  // layer mask (user mask channel -2)
  if (rec.mask && rec.channels.some((c) => c.id === -2)) {
    const m = rec.mask;
    base.mask = {
      mask: maskFrom(ctx, m.rect, chans.get(-2), m.defaultColor), enabled: !(m.flags & 2), linked: !(m.flags & 1),
      density: m.density ?? 1, feather: m.feather ?? 0,
    };
    if (m.flags & 4) base.mask.invert = true;
  }
  // vector mask (shape layers keep their path as the shape)
  if (vec && layer.kind !== "shape") {
    const flags = skipHeaderFlags(vec);
    const { path } = readPathRecords(vec, ctx.width, ctx.height);
    base.vectorMask = { path, enabled: !(flags & 4), linked: !(flags & 2), density: rec.mask?.vDensity ?? 1, feather: rec.mask?.vFeather ?? 0 };
    if (flags & 1) psd.vectorInvert = true;
  }
  // effects
  const fx = rd("lmfx") ?? rd("lfx2");
  if (fx) {
    try { fx.u32(); const d = readVersioned(fx); base.styles = styleFrom(d); psd.effects = plain(d); }
    catch (e) { ctx.warnings.push(`layer "${name}" effects: ${(e as Error).message}`); }
  }
  if (rec.name === "Background" && !rec.channels.some((c) => c.id === -1) && layer.kind === "pixel") { base.data = { background: true }; base.locks.position = true; }

  const unknown = rec.blocks.filter((b) => !HANDLED.has(b.key)).map((b) => ({ key: b.key, bytes: b.data }));
  if (unknown.length) psd.blocks = unknown;

  // March data: everything PSD cannot hold (written by writePsd)
  const mr = blocks.get("mrCh");
  if (mr) {
    try {
      const m = decodeJson(new TextDecoder().decode(mr).replace(/ +$/, "")) as { kind?: Layer["kind"]; fields?: Record<string, unknown> };
      if (m.kind && m.kind !== layer.kind) {
        const raster = "raster" in layer ? (layer as PixelLayer).raster : new TiledRaster(ctx.depth);
        const kids = "children" in layer ? (layer as GroupLayer).children : [];
        const next = { ...layer, kind: m.kind } as Record<string, unknown>;
        if (m.kind === "pixel" || m.kind === "text" || m.kind === "shape" || m.kind === "smart") next.raster = raster; else delete next.raster;
        if (m.kind === "group" || m.kind === "artboard") next.children = kids;
        for (const k of ["text", "adjust", "paint", "path", "fillPaint", "stroke", "source", "matrix", "filters", "filtersEnabled"]) if (!(m.fields && k in m.fields)) delete next[k];
        layer = next as unknown as Layer;
      }
      if (m.fields) Object.assign(layer, m.fields);
    } catch { ctx.warnings.push(`layer "${name}": unreadable March data`); }
  }
  const data = (layer.data ?? {}) as Record<string, unknown>;
  layer.data = { ...data, psd: { ...((data.psd as object) ?? {}), ...psd } };
  void doc;
  return layer;
}

/** vmsk / vsms: skip version + flags, return the reader at the path records. */
function skipHeader(r: Reader): Reader { r.pos = 8; return r; }
function skipHeaderFlags(r: Reader): number { r.pos = 4; const f = r.u32(); return f; }
