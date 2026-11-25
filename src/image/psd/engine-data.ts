// EngineData: the PostScript-like dictionary text layers keep their text engine state in
// (<< /Key value >>, [ arrays ], /Names, numbers, true / false, (strings) in UTF-16BE with a BOM). A small tokenizer and
// parser to plain values, and a writer back to bytes.

export type EValue = number | boolean | string | EName | EValue[] | { [k: string]: EValue };
/** A /Name value (kept apart from strings so it is written back as a name). */
export interface EName { name: string }

const isWs = (c: number): boolean => c === 32 || c === 9 || c === 10 || c === 13 || c === 0;
const isDelim = (c: number): boolean => isWs(c) || c === 0x2f || c === 0x28 || c === 0x5b || c === 0x5d || c === 0x3c || c === 0x3e;

/** Parse EngineData bytes into a dictionary. */
export function parseEngineData(u: Uint8Array): { [k: string]: EValue } {
  let i = 0;
  const n = u.length;
  const skipWs = (): void => { while (i < n && isWs(u[i]!)) i++; };
  const word = (): string => { const s = i; while (i < n && !isDelim(u[i]!)) i++; return String.fromCharCode(...u.subarray(s, i)); };
  const string = (): string => {
    i++; // (
    const bytes: number[] = [];
    while (i < n && u[i] !== 0x29) {
      let c = u[i++]!;
      if (c === 0x5c && i < n) {
        c = u[i++]!;
        if (c === 0x6e) c = 10; else if (c === 0x72) c = 13; else if (c === 0x74) c = 9;
      }
      bytes.push(c);
    }
    i++; // )
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      let s = "";
      for (let k = 2; k + 1 < bytes.length; k += 2) s += String.fromCharCode((bytes[k]! << 8) | bytes[k + 1]!);
      return s;
    }
    return String.fromCharCode(...bytes);
  };
  const value = (): EValue => {
    skipWs();
    const c = u[i]!;
    if (c === 0x3c && u[i + 1] === 0x3c) { i += 2; return dict(); }
    if (c === 0x5b) {
      i++;
      const arr: EValue[] = [];
      for (;;) { skipWs(); if (i >= n || u[i] === 0x5d) { i++; return arr; } arr.push(value()); }
    }
    if (c === 0x28) return string();
    if (c === 0x2f) { i++; return { name: word() }; }
    const w = word();
    if (w === "true") return true;
    if (w === "false") return false;
    const f = Number(w);
    if (!w) { i++; return 0; }
    return Number.isNaN(f) ? w : f;
  };
  const dict = (): { [k: string]: EValue } => {
    const o: { [k: string]: EValue } = {};
    for (;;) {
      skipWs();
      if (i >= n) return o;
      if (u[i] === 0x3e && u[i + 1] === 0x3e) { i += 2; return o; }
      if (u[i] !== 0x2f) { i++; continue; }
      i++;
      const k = word();
      o[k] = value();
    }
  };
  skipWs();
  if (u[i] === 0x3c && u[i + 1] === 0x3c) { i += 2; return dict(); }
  return dict();
}

/** Write a dictionary as EngineData bytes (strings in UTF-16BE with a BOM, like the text engine writes them). */
export function writeEngineData(d: { [k: string]: EValue }): Uint8Array {
  const out: number[] = [];
  const ascii = (s: string): void => { for (let k = 0; k < s.length; k++) out.push(s.charCodeAt(k) & 255); };
  const num = (v: number): string => {
    if (Number.isInteger(v)) return String(v);
    let s = v.toFixed(5).replace(/0+$/, "");
    if (s.startsWith("0.")) s = s.slice(1);
    else if (s.startsWith("-0.")) s = "-" + s.slice(2);
    return s;
  };
  const value = (v: EValue, indent: string): void => {
    if (typeof v === "number") ascii(num(v));
    else if (typeof v === "boolean") ascii(v ? "true" : "false");
    else if (typeof v === "string") {
      out.push(0x28, 0xfe, 0xff);
      for (let k = 0; k < v.length; k++) {
        const c = v.charCodeAt(k);
        for (const b of [c >> 8, c & 255]) { if (b === 0x28 || b === 0x29 || b === 0x5c) out.push(0x5c); out.push(b); }
      }
      out.push(0x29);
    } else if (Array.isArray(v)) {
      ascii("[");
      for (const x of v) { ascii(" "); value(x, indent); }
      ascii(" ]");
    } else if ("name" in v && typeof (v as EName).name === "string" && Object.keys(v).length === 1) ascii("/" + (v as EName).name);
    else dict(v as { [k: string]: EValue }, indent + "\t");
  };
  const dict = (o: { [k: string]: EValue }, indent: string): void => {
    ascii("<<\n");
    for (const [k, v] of Object.entries(o)) {
      ascii(`${indent}/${k} `);
      value(v, indent);
      ascii("\n");
    }
    ascii(indent.slice(1) + ">>");
  };
  ascii("\n\n");
  dict(d, "\t");
  ascii("\n");
  return new Uint8Array(out);
}
