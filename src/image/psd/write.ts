// PSD / PSB writer: RGB 8 / 16 / 32-bit, layer records for every layer kind (groups as section dividers, text with
// TySh, fill and shape layers with SoCo / GdFl / PtFl + vector paths, adjustment layers with their keys, smart objects
// with their embedded file), masks, vector masks, layer styles (lfx2), Blend If ranges, the merged image (so other
// apps show a preview), image resources (resolution, ICC profile, guides, slices, layer comps, alpha channel names,
// paths) and a private March block (mrCh) with what PSD cannot hold.

import type { ImageDocument } from "../doc/document.ts";
import { hasRaster, isContainer, type Layer, type LayerBase } from "../doc/layers.ts";
import { renderHooks, renderRegion } from "../doc/composite.ts";
import { renderPaint } from "../doc/paint.ts";
import type { Mask, Rect } from "../doc/tiles.ts";
import { plainText } from "../doc/text-model.ts";
import { Writer, packBits } from "./binary.ts";
import { desc, doub, long, obj, text, writeVersioned, type Descriptor } from "./descriptor.ts";
import { ADJUST_BY_OP, BLEND_KEYS, COLOR_TAG_CODES, locksToFlags } from "./maps.ts";
import { colorItem, paintToBlock, styleToDesc } from "./fx.ts";
import { writePathRecords } from "./path.ts";
import { textToTySh, writeTySh } from "./text.ts";
import { encodeJson } from "./json.ts";
import type { PsdLayerData } from "./read.ts";

export interface PsdWriteOptions {
  /** Large document format (PSB): needed above 30 000 px. Default: chosen by size. */
  psb?: boolean | undefined;
  /** Channel compression: RLE (PackBits, default) or raw. */
  compression?: "rle" | "raw" | undefined;
  /** Add the private March block (mrCh) so March reads its own fields back exactly. Default true. */
  marchData?: boolean | undefined;
  /** Write text layers as pixel layers (the text model stays in the March block). */
  textAsPixels?: boolean | undefined;
  /** Write the merged (flattened) image. Default true; false writes a blank one (smaller, other apps show nothing). */
  merged?: boolean | undefined;
}

const PSB_BIG = new Set(["LMsk", "Lr16", "Lr32", "Layr", "Mt16", "Mt32", "Mtrn", "Alph", "FMsk", "lnk2", "FEid", "FXid", "PxSD"]);
/** Image resources the writer regenerates (kept ones with these ids are dropped). */
const OWN_RES = new Set([1005, 1039, 1032, 1050, 1065, 1006, 1045, 1053, 1024, 1026, 1036, 1033, 1069, 1072, 1073, 1077, 1025]);
const STRIP = 64;

interface Rec {
  layer: Layer | null;
  rect: Rect;
  channels: { id: number; data: Uint8Array }[];
  blend: string;
  opacity: number;
  clipping: number;
  flags: number;
  mask: Uint8Array | null;
  ranges: Uint8Array;
  name: string;
  blocks: { key: string; data: Uint8Array }[];
}

/** Encode one channel (w × h samples, big endian) with the chosen compression: u16 method + data. */
function encodeChannel(raw: Uint8Array, w: number, h: number, bps: number, rle: boolean, psb: boolean): Uint8Array {
  if (!w || !h) return new Uint8Array(2);
  const rowBytes = w * bps;
  if (!rle) { const o = new Uint8Array(2 + raw.length); o.set(raw, 2); return o; }
  const rows: number[][] = [];
  let total = 0;
  for (let y = 0; y < h; y++) { const p = packBits(raw, y * rowBytes, (y + 1) * rowBytes); rows.push(p); total += p.length; }
  const cs = psb ? 4 : 2;
  const out = new Uint8Array(2 + h * cs + total);
  const dv = new DataView(out.buffer);
  dv.setUint16(0, 1);
  let o = 2;
  for (const p of rows) { if (psb) dv.setUint32(o, p.length); else dv.setUint16(o, p.length); o += cs; }
  for (const p of rows) { out.set(p, o); o += p.length; }
  return out;
}

/** Float RGBA strip source → planar big-endian channels R, G, B, A. */
function planes(src: (r: Rect) => Float32Array, rect: Rect, depth: number): Uint8Array[] {
  const bps = depth / 8, n = rect.w * rect.h;
  const out = [0, 1, 2, 3].map(() => new Uint8Array(n * bps));
  const dvs = out.map((u) => new DataView(u.buffer));
  for (let y0 = 0; y0 < rect.h; y0 += STRIP) {
    const sh = Math.min(STRIP, rect.h - y0);
    const px = src({ x: rect.x, y: rect.y + y0, w: rect.w, h: sh });
    const base = y0 * rect.w;
    for (let i = 0; i < rect.w * sh; i++) {
      for (let c = 0; c < 4; c++) {
        const v = px[i * 4 + c]!, j = base + i;
        if (depth === 8) out[c]![j] = Math.round(Math.max(0, Math.min(1, v)) * 255);
        else if (depth === 16) dvs[c]!.setUint16(j * 2, Math.round(Math.max(0, Math.min(1, v)) * 65535));
        else dvs[c]!.setFloat32(j * 4, v);
      }
    }
  }
  return out;
}

/** The rectangle where a mask differs from its outside value (null: nowhere). */
function maskRect(m: Mask): Rect | null {
  const { width: w, height: h, data, outside } = m;
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) if (data[row + x] !== outside) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; y1 = y; }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}
function maskPlane(m: Mask, r: Rect, depth: number): Uint8Array {
  const bps = depth / 8, out = new Uint8Array(r.w * r.h * bps), dv = new DataView(out.buffer);
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const v = m.data[(r.y + y) * m.width + r.x + x]!, j = y * r.w + x;
    if (depth === 8) out[j] = v; else if (depth === 16) dv.setUint16(j * 2, v * 257); else dv.setFloat32(j * 4, v / 255);
  }
  return out;
}

function block(key: string, fn: (w: Writer) => void): { key: string; data: Uint8Array } {
  const w = new Writer(256);
  fn(w);
  return { key, data: w.done() };
}
const versioned = (key: string, d: Descriptor): { key: string; data: Uint8Array } => block(key, (w) => writeVersioned(w, d));

/** Fields of a layer the March block carries (PSD has no exact place for them). */
const MARCH_FIELDS: Record<string, string[]> = {
  all: ["comments", "variable", "knockout", "channels", "blendIf", "styles", "locks", "color"],
  text: ["text"], shape: ["path", "fillPaint", "stroke", "live"], fill: ["paint"], adjustment: ["adjust"],
  smart: ["source", "matrix", "warp", "filters", "filtersEnabled"], artboard: ["rect", "background", "exportScales"], group: [], pixel: [],
};

function marchBlock(l: Layer): { key: string; data: Uint8Array } {
  const fields: Record<string, unknown> = {};
  for (const k of [...MARCH_FIELDS.all!, ...(MARCH_FIELDS[l.kind] ?? [])]) { const v = (l as unknown as Record<string, unknown>)[k]; if (v !== undefined) fields[k] = v; }
  if (l.data) { const { psd: _psd, ...rest } = l.data as Record<string, unknown>; if (Object.keys(rest).length) fields.data = rest; }
  return block("mrCh", (w) => w.bytes(new TextEncoder().encode(encodeJson({ kind: l.kind, fields }))));
}

function blendRanges(l: LayerBase | null): Uint8Array {
  const out = new Uint8Array(32);
  for (let c = 0; c < 4; c++) out.set([0, 0, 255, 255, 0, 0, 255, 255], c * 8);
  const bi = l?.blendIf;
  if (bi) {
    const c = ["gray", "red", "green", "blue"].indexOf(bi.channel);
    out.set([...bi.thisLayer, ...bi.underlying].map((v) => Math.round(Math.max(0, Math.min(255, v)))), Math.max(0, c) * 8);
  }
  return out;
}

/** Write a document as PSD (or PSB). */
export async function writePsd(doc: ImageDocument, opts: PsdWriteOptions = {}): Promise<Uint8Array> {
  const psb = opts.psb ?? (doc.width > 30000 || doc.height > 30000);
  if (!psb && (doc.width > 30000 || doc.height > 30000)) throw new Error("PSD: documents above 30 000 px need the large document format (psb: true)");
  const depth = doc.depth;
  const bps = depth / 8;
  const rle = opts.compression !== "raw";
  const march = opts.marchData !== false;
  const W = doc.width, H = doc.height;
  const psdMeta = ((doc.meta.psd ?? {}) as Record<string, unknown>);
  const links: { id: string; name: string; type: string; data: Uint8Array }[] = [];
  let nextId = 1;

  const recs: Rec[] = [];
  const emptyChannels = (): Rec["channels"] => [-1, 0, 1, 2].map((id) => ({ id, data: new Uint8Array(2) }));

  const common = (l: Layer, rec: Rec): void => {
    const psd = ((l.data?.psd ?? {}) as PsdLayerData);
    rec.blocks.push(block("luni", (w) => { w.unicode(l.name); w.u16(0); }));
    rec.blocks.push(block("lyid", (w) => w.u32(nextId++)));
    rec.blocks.push(block("iOpa", (w) => { w.u8(Math.round(l.fill * 255)); w.zeros(3); }));
    rec.blocks.push(block("lspf", (w) => w.u32(locksToFlags(l.locks))));
    rec.blocks.push(block("lclr", (w) => { w.u16(Math.max(0, COLOR_TAG_CODES.indexOf(l.color))); w.zeros(6); }));
    if (l.styles) rec.blocks.push(block("lfx2", (w) => { w.u32(0); writeVersioned(w, styleToDesc(l.styles!)); }));
    if (l.vectorMask && l.kind !== "shape") {
      const vm = l.vectorMask;
      rec.blocks.push(block("vmsk", (w) => { w.u32(3); w.u32((psd.vectorInvert ? 1 : 0) | (vm.linked ? 0 : 2) | (vm.enabled ? 0 : 4)); writePathRecords(w, vm.path, W, H); }));
    }
    for (const b of psd.blocks ?? []) if (!rec.blocks.some((x) => x.key === b.key)) rec.blocks.push({ key: b.key, data: b.bytes });
    if (march) rec.blocks.push(marchBlock(l));
  };

  const maskData = (l: Layer, rec: Rec): void => {
    const m = l.mask, vm = l.vectorMask;
    if (!m && !vm) return;
    const w = new Writer(64);
    let r: Rect = { x: 0, y: 0, w: 0, h: 0 };
    if (m) {
      r = maskRect(m.mask) ?? { x: 0, y: 0, w: 0, h: 0 };
      rec.channels.push({ id: -2, data: encodeChannel(r.w ? maskPlane(m.mask, r, depth) : new Uint8Array(0), r.w, r.h, bps, rle, psb) });
    }
    w.i32(r.y); w.i32(r.x); w.i32(r.y + r.h); w.i32(r.x + r.w);
    w.u8(m ? m.mask.outside : 255);
    const params = (m && m.density !== 1 ? 1 : 0) | (m && m.feather ? 2 : 0) | (vm && vm.density !== 1 ? 4 : 0) | (vm && vm.feather ? 8 : 0);
    w.u8((m && !m.linked ? 1 : 0) | (m && !m.enabled ? 2 : 0) | (m?.invert ? 4 : 0) | (!m && vm ? 8 : 0) | (params ? 16 : 0));
    if (params) {
      w.u8(params);
      if (params & 1) w.u8(Math.round(m!.density * 255));
      if (params & 2) w.f64(m!.feather);
      if (params & 4) w.u8(Math.round(vm!.density * 255));
      if (params & 8) w.f64(vm!.feather);
    }
    while (w.pos < 20) w.u8(0);
    rec.mask = w.done();
  };

  const pixelChannels = (rec: Rec, src: ((r: Rect) => Float32Array) | null, rect: Rect | null): void => {
    if (!src || !rect || !rect.w || !rect.h) { rec.channels.push(...emptyChannels()); return; }
    rec.rect = rect;
    const p = planes(src, rect, depth);
    rec.channels.push({ id: -1, data: encodeChannel(p[3]!, rect.w, rect.h, bps, rle, psb) });
    for (let c = 0; c < 3; c++) rec.channels.push({ id: c, data: encodeChannel(p[c]!, rect.w, rect.h, bps, rle, psb) });
  };

  const newRec = (l: Layer | null, name: string): Rec => ({
    layer: l, rect: { x: 0, y: 0, w: 0, h: 0 }, channels: [], blend: "norm", opacity: 255, clipping: 0, flags: 0, mask: null,
    ranges: blendRanges(l), name, blocks: [],
  });

  const visit = (list: Layer[]): void => {
    for (const l of list) {
      if (isContainer(l)) {
        const end = newRec(null, "</Layer group>");
        end.channels.push(...emptyChannels());
        end.blocks.push(block("lsct", (w) => w.u32(3)));
        end.flags = 24;
        recs.push(end);
        visit(l.children);
      }
      const rec = newRec(l, l.name);
      rec.blend = l.blend === "pass-through" ? (isContainer(l) ? "pass" : "norm") : BLEND_KEYS[l.blend] ?? "norm";
      rec.opacity = Math.round(l.opacity * 255);
      rec.clipping = l.clip ? 1 : 0;
      rec.flags = (l.locks.transparency ? 1 : 0) | (l.visible ? 0 : 2) | 8 | (isContainer(l) || l.kind === "adjustment" ? 16 : 0);
      const psd = ((l.data?.psd ?? {}) as PsdLayerData);

      if (isContainer(l)) {
        rec.channels.push(...emptyChannels());
        const key = BLEND_KEYS[l.blend] ?? "pass";
        rec.blocks.push(block("lsct", (w) => { w.u32(l.collapsed ? 2 : 1); w.sig("8BIM"); w.sig(key); }));
        if (l.kind === "artboard") {
          const r = l.rect, bg = l.background;
          rec.blocks.push(versioned("artb", desc("artboard", {
            artboardRect: obj("classFloatRect", { "Top ": doub(r.y), Left: doub(r.x), Btom: doub(r.y + r.h), Rght: doub(r.x + r.w) }),
            guideIndeces: { t: "VlLs", v: [] }, artboardPresetName: text(""), "Clr ": colorItem(bg ?? [1, 1, 1, 1]),
            artboardBackgroundType: long(!bg ? 3 : bg[0] === 1 && bg[1] === 1 && bg[2] === 1 ? 1 : bg[0] === 0 && bg[1] === 0 && bg[2] === 0 ? 2 : 4),
          })));
        }
      } else if (l.kind === "adjustment") {
        rec.channels.push(...emptyChannels());
        const codec = ADJUST_BY_OP.get(l.adjust.id);
        if (psd.adjustment && psd.adjustment.params === JSON.stringify(l.adjust.params)) rec.blocks.push({ key: psd.adjustment.key, data: psd.adjustment.bytes });
        else if (codec?.write) rec.blocks.push(block(codec.key, (w) => codec.write!(w, l.adjust.params)));
        else if (psd.adjustment) rec.blocks.push({ key: psd.adjustment.key, data: psd.adjustment.bytes }); // params changed but no encoder: the original stays
      } else if (l.kind === "fill") {
        const b = paintToBlock(l.paint);
        rec.blocks.push(versioned(b.key, b.d));
        const paint = l.paint;
        pixelChannels(rec, (r) => renderPaint(paint, r, undefined, doc.bounds), doc.bounds);
      } else if (hasRaster(l)) {
        renderHooks.prepare?.(doc, l);
        const raster = l.raster;
        pixelChannels(rec, (r) => raster.read(r.x, r.y, r.w, r.h), raster.bounds());
        if (l.kind === "text" && !opts.textAsPixels) {
          if (psd.text && psd.text.model === JSON.stringify(l.text)) rec.blocks.push({ key: "TySh", data: psd.text.bytes });
          else rec.blocks.push(block("TySh", (w) => writeTySh(w, textToTySh(l.text, raster.bounds()))));
        } else if (l.kind === "shape") {
          if (l.fillPaint) { const b = paintToBlock(l.fillPaint); rec.blocks.push(block("vscg", (w) => { w.sig(b.key); writeVersioned(w, b.d); })); }
          rec.blocks.push(block("vsms", (w) => { w.u32(3); w.u32(0); writePathRecords(w, l.path, W, H); }));
        } else if (l.kind === "smart") {
          const src = l.source.doc as { format?: string; id?: string; bytes?: Uint8Array; fileName?: string; fileType?: string } | null;
          if (psd.smart?.length && src?.format === "embedded" && src.bytes && src.id) {
            for (const s of psd.smart) rec.blocks.push({ key: s.key, data: s.bytes });
            if (!links.some((k) => k.id === src.id)) links.push({ id: src.id, name: src.fileName ?? l.name, type: src.fileType ?? "", data: src.bytes });
          }
        }
        if (l.kind === "text" && opts.textAsPixels && !march) rec.blocks.push(block("mrCh", (w) => w.bytes(new TextEncoder().encode(encodeJson({ kind: "text", fields: { text: l.text, plain: plainText(l.text) } })))));
      } else rec.channels.push(...emptyChannels());
      maskData(l, rec);
      common(l, rec);
      recs.push(rec);
    }
  };
  visit(doc.layers);

  // ——— layer info ———
  const writeLayerInfo = (w: Writer, mergedAlpha: boolean): void => {
    w.i16(mergedAlpha ? -recs.length : recs.length);
    for (const rec of recs) {
      const r = rec.rect;
      w.i32(r.y); w.i32(r.x); w.i32(r.y + r.h); w.i32(r.x + r.w);
      w.u16(rec.channels.length);
      for (const c of rec.channels) { w.i16(c.id); if (psb) w.u64(c.data.length); else w.u32(c.data.length); }
      w.sig("8BIM"); w.sig(rec.blend);
      w.u8(rec.opacity); w.u8(rec.clipping); w.u8(rec.flags); w.u8(0);
      const extra = w.begin();
      if (rec.mask) { w.u32(rec.mask.length); w.bytes(rec.mask); } else w.u32(0);
      w.u32(rec.ranges.length); w.bytes(rec.ranges);
      w.pascal(rec.name, 4);
      for (const b of rec.blocks) {
        w.sig("8BIM"); w.sig(b.key);
        const m = w.begin(psb && PSB_BIG.has(b.key));
        w.bytes(b.data);
        w.end(m, 4);
      }
      w.end(extra);
    }
    for (const rec of recs) for (const c of rec.channels) w.bytes(c.data);
  };

  // ——— merged image ———
  const bounds = doc.bounds;
  let mergedAlpha = false;
  const merged: Uint8Array[] = [];
  if (opts.merged !== false) {
    const p = planes((r) => {
      const f = renderRegion(doc, r);
      for (let i = 0; i < f.length; i += 4) { const a = f[i + 3]!; if (a < 1) mergedAlpha = true; if (a > 0) { f[i] = f[i]! / a; f[i + 1] = f[i + 1]! / a; f[i + 2] = f[i + 2]! / a; } }
      return f;
    }, bounds, depth);
    merged.push(p[0]!, p[1]!, p[2]!);
    if (mergedAlpha) merged.push(p[3]!);
  } else {
    for (let c = 0; c < 3; c++) merged.push(new Uint8Array(W * H * bps));
  }
  for (const ch of doc.channels) merged.push(maskPlane(ch.mask, bounds, depth));

  // ——— file ———
  const w = new Writer(1 << 20);
  w.psb = psb;
  w.sig("8BPS"); w.u16(psb ? 2 : 1); w.zeros(6);
  w.u16(merged.length); w.u32(H); w.u32(W); w.u16(depth); w.u16(3);
  w.u32(0); // color mode data

  // image resources
  const resStart = w.begin();
  const res = (id: number, fn: (w: Writer) => void, name = ""): void => {
    w.sig("8BIM"); w.u16(id); w.pascal(name, 2);
    const m = w.begin();
    fn(w);
    w.end(m);
    if ((w.pos - m.at - 4) % 2) w.u8(0);
  };
  res(1005, (x) => { x.fixed(doc.dpi); x.u16(1); x.u16(1); x.fixed(doc.dpi); x.u16(1); x.u16(1); });
  const icc = psdMeta.icc;
  if (icc instanceof Uint8Array && icc.length) res(1039, (x) => x.bytes(icc));
  if (doc.guides.length) res(1032, (x) => { x.u32(1); x.u32(576); x.u32(576); x.u32(doc.guides.length); for (const g of doc.guides) { x.i32(Math.round(g.pos * 32)); x.u8(g.axis === "x" ? 0 : 1); } });
  if (doc.slices.length) res(1050, (x) => {
    x.u32(6); x.i32(0); x.i32(0); x.i32(H); x.i32(W); x.unicode(doc.name); x.u32(doc.slices.length);
    doc.slices.forEach((s, i) => {
      x.u32(i + 1); x.u32(0); x.u32(s.kind === "layer" ? 1 : s.kind === "auto" ? 0 : 2);
      if (s.kind === "layer") x.u32(0);
      x.unicode(s.name); x.u32(1);
      x.i32(s.rect.x); x.i32(s.rect.y); x.i32(s.rect.x + s.rect.w); x.i32(s.rect.y + s.rect.h);
      x.unicode(s.url ?? ""); x.unicode(""); x.unicode(""); x.unicode(s.alt ?? ""); x.u8(0); x.unicode(""); x.u32(0); x.u32(0); x.u8(0); x.u8(0); x.u8(0); x.u8(0);
    });
  });
  const comps = psdMeta.layerComps;
  if (comps instanceof Uint8Array) res(1065, (x) => x.bytes(comps));
  if (doc.channels.length) {
    res(1006, (x) => { for (const c of doc.channels) x.pascal(c.name, 1); });
    res(1045, (x) => { for (const c of doc.channels) x.unicode(c.name, true); });
  }
  doc.paths.forEach((p, i) => res(p.work ? 1025 : 2000 + i, (x) => writePathRecords(x, p.path, W, H), p.work ? "" : p.name));
  for (const k of (psdMeta.resources ?? []) as { id: number; name: string; data: Uint8Array }[]) {
    if (OWN_RES.has(k.id) || (k.id >= 2000 && k.id <= 2998)) continue;
    res(k.id, (x) => x.bytes(k.data), k.name);
  }
  w.end(resStart);

  // layer and mask information
  const lm = w.begin(psb);
  const li = w.begin(psb);
  if (depth === 8 && recs.length) writeLayerInfo(w, mergedAlpha);
  w.end(li, 2);
  w.u32(0); // global layer mask info
  const global = (key: string, fn: (w: Writer) => void): void => {
    w.sig("8BIM"); w.sig(key);
    const m = w.begin(psb && PSB_BIG.has(key));
    fn(w);
    w.end(m, 4);
  };
  if (depth !== 8 && recs.length) global(depth === 16 ? "Lr16" : "Lr32", (x) => writeLayerInfo(x, mergedAlpha));
  if (links.length) global("lnk2", (x) => {
    for (const k of links) {
      const m = x.begin(true);
      x.sig("liFD"); x.u32(7); x.pascal(k.id, 1); x.unicode(k.name); x.sig((k.type + "    ").slice(0, 4)); x.sig("    ");
      x.u64(k.data.length); x.u8(0); x.bytes(k.data);
      x.unicode(""); x.f64(0); x.u8(0);
      x.end(m, 4);
    }
  });
  if (march) {
    const docFields: Record<string, unknown> = { name: doc.name, profile: doc.profile, notes: doc.notes, counts: doc.counts, samplers: doc.samplers, dataSets: doc.dataSets, grid: doc.grid, globalLight: doc.globalLight, proof: doc.proof, mode: doc.mode };
    const { psd: _p, ...meta } = doc.meta;
    if (Object.keys(meta).length) docFields.meta = meta;
    global("mrCh", (x) => x.bytes(new TextEncoder().encode(encodeJson(docFields))));
  }
  w.end(lm, 2);

  // merged image data
  if (rle) {
    w.u16(1);
    const enc = merged.map((p) => encodeChannel(p, W, H, bps, true, psb));
    const cs = psb ? 4 : 2;
    for (const e of enc) w.bytes(e.subarray(2, 2 + H * cs));
    for (const e of enc) w.bytes(e.subarray(2 + H * cs));
  } else {
    w.u16(0);
    for (const p of merged) w.bytes(p);
  }
  return w.done();
}
