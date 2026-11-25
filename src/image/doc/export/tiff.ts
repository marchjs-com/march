// Baseline TIFF encoder (little endian): RGB / RGBA (unassociated alpha), 8 / 16-bit, uncompressed, PackBits or LZW,
// strips of about 64 KB, resolution, text tags and an embedded ICC profile.

import type { RawImage } from "./png.ts";

export interface TiffOptions {
  compression?: "none" | "packbits" | "lzw" | undefined;
  dpi?: number | undefined;
  /** ImageDescription, Artist, Copyright, Software, DocumentName. */
  text?: { description?: string; artist?: string; copyright?: string; software?: string; title?: string } | undefined;
  icc?: Uint8Array | undefined;
}

export const TIFF_TAGS = {
  ImageWidth: 256, ImageLength: 257, BitsPerSample: 258, Compression: 259, Photometric: 262, DocumentName: 269, ImageDescription: 270,
  StripOffsets: 273, SamplesPerPixel: 277, RowsPerStrip: 278, StripByteCounts: 279, XResolution: 282, YResolution: 283,
  PlanarConfiguration: 284, ResolutionUnit: 296, Software: 305, Artist: 315, ExtraSamples: 338, SampleFormat: 339, Copyright: 33432, ICCProfile: 34675,
} as const;

/** PackBits one row (TIFF compression 32773). */
function packRow(src: Uint8Array, out: number[]): void {
  let i = 0;
  const n = src.length;
  while (i < n) {
    let run = 1;
    while (i + run < n && run < 128 && src[i + run] === src[i]) run++;
    if (run >= 2) { out.push((257 - run) & 255, src[i]!); i += run; continue; }
    let j = i + 1;
    while (j < n && j - i < 128 && !(j + 2 < n && src[j] === src[j + 1] && src[j] === src[j + 2])) j++;
    out.push(j - i - 1);
    for (let k = i; k < j; k++) out.push(src[k]!);
    i = j;
  }
}

/** TIFF LZW (MSB-first codes, early change), one strip. */
export function lzwEncode(src: Uint8Array): Uint8Array {
  const out: number[] = [];
  let acc = 0, bits = 0;
  const emit = (code: number, width: number): void => {
    acc = (acc << width) | code; bits += width;
    while (bits >= 8) { out.push((acc >>> (bits - 8)) & 255); bits -= 8; }
    acc &= (1 << bits) - 1;
  };
  const widthFor = (next: number): number => (next >= 2048 ? 12 : next >= 1024 ? 11 : next >= 512 ? 10 : 9);
  let dict = new Map<number, number>();
  let next = 258;
  emit(256, 9);
  if (!src.length) { emit(257, 9); if (bits) out.push((acc << (8 - bits)) & 255); return new Uint8Array(out); }
  let w = src[0]!;
  for (let i = 1; i < src.length; i++) {
    const k = src[i]!, key = w * 256 + k;
    const hit = dict.get(key);
    if (hit !== undefined) { w = hit; continue; }
    emit(w, widthFor(next));
    dict.set(key, next++);
    if (next >= 4093) { emit(256, widthFor(next)); dict = new Map(); next = 258; }
    w = k;
  }
  emit(w, widthFor(next));
  emit(257, widthFor(next + 1));
  if (bits) out.push((acc << (8 - bits)) & 255);
  return new Uint8Array(out);
}

/** TIFF LZW decoder (tests and round trips). */
export function lzwDecode(src: Uint8Array, expected: number): Uint8Array {
  const out = new Uint8Array(expected);
  let o = 0, pos = 0, width = 9;
  let table: Uint8Array[] = [];
  const reset = (): void => { table = []; for (let i = 0; i < 256; i++) table.push(new Uint8Array([i])); table.push(new Uint8Array(0), new Uint8Array(0)); width = 9; };
  const read = (): number => {
    let v = 0;
    for (let i = 0; i < width; i++) { const byte = src[pos >> 3] ?? 0; v = (v << 1) | ((byte >> (7 - (pos & 7))) & 1); pos++; }
    return v;
  };
  reset();
  let prev: Uint8Array | null = null;
  while (o < expected && pos + width <= src.length * 8) {
    const code = read();
    if (code === 257) break;
    if (code === 256) { reset(); prev = null; continue; }
    let entry: Uint8Array;
    if (code < table.length) entry = table[code]!;
    else if (prev) { entry = new Uint8Array(prev.length + 1); entry.set(prev); entry[prev.length] = prev[0]!; }
    else break;
    out.set(entry.subarray(0, Math.min(entry.length, expected - o)), o);
    o += entry.length;
    if (prev) { const e = new Uint8Array(prev.length + 1); e.set(prev); e[prev.length] = entry[0]!; table.push(e); }
    prev = entry;
    const n = table.length + 1; // early change: wider codes one entry before the table needs them
    width = n >= 2048 ? 12 : n >= 1024 ? 11 : n >= 512 ? 10 : 9;
  }
  return out;
}

/** Encode a baseline TIFF (RGB or RGBA; gray inputs are expanded to RGB). */
export function encodeTiff(img: RawImage, o: TiffOptions = {}): Uint8Array {
  const { width, height, depth } = img;
  let channels = img.channels, data = img.data;
  if (channels < 3) {
    // gray (+ alpha) → RGB (+ alpha)
    const nc = channels === 1 ? 3 : 4, n = width * height;
    const d = depth === 8 ? new Uint8Array(n * nc) : new Uint16Array(n * nc);
    for (let i = 0; i < n; i++) { const g = data[i * channels]!; d[i * nc] = g; d[i * nc + 1] = g; d[i * nc + 2] = g; if (nc === 4) d[i * nc + 3] = data[i * channels + 1]!; }
    channels = nc as 3 | 4; data = d;
  }
  const bps = depth / 8, stride = width * channels * bps;
  const rowsPerStrip = Math.max(1, Math.min(height, Math.floor(65536 / Math.max(1, stride))));
  const comp = o.compression ?? "none";
  const strips: Uint8Array[] = [];
  for (let y = 0; y < height; y += rowsPerStrip) {
    const rows = Math.min(rowsPerStrip, height - y);
    const raw = new Uint8Array(stride * rows);
    if (depth === 8) raw.set((data as Uint8Array).subarray(y * width * channels, (y + rows) * width * channels));
    else { const dv = new DataView(raw.buffer); const off = y * width * channels; for (let i = 0; i < rows * width * channels; i++) dv.setUint16(i * 2, data[off + i]!, true); }
    if (comp === "packbits") { const out: number[] = []; for (let r = 0; r < rows; r++) packRow(raw.subarray(r * stride, (r + 1) * stride), out); strips.push(new Uint8Array(out)); }
    else if (comp === "lzw") strips.push(lzwEncode(raw));
    else strips.push(raw);
  }

  const enc = new TextEncoder();
  const ascii = (s: string): Uint8Array => { const b = enc.encode(s.replace(/[^\x20-\x7e\n]/g, "?")); const z = new Uint8Array(b.length + 1); z.set(b); return z; };
  type Entry = { tag: number; type: number; count: number; value: number[] | Uint8Array };
  const entries: Entry[] = [];
  const SHORT = 3, LONG = 4, RATIONAL = 5, ASCII = 2, UNDEF = 7;
  const add = (tag: number, type: number, value: number[] | Uint8Array, count = value.length): void => { entries.push({ tag, type, count, value }); };
  add(256, LONG, [width]); add(257, LONG, [height]);
  add(258, SHORT, Array(channels).fill(depth));
  add(259, SHORT, [comp === "packbits" ? 32773 : comp === "lzw" ? 5 : 1]);
  add(262, SHORT, [2]);
  if (o.text?.title) add(269, ASCII, ascii(o.text.title));
  if (o.text?.description) add(270, ASCII, ascii(o.text.description));
  add(273, LONG, strips.map(() => 0));
  add(277, SHORT, [channels]);
  add(278, LONG, [rowsPerStrip]);
  add(279, LONG, strips.map((s) => s.length));
  const dpi = o.dpi ?? 72;
  add(282, RATIONAL, [Math.round(dpi * 100), 100]);
  add(283, RATIONAL, [Math.round(dpi * 100), 100]);
  add(284, SHORT, [1]);
  add(296, SHORT, [2]);
  add(305, ASCII, ascii(o.text?.software ?? "March"));
  if (o.text?.artist) add(315, ASCII, ascii(o.text.artist));
  if (channels === 4) add(338, SHORT, [2]);
  add(339, SHORT, Array(channels).fill(1));
  if (o.text?.copyright) add(33432, ASCII, ascii(o.text.copyright));
  if (o.icc) add(34675, UNDEF, o.icc);
  for (const e of entries) if (e.type === RATIONAL) e.count = (e.value as number[]).length / 2;
  entries.sort((a, b) => a.tag - b.tag);

  const size = (e: Entry): number => (e.type === SHORT ? 2 : e.type === LONG ? 4 : e.type === RATIONAL ? 8 : 1) * e.count;
  const ifdSize = 2 + entries.length * 12 + 4;
  let extra = 0;
  for (const e of entries) { const s = size(e); if (s > 4) extra += s + (s & 1); }
  let dataOff = 8 + ifdSize + extra;
  const stripOffsets: number[] = [];
  for (const s of strips) { stripOffsets.push(dataOff); dataOff += s.length + (s.length & 1); }
  entries.find((e) => e.tag === 273)!.value = stripOffsets;

  const out = new Uint8Array(dataOff);
  const dv = new DataView(out.buffer);
  out[0] = 0x49; out[1] = 0x49; dv.setUint16(2, 42, true); dv.setUint32(4, 8, true);
  let p = 8, ext = 8 + ifdSize;
  dv.setUint16(p, entries.length, true); p += 2;
  const put = (at: number, e: Entry): void => {
    if (e.value instanceof Uint8Array) { out.set(e.value, at); return; }
    const v = e.value;
    for (let i = 0; i < v.length; i++) {
      if (e.type === SHORT) dv.setUint16(at + i * 2, v[i]!, true);
      else dv.setUint32(at + i * 4, v[i]!, true);
    }
  };
  for (const e of entries) {
    dv.setUint16(p, e.tag, true); dv.setUint16(p + 2, e.type, true); dv.setUint32(p + 4, e.count, true);
    const s = size(e);
    if (s <= 4) put(p + 8, e);
    else { dv.setUint32(p + 8, ext, true); put(ext, e); ext += s + (s & 1); }
    p += 12;
  }
  dv.setUint32(p, 0, true);
  strips.forEach((s, i) => out.set(s, stripOffsets[i]!));
  return out;
}
