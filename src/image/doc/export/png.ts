// PNG encoder: 8 / 16-bit gray, gray + alpha, RGB, RGBA; adaptive row filters; zlib through CompressionStream (stored
// blocks where there is none); pHYs (resolution), tEXt / iTXt metadata, sRGB or an embedded ICC profile (iCCP).

import { crc32, zlibDeflate, zlibStored } from "./zlib.ts";

/** Interleaved samples (8-bit: 0–255, 16-bit: 0–65535), `channels` per pixel. */
export interface RawImage {
  width: number;
  height: number;
  channels: 1 | 2 | 3 | 4;
  depth: 8 | 16;
  data: Uint8Array | Uint8ClampedArray | Uint16Array;
}

export interface PngOptions {
  /** Pixels per inch (pHYs). */
  dpi?: number | undefined;
  /** Text chunks (Title, Author, Description, Copyright, Software, Comment…); non-Latin-1 values go to iTXt. */
  text?: Record<string, string> | undefined;
  /** "srgb" writes an sRGB chunk; an ICC profile is embedded as iCCP. */
  colorProfile?: "srgb" | { name: string; icc: Uint8Array } | null | undefined;
  /** Deflate (default true); false writes stored blocks (fast, large). */
  compress?: boolean | undefined;
}

const SIG = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]);
const latin1 = (s: string): boolean => /^[\x20-\x7e\xa0-\xff\n]*$/.test(s);

function chunk(type: string, data: Uint8Array): Uint8Array {
  const out = new Uint8Array(12 + data.length);
  const dv = new DataView(out.buffer);
  dv.setUint32(0, data.length);
  for (let i = 0; i < 4; i++) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8);
  dv.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
}

const bytesOf = (s: string): Uint8Array => Uint8Array.from(s, (c) => c.charCodeAt(0) & 255);

/** Filtered scanlines (filter byte + row), each row with the filter that gives the smallest sum of |values|. */
export function filterRows(img: RawImage): Uint8Array {
  const { width, height, channels, depth } = img;
  const bpp = channels * (depth / 8), stride = width * bpp;
  // big-endian sample bytes
  const raw = new Uint8Array(stride * height);
  if (depth === 8) raw.set(img.data as ArrayLike<number>);
  else { const d = img.data; for (let i = 0; i < d.length; i++) { raw[i * 2] = d[i]! >> 8; raw[i * 2 + 1] = d[i]! & 255; } }
  const out = new Uint8Array((stride + 1) * height);
  const cand = [0, 1, 2, 3, 4].map(() => new Uint8Array(stride));
  for (let y = 0; y < height; y++) {
    const row = raw.subarray(y * stride, (y + 1) * stride);
    const up = y ? raw.subarray((y - 1) * stride, y * stride) : null;
    let best = 0, bestSum = Infinity;
    for (let f = 0; f < 5; f++) {
      const c = cand[f]!;
      let sum = 0;
      for (let i = 0; i < stride; i++) {
        const a = i >= bpp ? row[i - bpp]! : 0, b = up ? up[i]! : 0, cc = up && i >= bpp ? up[i - bpp]! : 0;
        let p: number;
        if (f === 0) p = row[i]!;
        else if (f === 1) p = row[i]! - a;
        else if (f === 2) p = row[i]! - b;
        else if (f === 3) p = row[i]! - ((a + b) >> 1);
        else {
          const pa = Math.abs(b - cc), pb = Math.abs(a - cc), pc = Math.abs(a + b - 2 * cc);
          p = row[i]! - (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc);
        }
        const v = p & 255;
        c[i] = v;
        sum += v < 128 ? v : 256 - v;
        if (sum >= bestSum) break;
      }
      if (sum < bestSum) { bestSum = sum; best = f; }
    }
    // recompute the winner fully (the loop above may have stopped early for it on a tie)
    const c = cand[best]!;
    for (let i = 0; i < stride; i++) {
      const a = i >= bpp ? row[i - bpp]! : 0, b = up ? up[i]! : 0, cc = up && i >= bpp ? up[i - bpp]! : 0;
      let p: number;
      if (best === 0) p = row[i]!;
      else if (best === 1) p = row[i]! - a;
      else if (best === 2) p = row[i]! - b;
      else if (best === 3) p = row[i]! - ((a + b) >> 1);
      else { const pa = Math.abs(b - cc), pb = Math.abs(a - cc), pc = Math.abs(a + b - 2 * cc); p = row[i]! - (pa <= pb && pa <= pc ? a : pb <= pc ? b : cc); }
      c[i] = p & 255;
    }
    out[y * (stride + 1)] = best;
    out.set(c, y * (stride + 1) + 1);
  }
  return out;
}

/** Encode a PNG file. */
export async function encodePng(img: RawImage, o: PngOptions = {}): Promise<Uint8Array> {
  const { width, height, channels, depth } = img;
  if (width < 1 || height < 1) throw new Error("PNG: empty image");
  const ihdr = new Uint8Array(13);
  const dv = new DataView(ihdr.buffer);
  dv.setUint32(0, width); dv.setUint32(4, height);
  ihdr[8] = depth; ihdr[9] = channels === 1 ? 0 : channels === 2 ? 4 : channels === 3 ? 2 : 6;
  const parts: Uint8Array[] = [SIG, chunk("IHDR", ihdr)];
  const cp = o.colorProfile;
  if (cp === "srgb") parts.push(chunk("sRGB", new Uint8Array([0])));
  else if (cp && cp.icc) {
    const name = bytesOf(cp.name.replace(/[^\x20-\x7e]/g, "").slice(0, 79) || "ICC");
    const z = await zlibDeflate(cp.icc);
    const d = new Uint8Array(name.length + 2 + z.length);
    d.set(name); d[name.length + 1] = 0; d.set(z, name.length + 2);
    parts.push(chunk("iCCP", d));
  }
  if (o.dpi) {
    const p = new Uint8Array(9), pv = new DataView(p.buffer), ppm = Math.round(o.dpi / 0.0254);
    pv.setUint32(0, ppm); pv.setUint32(4, ppm); p[8] = 1;
    parts.push(chunk("pHYs", p));
  }
  for (const [k, v] of Object.entries(o.text ?? {})) {
    const key = bytesOf(k.replace(/[^\x20-\x7e]/g, "").slice(0, 79));
    if (latin1(v)) { const val = bytesOf(v); const d = new Uint8Array(key.length + 1 + val.length); d.set(key); d.set(val, key.length + 1); parts.push(chunk("tEXt", d)); }
    else {
      const val = new TextEncoder().encode(v);
      const d = new Uint8Array(key.length + 5 + val.length);
      d.set(key); d.set(val, key.length + 5); // keyword, 0, compression flag 0, method 0, empty language 0, empty translated keyword 0
      parts.push(chunk("iTXt", d));
    }
  }
  const filtered = filterRows(img);
  const z = o.compress === false ? zlibStored(filtered) : await zlibDeflate(filtered);
  parts.push(chunk("IDAT", z), chunk("IEND", new Uint8Array(0)));
  let total = 0;
  for (const p of parts) total += p.length;
  const out = new Uint8Array(total);
  let off = 0;
  for (const p of parts) { out.set(p, off); off += p.length; }
  return out;
}
