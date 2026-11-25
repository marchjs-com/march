// Checksums and zlib streams for the encoders: CRC-32 (PNG chunks), Adler-32 (zlib trailer), deflate / inflate through
// CompressionStream when the runtime has it, and a stored-block zlib writer as the fallback (valid everywhere,
// uncompressed).

let CRC_TABLE: Uint32Array | null = null;
function crcTable(): Uint32Array {
  if (CRC_TABLE) return CRC_TABLE;
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return (CRC_TABLE = t);
}

/** CRC-32 (ISO 3309, as PNG uses it); pass the previous value to continue over several buffers. */
export function crc32(u: Uint8Array, crc = 0): number {
  const t = crcTable();
  let c = (crc ^ 0xffffffff) >>> 0;
  for (let i = 0; i < u.length; i++) c = t[(c ^ u[i]!) & 255]! ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Adler-32 (the zlib stream checksum). */
export function adler32(u: Uint8Array, adler = 1): number {
  let a = adler & 0xffff, b = adler >>> 16;
  const n = u.length;
  let i = 0;
  while (i < n) {
    const end = Math.min(n, i + 5552); // the largest run before the sums can overflow 2^32
    for (; i < end; i++) { a += u[i]!; b += a; }
    a %= 65521; b %= 65521;
  }
  return ((b << 16) | a) >>> 0;
}

type Format = "deflate" | "deflate-raw";
const hasCS = (): boolean => typeof (globalThis as { CompressionStream?: unknown }).CompressionStream === "function";
const hasDS = (): boolean => typeof (globalThis as { DecompressionStream?: unknown }).DecompressionStream === "function";

async function pipe(u: Uint8Array, t: TransformStream<Uint8Array, Uint8Array>): Promise<Uint8Array> {
  const s = new Blob([u as BlobPart]).stream().pipeThrough(t as unknown as TransformStream<Uint8Array, Uint8Array>);
  return new Uint8Array(await new Response(s).arrayBuffer());
}

/** A zlib stream made of stored (uncompressed) deflate blocks: valid input for any inflater. */
export function zlibStored(u: Uint8Array): Uint8Array {
  const blocks = Math.max(1, Math.ceil(u.length / 65535));
  const out = new Uint8Array(2 + u.length + blocks * 5 + 4);
  out[0] = 0x78; out[1] = 0x01;
  let o = 2;
  for (let b = 0; b < blocks; b++) {
    const start = b * 65535, len = Math.min(65535, u.length - start);
    out[o++] = b === blocks - 1 ? 1 : 0;
    out[o++] = len & 255; out[o++] = len >> 8; out[o++] = ~len & 255; out[o++] = (~len >> 8) & 255;
    out.set(u.subarray(start, start + len), o);
    o += len;
  }
  const a = adler32(u);
  out[o++] = a >>> 24; out[o++] = (a >>> 16) & 255; out[o++] = (a >>> 8) & 255; out[o++] = a & 255;
  return out;
}

/** zlib-compress (RFC 1950): CompressionStream("deflate") when present, stored blocks otherwise. */
export async function zlibDeflate(u: Uint8Array, format: Format = "deflate"): Promise<Uint8Array> {
  if (hasCS()) return pipe(u, new CompressionStream(format) as unknown as TransformStream<Uint8Array, Uint8Array>);
  if (format === "deflate") return zlibStored(u);
  return zlibStored(u).subarray(2, -4);
}

/** zlib-decompress (RFC 1950, or raw deflate). Needs DecompressionStream, or a stream of stored blocks. */
export async function zlibInflate(u: Uint8Array, format: Format = "deflate"): Promise<Uint8Array> {
  if (hasDS()) return pipe(u, new DecompressionStream(format) as unknown as TransformStream<Uint8Array, Uint8Array>);
  return inflateStored(format === "deflate" ? u.subarray(2) : u);
}

/** Fallback inflater: stored blocks only (what zlibStored writes). */
function inflateStored(u: Uint8Array): Uint8Array {
  const parts: Uint8Array[] = [];
  let i = 0, total = 0;
  for (;;) {
    const h = u[i++]!;
    if ((h >> 1) & 3) throw new Error("This runtime cannot inflate compressed data (no DecompressionStream)");
    const len = u[i]! | (u[i + 1]! << 8);
    i += 4;
    parts.push(u.subarray(i, i + len)); total += len; i += len;
    if (h & 1) break;
  }
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
