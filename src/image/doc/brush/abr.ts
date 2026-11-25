// .abr brush import (a separate CDN entry: self-contained, only type imports). Reads versions 1, 2 (computed and
// sampled brushes) and 6+ (6, 7, 10: the "8BIM" section layout; sampled brushes 8- and 16-bit, raw or RLE) and returns
// brush presets with image tips. Parameters stored in the 6+ "desc" descriptor (dynamics) are not read: the samples get
// a 25 % spacing default.
//
// The format is not officially documented beyond the PSD spec's PackBits and "8BIM" resource conventions. This parser
// is our own, written from public reverse-engineering notes:
// - the Photoshop File Formats specification (PackBits RLE, big-endian layout, "8BIM" resource blocks);
// - the layout described by the GIMP ABR loader notes (v1/v2 brush headers: type, size, misc, spacing, optional UCS-2
//   name, anti-alias byte, short and long bounds, depth, compression; v6 "samp" section: per-brush length padded to 4,
//   a 37-byte id plus 10 bytes (sub-version 1) or 264 bytes (sub-version 2), long bounds, depth, compression);
// - Krita's ABR notes for 16-bit samples (big-endian, scaled to 8-bit) and the per-row RLE byte counts.

import type { BrushPreset } from "./presets.ts";

class Reader {
  pos = 0;
  readonly buf: Uint8Array;
  readonly v: DataView;
  constructor(buf: Uint8Array) { this.buf = buf; this.v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength); }
  get left(): number { return this.buf.length - this.pos; }
  need(n: number): void { if (this.pos + n > this.buf.length) throw new Error("ABR: unexpected end of file"); }
  u8(): number { this.need(1); return this.buf[this.pos++]!; }
  i16(): number { this.need(2); const r = this.v.getInt16(this.pos); this.pos += 2; return r; }
  u16(): number { this.need(2); const r = this.v.getUint16(this.pos); this.pos += 2; return r; }
  i32(): number { this.need(4); const r = this.v.getInt32(this.pos); this.pos += 4; return r; }
  u32(): number { this.need(4); const r = this.v.getUint32(this.pos); this.pos += 4; return r; }
  tag(): string { this.need(4); const s = String.fromCharCode(...this.buf.subarray(this.pos, this.pos + 4)); this.pos += 4; return s; }
  bytes(n: number): Uint8Array { this.need(n); const r = this.buf.subarray(this.pos, this.pos + n); this.pos += n; return r; }
  skip(n: number): void { this.need(n); this.pos += n; }
  /** UCS-2 text: a 32-bit character count (with the terminating 0), then big-endian code units. */
  ucs2(): string {
    const n = this.u32();
    let s = "";
    for (let i = 0; i < n; i++) { const c = this.u16(); if (c) s += String.fromCharCode(c); }
    return s;
  }
}

/** PackBits rows (the PSD scheme): a run header n ≥ 0 copies n+1 bytes, n < 0 repeats the next byte 1−n times. */
export function unpackBits(src: Uint8Array, out: Uint8Array, at: number, rowBytes: number): void {
  let i = 0, o = at;
  const end = at + rowBytes;
  while (i < src.length && o < end) {
    const n = (src[i++]! << 24) >> 24;
    if (n >= 0) { for (let k = 0; k <= n && o < end; k++) out[o++] = src[i++] ?? 0; }
    else if (n !== -128) { const b = src[i++] ?? 0; for (let k = 0; k < 1 - n && o < end; k++) out[o++] = b; }
  }
}

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
function b64(b: Uint8Array): string {
  let s = "";
  for (let i = 0; i < b.length; i += 3) {
    const n = (b[i]! << 16) | ((b[i + 1] ?? 0) << 8) | (b[i + 2] ?? 0);
    s += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + (i + 1 < b.length ? B64[(n >> 6) & 63]! : "=") + (i + 2 < b.length ? B64[n & 63]! : "=");
  }
  return s;
}

/** Read a sampled brush's pixels (after its header) into 8-bit alpha. */
function readSample(r: Reader, width: number, height: number, depth: number, compressed: boolean): Uint8Array {
  const bpp = depth === 16 ? 2 : 1, rowBytes = width * bpp, raw = new Uint8Array(rowBytes * height);
  if (!compressed) raw.set(r.bytes(raw.length));
  else {
    const counts: number[] = [];
    for (let y = 0; y < height; y++) counts.push(r.u16());
    for (let y = 0; y < height; y++) unpackBits(r.bytes(counts[y]!), raw, y * rowBytes, rowBytes);
  }
  if (bpp === 1) return raw;
  const out = new Uint8Array(width * height);
  for (let i = 0; i < out.length; i++) out[i] = Math.round((((raw[i * 2]! << 8) | raw[i * 2 + 1]!) / 65535) * 255);
  return out;
}

const MAX_SIDE = 8192;

function preset(name: string, width: number, height: number, alpha: Uint8Array, spacing: number, index: number, file: string): BrushPreset {
  return {
    id: `abr-${file}-${index}`, name: name || `${file} ${index + 1}`, category: file || "Imported",
    tip: { type: "image", width, height, data: b64(alpha), name },
    size: Math.max(width, height), spacing,
  };
}

function readV12(r: Reader, version: number, file: string): BrushPreset[] {
  const count = r.u16(), out: BrushPreset[] = [];
  for (let i = 0; i < count && r.left > 6; i++) {
    const type = r.u16(), size = r.u32(), next = r.pos + size;
    if (type === 1) {
      // computed brush: misc, spacing, diameter, roundness, angle, hardness
      r.skip(4);
      const spacing = r.u16(), diameter = r.u16(), roundness = r.u16(), angle = r.i16(), hardness = r.u16();
      out.push({
        id: `abr-${file}-${i}`, name: `${file || "Brush"} ${i + 1}`, category: file || "Imported",
        tip: { type: "round", hardness: Math.min(1, hardness / 100) }, size: Math.max(1, diameter),
        roundness: Math.max(0.01, Math.min(1, roundness / 100)), angle, spacing: spacing / 100,
      });
    } else if (type === 2) {
      r.skip(4); // misc
      const spacing = r.u16();
      const name = version === 2 ? r.ucs2() : "";
      r.skip(1); // anti-alias
      r.skip(8); // short bounds
      const top = r.i32(), left = r.i32(), bottom = r.i32(), right = r.i32();
      const depth = r.u16(), compressed = r.u8() === 1;
      const width = right - left, height = bottom - top;
      if (width > 0 && height > 0 && width <= MAX_SIDE && height <= MAX_SIDE) {
        const a = readSample(r, width, height, depth, compressed);
        out.push(preset(name, width, height, a, spacing / 100 || 0.25, i, file));
      }
    }
    r.pos = Math.min(next, r.buf.length);
  }
  return out;
}

function readV6(r: Reader, sub: number, file: string): BrushPreset[] {
  // find the "samp" section among the 8BIM blocks
  let end = -1;
  while (r.left >= 12) {
    const sig = r.tag();
    if (sig !== "8BIM" && sig !== "8B64") throw new Error("ABR: missing 8BIM section");
    const key = r.tag(), len = r.u32();
    if (key === "samp") { end = r.pos + len; break; }
    r.skip(Math.min(len, r.left));
  }
  if (end < 0) return [];
  const out: BrushPreset[] = [];
  let i = 0;
  while (r.pos + 4 <= end) {
    const len = r.u32();
    const next = r.pos + len + ((4 - (len % 4)) % 4);
    r.skip(sub === 1 ? 47 : 301);
    const top = r.i32(), left = r.i32(), bottom = r.i32(), right = r.i32();
    const depth = r.u16(), compressed = r.u8() === 1;
    const width = right - left, height = bottom - top;
    if (width > 0 && height > 0 && width <= MAX_SIDE && height <= MAX_SIDE && (depth === 8 || depth === 16)) {
      out.push(preset("", width, height, readSample(r, width, height, depth, compressed), 0.25, i, file));
    }
    i++;
    r.pos = Math.min(next, end);
  }
  return out;
}

/**
 * Parse an .abr file into brush presets with image tips (sampled) or round tips (v1/v2 computed brushes).
 * `name` prefixes ids and names (usually the file name without extension). Throws on unsupported versions.
 */
export function parseAbr(data: ArrayBuffer | Uint8Array, name = "abr"): BrushPreset[] {
  const r = new Reader(data instanceof Uint8Array ? data : new Uint8Array(data));
  const version = r.u16();
  const file = name.replace(/\.abr$/i, "");
  if (version === 1 || version === 2) return readV12(r, version, file);
  if (version >= 6 && version <= 10) {
    const sub = r.u16();
    if (sub !== 1 && sub !== 2) throw new Error(`ABR: unsupported sub-version ${sub}`);
    return readV6(r, sub, file);
  }
  throw new Error(`ABR: unsupported version ${version}`);
}
