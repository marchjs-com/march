// JSON with typed arrays (base64) for the private March block (mrCh) a PSD carries: the layer fields and document
// settings PSD has no place for, so a March → PSD → March round trip loses nothing.

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function toBase64(u: Uint8Array): string {
  let s = "";
  for (let i = 0; i < u.length; i += 3) {
    const a = u[i]!, b = u[i + 1] ?? 0, c = u[i + 2] ?? 0;
    s += B64[a >> 2]! + B64[((a & 3) << 4) | (b >> 4)]! + (i + 1 < u.length ? B64[((b & 15) << 2) | (c >> 6)]! : "=") + (i + 2 < u.length ? B64[c & 63]! : "=");
  }
  return s;
}

export function fromBase64(s: string): Uint8Array {
  const clean = s.replace(/[^A-Za-z0-9+/]/g, "");
  const out = new Uint8Array(Math.floor((clean.length * 3) / 4));
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n = (B64.indexOf(clean[i]!) << 18) | (B64.indexOf(clean[i + 1] ?? "A") << 12) | (B64.indexOf(clean[i + 2] ?? "A") << 6) | B64.indexOf(clean[i + 3] ?? "A");
    if (o < out.length) out[o++] = n >> 16;
    if (o < out.length) out[o++] = (n >> 8) & 255;
    if (o < out.length) out[o++] = n & 255;
  }
  return out;
}

const KINDS: [string, new (b: ArrayBuffer) => ArrayBufferView][] = [["u8", Uint8Array], ["u8c", Uint8ClampedArray], ["u16", Uint16Array], ["f32", Float32Array]];

/** Stringify with typed arrays kept (as { $ta, b64 }); objects with a class other than Object / Array are dropped. */
export function encodeJson(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) => {
    if (ArrayBuffer.isView(x)) {
      const kind = KINDS.find(([, C]) => x instanceof C)?.[0] ?? "u8";
      return { $ta: kind, b64: toBase64(new Uint8Array(x.buffer, x.byteOffset, x.byteLength)) };
    }
    if (typeof x === "bigint") return String(x);
    if (x && typeof x === "object" && !Array.isArray(x)) {
      const proto = Object.getPrototypeOf(x);
      if (proto !== Object.prototype && proto !== null) return undefined;
    }
    return x;
  });
}

export function decodeJson(s: string): unknown {
  return JSON.parse(s, (_k, x: unknown) => {
    if (x && typeof x === "object" && "$ta" in x && "b64" in x) {
      const o = x as { $ta: string; b64: string };
      const bytes = fromBase64(o.b64);
      const C = KINDS.find(([k]) => k === o.$ta)?.[1] ?? Uint8Array;
      const buf = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
      return new C(buf);
    }
    return x;
  });
}
