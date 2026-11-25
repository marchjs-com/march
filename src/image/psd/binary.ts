// Big-endian byte reader and growing writer for the PSD / PSB file format (lengths, Pascal and Unicode strings,
// fixed-point numbers, sections whose length is patched in after their contents are written).

const latin = new TextDecoder("latin1");

export class Reader {
  u: Uint8Array;
  dv: DataView;
  pos: number;
  /** PSB (large document format): some lengths are 8 bytes. */
  psb = false;

  constructor(u: Uint8Array, pos = 0) {
    this.u = u;
    this.dv = new DataView(u.buffer, u.byteOffset, u.byteLength);
    this.pos = pos;
  }

  get left(): number { return this.u.byteLength - this.pos; }
  need(n: number): void { if (n < 0 || this.pos + n > this.u.byteLength) throw new Error(`PSD: unexpected end of data at ${this.pos} (+${n})`); }
  u8(): number { this.need(1); return this.u[this.pos++]!; }
  i8(): number { this.need(1); return this.dv.getInt8(this.pos++); }
  u16(): number { this.need(2); const v = this.dv.getUint16(this.pos); this.pos += 2; return v; }
  i16(): number { this.need(2); const v = this.dv.getInt16(this.pos); this.pos += 2; return v; }
  u32(): number { this.need(4); const v = this.dv.getUint32(this.pos); this.pos += 4; return v; }
  i32(): number { this.need(4); const v = this.dv.getInt32(this.pos); this.pos += 4; return v; }
  u64(): number { this.need(8); const hi = this.dv.getUint32(this.pos), lo = this.dv.getUint32(this.pos + 4); this.pos += 8; return hi * 4294967296 + lo; }
  i64(): bigint { this.need(8); const v = this.dv.getBigInt64(this.pos); this.pos += 8; return v; }
  f32(): number { this.need(4); const v = this.dv.getFloat32(this.pos); this.pos += 4; return v; }
  f64(): number { this.need(8); const v = this.dv.getFloat64(this.pos); this.pos += 8; return v; }
  /** 16.16 fixed point. */
  fixed(): number { return this.i32() / 65536; }
  bytes(n: number): Uint8Array { this.need(n); const b = this.u.subarray(this.pos, this.pos + n); this.pos += n; return b; }
  skip(n: number): void { this.need(n); this.pos += n; }
  /** A 4-character code (signature, key, OSType). */
  sig(): string { return latin.decode(this.bytes(4)); }
  ascii(n: number): string { return latin.decode(this.bytes(n)); }
  /** Pascal string: length byte, bytes, padded so the total is a multiple of `pad`. */
  pascal(pad = 2): string {
    const n = this.u8();
    const s = latin.decode(this.bytes(n));
    const total = n + 1;
    if (total % pad) this.skip(pad - (total % pad));
    return s;
  }
  /** Unicode string: u32 count of UTF-16 code units, big endian (a trailing NUL is dropped). */
  unicode(): string {
    const n = this.u32();
    let s = "";
    for (let i = 0; i < n; i++) s += String.fromCharCode(this.u16());
    return s.endsWith("\0") ? s.slice(0, -1) : s;
  }
  /** A section length: u32, or u64 in PSB when `big`. */
  len(big = true): number { return this.psb && big ? this.u64() : this.u32(); }
  /** A sub-reader over the next n bytes (the parent skips them). */
  sub(n: number): Reader { const r = new Reader(this.bytes(n)); r.psb = this.psb; return r; }
}

const enc = new TextEncoder();

export class Writer {
  buf: Uint8Array;
  dv: DataView;
  pos = 0;
  psb = false;

  constructor(size = 1 << 16) {
    this.buf = new Uint8Array(size);
    this.dv = new DataView(this.buf.buffer);
  }

  private room(n: number): void {
    if (this.pos + n <= this.buf.byteLength) return;
    let size = this.buf.byteLength * 2;
    while (size < this.pos + n) size *= 2;
    const b = new Uint8Array(size);
    b.set(this.buf.subarray(0, this.pos));
    this.buf = b;
    this.dv = new DataView(b.buffer);
  }

  u8(v: number): void { this.room(1); this.buf[this.pos++] = v & 255; }
  u16(v: number): void { this.room(2); this.dv.setUint16(this.pos, v & 0xffff); this.pos += 2; }
  i16(v: number): void { this.room(2); this.dv.setInt16(this.pos, v); this.pos += 2; }
  u32(v: number): void { this.room(4); this.dv.setUint32(this.pos, v >>> 0); this.pos += 4; }
  i32(v: number): void { this.room(4); this.dv.setInt32(this.pos, v | 0); this.pos += 4; }
  u64(v: number): void { this.u32(Math.floor(v / 4294967296)); this.u32(v % 4294967296); }
  i64(v: bigint): void { this.room(8); this.dv.setBigInt64(this.pos, v); this.pos += 8; }
  f32(v: number): void { this.room(4); this.dv.setFloat32(this.pos, v); this.pos += 4; }
  f64(v: number): void { this.room(8); this.dv.setFloat64(this.pos, v); this.pos += 8; }
  fixed(v: number): void { this.i32(Math.round(v * 65536)); }
  bytes(b: Uint8Array): void { this.room(b.byteLength); this.buf.set(b, this.pos); this.pos += b.byteLength; }
  zeros(n: number): void { this.room(n); this.buf.fill(0, this.pos, this.pos + n); this.pos += n; }
  sig(s: string): void { for (let i = 0; i < 4; i++) this.u8(s.charCodeAt(i) || 32); }
  ascii(s: string): void { for (let i = 0; i < s.length; i++) this.u8(s.charCodeAt(i)); }
  pascal(s: string, pad = 2): void {
    const b = enc.encode(s).subarray(0, 255);
    const bytes = Array.from(b, (c) => (c < 128 ? c : 63)); // ASCII only: other characters go into luni
    this.u8(bytes.length);
    for (const c of bytes) this.u8(c);
    const total = bytes.length + 1;
    if (total % pad) this.zeros(pad - (total % pad));
  }
  unicode(s: string, nul = false): void {
    const t = nul ? s + "\0" : s;
    this.u32(t.length);
    for (let i = 0; i < t.length; i++) this.u16(t.charCodeAt(i));
  }
  /** Start a length-prefixed section; returns the mark to hand to end(). */
  begin(big = false): { at: number; big: boolean } {
    const at = this.pos;
    if (big) this.u64(0); else this.u32(0);
    return { at, big };
  }
  /** Close a section: pad its contents to a multiple of `pad` (counted in the length) and patch the length in. */
  end(m: { at: number; big: boolean }, pad = 1): void {
    const start = m.at + (m.big ? 8 : 4);
    let n = this.pos - start;
    if (pad > 1 && n % pad) { this.zeros(pad - (n % pad)); n = this.pos - start; }
    if (m.big) { this.dv.setUint32(m.at, Math.floor(n / 4294967296)); this.dv.setUint32(m.at + 4, n % 4294967296); }
    else this.dv.setUint32(m.at, n);
  }
  /** Align the write position to a multiple of n with zero bytes. */
  align(n: number, from = 0): void { const k = (this.pos - from) % n; if (k) this.zeros(n - k); }
  done(): Uint8Array { return this.buf.slice(0, this.pos); }
}

// ——— PackBits (PSD RLE, TIFF compression 32773) ———

/** PackBits-decode `src` into exactly `out.length` bytes. */
export function unpackBits(src: Uint8Array, out: Uint8Array): void {
  let i = 0, o = 0;
  const n = out.length;
  while (o < n && i < src.length) {
    const h = src[i++]!;
    if (h < 128) {
      const c = Math.min(h + 1, n - o);
      out.set(src.subarray(i, i + c), o);
      i += h + 1; o += c;
    } else if (h > 128) {
      const c = Math.min(257 - h, n - o), v = src[i++]!;
      out.fill(v, o, o + c);
      o += c;
    } else continue; // 128: no-op
  }
}

/** PackBits-encode one row. */
export function packBits(src: Uint8Array, start = 0, end = src.length, out: number[] = []): number[] {
  let i = start;
  while (i < end) {
    // a run of at least 2 equal bytes
    let run = 1;
    while (i + run < end && run < 128 && src[i + run] === src[i]) run++;
    if (run >= 2) { out.push(257 - run, src[i]!); i += run; continue; }
    // literal bytes until a run of 3 starts (a run of 2 inside literals costs as much as copying it)
    let j = i + 1;
    while (j < end && j - i < 128) {
      if (j + 2 < end && src[j] === src[j + 1] && src[j] === src[j + 2]) break;
      j++;
    }
    out.push(j - i - 1);
    for (let k = i; k < j; k++) out.push(src[k]!);
    i = j;
  }
  return out;
}
