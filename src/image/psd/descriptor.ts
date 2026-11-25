// Action descriptors (the OSType-typed key/value structures PSD files use for text, layer styles, fills, smart
// objects, artboards and layer comps): a lossless parser and writer, plus small helpers to build and read them.
// Values keep their OSType so a descriptor written back is byte-compatible with the one read.

import { Reader, Writer } from "./binary.ts";

export type DItem =
  | { t: "doub"; v: number }
  | { t: "long"; v: number }
  | { t: "comp"; v: bigint }
  | { t: "bool"; v: boolean }
  | { t: "TEXT"; v: string }
  | { t: "enum"; type: string; v: string }
  | { t: "UntF"; unit: string; v: number }
  | { t: "UnFl"; unit: string; v: number[] }
  | { t: "Objc" | "GlbO"; v: Descriptor }
  | { t: "VlLs"; v: DItem[] }
  | { t: "type" | "GlbC"; name: string; classId: string }
  | { t: "tdta" | "alis" | "Pth "; v: Uint8Array }
  | { t: "obj "; v: RefItem[] }
  | { t: "ObAr"; v: Descriptor; count: number };

export type RefItem =
  | { t: "prop"; name: string; classId: string; key: string }
  | { t: "Clss"; name: string; classId: string }
  | { t: "Enmr"; name: string; classId: string; type: string; v: string }
  | { t: "rele"; name: string; classId: string; v: number }
  | { t: "Idnt" | "indx"; v: number }
  | { t: "name"; name: string; classId: string; v: string };

export interface Descriptor { name: string; classId: string; items: Record<string, DItem> }

// ——— reading ———

/** A key or class id: u32 length, 0 meaning a 4-byte code follows. */
function readId(r: Reader): string {
  const n = r.u32();
  return r.ascii(n || 4);
}

export function readDescriptor(r: Reader): Descriptor {
  const name = r.unicode();
  const classId = readId(r);
  const count = r.u32();
  const items: Record<string, DItem> = {};
  for (let i = 0; i < count; i++) {
    const key = readId(r);
    items[key] = readItem(r, r.sig());
  }
  return { name, classId, items };
}

function readItem(r: Reader, type: string): DItem {
  switch (type) {
    case "doub": return { t: "doub", v: r.f64() };
    case "long": return { t: "long", v: r.i32() };
    case "comp": return { t: "comp", v: r.i64() };
    case "bool": return { t: "bool", v: !!r.u8() };
    case "TEXT": return { t: "TEXT", v: r.unicode() };
    case "enum": { const et = readId(r); return { t: "enum", type: et, v: readId(r) }; }
    case "UntF": { const unit = r.sig(); return { t: "UntF", unit, v: r.f64() }; }
    case "UnFl": { const unit = r.sig(); const n = r.u32(); const v: number[] = []; for (let i = 0; i < n; i++) v.push(r.f64()); return { t: "UnFl", unit, v }; }
    case "Objc": case "GlbO": return { t: type, v: readDescriptor(r) };
    case "VlLs": { const n = r.u32(); const v: DItem[] = []; for (let i = 0; i < n; i++) v.push(readItem(r, r.sig())); return { t: "VlLs", v }; }
    case "type": case "GlbC": { const name = r.unicode(); return { t: type, name, classId: readId(r) }; }
    case "tdta": case "alis": case "Pth ": { const n = r.u32(); return { t: type, v: r.bytes(n).slice() }; }
    case "obj ": {
      const n = r.u32();
      const v: RefItem[] = [];
      for (let i = 0; i < n; i++) {
        const rt = r.sig();
        if (rt === "Idnt" || rt === "indx") { v.push({ t: rt, v: r.i32() }); continue; }
        const name = r.unicode(), classId = readId(r);
        if (rt === "prop") v.push({ t: "prop", name, classId, key: readId(r) });
        else if (rt === "Clss") v.push({ t: "Clss", name, classId });
        else if (rt === "Enmr") { const et = readId(r); v.push({ t: "Enmr", name, classId, type: et, v: readId(r) }); }
        else if (rt === "rele") v.push({ t: "rele", name, classId, v: r.i32() });
        else if (rt === "name") v.push({ t: "name", name, classId, v: r.unicode() });
        else throw new Error(`PSD descriptor: unknown reference type ${rt}`);
      }
      return { t: "obj ", v };
    }
    case "ObAr": {
      // object array: a count, then a descriptor whose items are UnFl lists (one value per object)
      const count = r.u32();
      const d = readDescriptor(r);
      return { t: "ObAr", v: d, count };
    }
    default: throw new Error(`PSD descriptor: unknown item type "${type}"`);
  }
}

// ——— writing ———

function writeId(w: Writer, id: string): void {
  if (id.length === 4) { w.u32(0); w.ascii(id); }
  else { w.u32(id.length); w.ascii(id); }
}

export function writeDescriptor(w: Writer, d: Descriptor): void {
  w.unicode(d.name, true);
  writeId(w, d.classId);
  const keys = Object.keys(d.items);
  w.u32(keys.length);
  for (const k of keys) {
    writeId(w, k);
    writeItem(w, d.items[k]!);
  }
}

function writeItem(w: Writer, it: DItem): void {
  w.sig(it.t);
  switch (it.t) {
    case "doub": w.f64(it.v); break;
    case "long": w.i32(it.v); break;
    case "comp": w.i64(it.v); break;
    case "bool": w.u8(it.v ? 1 : 0); break;
    case "TEXT": w.unicode(it.v, true); break;
    case "enum": writeId(w, it.type); writeId(w, it.v); break;
    case "UntF": w.sig(it.unit); w.f64(it.v); break;
    case "UnFl": w.sig(it.unit); w.u32(it.v.length); for (const x of it.v) w.f64(x); break;
    case "Objc": case "GlbO": writeDescriptor(w, it.v); break;
    case "VlLs": w.u32(it.v.length); for (const x of it.v) writeItem(w, x); break;
    case "type": case "GlbC": w.unicode(it.name, true); writeId(w, it.classId); break;
    case "tdta": case "alis": case "Pth ": w.u32(it.v.byteLength); w.bytes(it.v); break;
    case "obj ":
      w.u32(it.v.length);
      for (const ref of it.v) {
        w.sig(ref.t);
        if (ref.t === "Idnt" || ref.t === "indx") { w.i32(ref.v); continue; }
        const named = ref as Exclude<RefItem, { t: "Idnt" | "indx" }>;
        w.unicode(named.name, true); writeId(w, named.classId);
        if (ref.t === "prop") writeId(w, ref.key);
        else if (ref.t === "Enmr") { writeId(w, ref.type); writeId(w, ref.v); }
        else if (ref.t === "rele") w.i32(ref.v);
        else if (ref.t === "name") w.unicode(ref.v, true);
      }
      break;
    case "ObAr": w.u32(it.count); writeDescriptor(w, it.v); break;
  }
}

/** A versioned descriptor (u32 version 16, then the descriptor), as most tagged blocks store it. */
export function readVersioned(r: Reader): Descriptor {
  const v = r.u32();
  if (v !== 16) throw new Error(`PSD descriptor: unsupported version ${v}`);
  return readDescriptor(r);
}
export function writeVersioned(w: Writer, d: Descriptor): void {
  w.u32(16);
  writeDescriptor(w, d);
}

// ——— building ———

export const desc = (classId: string, items: Record<string, DItem>, name = ""): Descriptor => ({ name, classId, items });
export const doub = (v: number): DItem => ({ t: "doub", v });
export const long = (v: number): DItem => ({ t: "long", v: Math.round(v) });
export const bool = (v: boolean): DItem => ({ t: "bool", v });
export const text = (v: string): DItem => ({ t: "TEXT", v });
export const enm = (type: string, v: string): DItem => ({ t: "enum", type, v });
export const unit = (u: string, v: number): DItem => ({ t: "UntF", unit: u, v });
export const obj = (classId: string, items: Record<string, DItem>): DItem => ({ t: "Objc", v: desc(classId, items) });
export const list = (v: DItem[]): DItem => ({ t: "VlLs", v });

// ——— reading values ———

export function num(d: Descriptor | undefined, key: string, def = 0): number {
  const it = d?.items[key];
  if (!it) return def;
  if (it.t === "doub" || it.t === "long" || it.t === "UntF") return it.v;
  if (it.t === "comp") return Number(it.v);
  return def;
}
export function flag(d: Descriptor | undefined, key: string, def = false): boolean {
  const it = d?.items[key];
  return it && it.t === "bool" ? it.v : def;
}
export function str(d: Descriptor | undefined, key: string, def = ""): string {
  const it = d?.items[key];
  return it && it.t === "TEXT" ? it.v : def;
}
export function en(d: Descriptor | undefined, key: string, def = ""): string {
  const it = d?.items[key];
  return it && it.t === "enum" ? it.v : def;
}
export function sub(d: Descriptor | undefined, key: string): Descriptor | undefined {
  const it = d?.items[key];
  return it && (it.t === "Objc" || it.t === "GlbO") ? it.v : undefined;
}
export function items(d: Descriptor | undefined, key: string): DItem[] {
  const it = d?.items[key];
  return it && it.t === "VlLs" ? it.v : [];
}
export function unitOf(d: Descriptor | undefined, key: string): string | null {
  const it = d?.items[key];
  return it && it.t === "UntF" ? it.unit : null;
}

/** Descriptor → plain JSON-safe value (bigint as string, bytes kept): for layer.data and debugging. */
export function plain(it: DItem | Descriptor): unknown {
  if ("items" in it) {
    const o: Record<string, unknown> = { _class: it.classId };
    if (it.name) o._name = it.name;
    for (const [k, v] of Object.entries(it.items)) o[k] = plain(v);
    return o;
  }
  switch (it.t) {
    case "Objc": case "GlbO": return plain(it.v);
    case "VlLs": return it.v.map(plain);
    case "enum": return `${it.type}.${it.v}`;
    case "UntF": return { unit: it.unit, value: it.v };
    case "comp": return String(it.v);
    case "type": case "GlbC": return { class: it.classId };
    case "obj ": case "ObAr": case "UnFl": return it.t;
    default: return it.v;
  }
}
