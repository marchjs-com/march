// Tables between PSD codes and the March document model: blend mode keys (layer records and descriptors), color
// tags, lock flags, and adjustment layer keys ↔ March op type names with their parameter codecs.

import type { BlendMode } from "../doc/blend.ts";
import type { ColorTag, Locks } from "../doc/layers.ts";
import { Reader, Writer } from "./binary.ts";
import { readVersioned, writeVersioned, desc, long, bool, num, flag, obj, doub, type Descriptor } from "./descriptor.ts";

/** Layer record blend keys (4 characters each). */
export const BLEND_KEYS: Record<BlendMode | "pass-through", string> = {
  "pass-through": "pass", normal: "norm", dissolve: "diss",
  darken: "dark", multiply: "mul ", "color-burn": "idiv", "linear-burn": "lbrn", "darker-color": "dkCl",
  lighten: "lite", screen: "scrn", "color-dodge": "div ", "linear-dodge": "lddg", "lighter-color": "lgCl",
  overlay: "over", "soft-light": "sLit", "hard-light": "hLit", "vivid-light": "vLit", "linear-light": "lLit", "pin-light": "pLit", "hard-mix": "hMix",
  difference: "diff", exclusion: "smud", subtract: "fsub", divide: "fdiv",
  hue: "hue ", saturation: "sat ", color: "colr", luminosity: "lum ",
};
export const BLEND_FROM_KEY: Record<string, BlendMode | "pass-through"> = Object.fromEntries(Object.entries(BLEND_KEYS).map(([m, k]) => [k, m as BlendMode]));

/** Blend modes inside descriptors (enum type "BlnM"). */
export const BLEND_ENUMS: Record<BlendMode, string> = {
  normal: "Nrml", dissolve: "Dslv", darken: "Drkn", multiply: "Mltp", "color-burn": "CBrn", "linear-burn": "linearBurn",
  "darker-color": "darkerColor", lighten: "Lghn", screen: "Scrn", "color-dodge": "CDdg", "linear-dodge": "linearDodge",
  "lighter-color": "lighterColor", overlay: "Ovrl", "soft-light": "SftL", "hard-light": "HrdL", "vivid-light": "vividLight",
  "linear-light": "linearLight", "pin-light": "pinLight", "hard-mix": "hardMix", difference: "Dfrn", exclusion: "Xclu",
  subtract: "blendSubtraction", divide: "blendDivide", hue: "H   ", saturation: "Strt", color: "Clr ", luminosity: "Lmns",
};
export const BLEND_FROM_ENUM: Record<string, BlendMode> = Object.fromEntries(Object.entries(BLEND_ENUMS).map(([m, k]) => [k, m as BlendMode]));

/** Color tags in lclr order (matches COLOR_TAGS). */
export const COLOR_TAG_CODES: ColorTag[] = ["none", "red", "orange", "yellow", "green", "blue", "violet", "gray"];

/** lspf protection flags. */
export function locksFromFlags(f: number): Locks {
  const all = (f & 0x80000000) !== 0;
  return { transparency: all || !!(f & 1), pixels: all || !!(f & 2), position: all || !!(f & 4), artboard: all || !!(f & 8) };
}
export function locksToFlags(l: Locks): number {
  if (l.transparency && l.pixels && l.position && l.artboard) return 0x80000000;
  return (l.transparency ? 1 : 0) | (l.pixels ? 2 : 0) | (l.position ? 4 : 0) | (l.artboard ? 8 : 0);
}

// ——— adjustment layers ———

/**
 * PSD adjustment keys ↔ March op type names (march/image ops). Rename here when an op lands under another name.
 * `read` turns the block into op params (null: params not decoded, the raw block is kept and written back);
 * `write` encodes params for a new adjustment layer (absent: written only when the raw block is kept).
 */
export interface AdjustCodec { key: string; op: string; label: string; read?: (r: Reader) => Record<string, unknown>; write?: (w: Writer, p: Record<string, unknown>) => void }

const n = (p: Record<string, unknown>, k: string, d = 0): number => (typeof p[k] === "number" ? (p[k] as number) : d);

function readLevels(r: Reader): Record<string, unknown> {
  r.u16(); // version 2
  const rec = (): number[] => [r.u16(), r.u16(), r.u16(), r.u16(), r.u16() / 100];
  const master = rec(), red = rec(), green = rec(), blue = rec();
  const one = (v: number[]): Record<string, number> => ({ inBlack: v[0]! / 255, inWhite: v[1]! / 255, outBlack: v[2]! / 255, outWhite: v[3]! / 255, gamma: v[4]! });
  return { ...one(master), red: one(red), green: one(green), blue: one(blue) };
}
function writeLevels(w: Writer, p: Record<string, unknown>): void {
  w.u16(2);
  const rec = (q: Record<string, unknown>): void => {
    w.u16(Math.round(n(q, "inBlack") * 255)); w.u16(Math.round(n(q, "inWhite", 1) * 255));
    w.u16(Math.round(n(q, "outBlack") * 255)); w.u16(Math.round(n(q, "outWhite", 1) * 255)); w.u16(Math.round(n(q, "gamma", 1) * 100));
  };
  rec(p);
  for (const c of ["red", "green", "blue"]) rec((p[c] as Record<string, unknown>) ?? {});
  for (let i = 4; i < 29; i++) rec({});
}

function readCurves(r: Reader): Record<string, unknown> {
  r.u8(); r.u16(); // pad, version
  const bits = r.u32();
  const names = ["points", "red", "green", "blue"];
  const out: Record<string, unknown> = { points: [[0, 0], [1, 1]] };
  for (let c = 0; c < 32; c++) {
    if (!(bits & (1 << c))) continue;
    const count = r.u16();
    const pts: [number, number][] = [];
    for (let i = 0; i < count; i++) { const o = r.u16(), inp = r.u16(); pts.push([inp / 255, o / 255]); }
    if (names[c]) out[names[c]!] = pts;
  }
  return out;
}
function writeCurves(w: Writer, p: Record<string, unknown>): void {
  w.u8(0); w.u16(1);
  const names = ["points", "red", "green", "blue"];
  let bits = 0;
  names.forEach((k, i) => { if (Array.isArray(p[k])) bits |= 1 << i; });
  w.u32(bits);
  for (const k of names) {
    const pts = p[k] as [number, number][] | undefined;
    if (!Array.isArray(pts)) continue;
    w.u16(pts.length);
    for (const [x, y] of pts) { w.u16(Math.round(y * 255)); w.u16(Math.round(x * 255)); }
  }
}

function readHueSat(r: Reader): Record<string, unknown> {
  r.u16(); // version 2
  const colorize = !!r.u8(); r.u8();
  const ch = r.i16(), cs = r.i16(), cl = r.i16();
  const hue = r.i16(), sat = r.i16(), light = r.i16();
  return { colorize, colorizeHue: ch, colorizeSaturation: cs / 100, colorizeLightness: cl / 100, hue, saturation: sat / 100, lightness: light / 100 };
}
function writeHueSat(w: Writer, p: Record<string, unknown>): void {
  w.u16(2); w.u8(p.colorize ? 1 : 0); w.u8(0);
  w.i16(Math.round(n(p, "colorizeHue"))); w.i16(Math.round(n(p, "colorizeSaturation", 0.25) * 100)); w.i16(Math.round(n(p, "colorizeLightness") * 100));
  w.i16(Math.round(n(p, "hue"))); w.i16(Math.round(n(p, "saturation") * 100)); w.i16(Math.round(n(p, "lightness") * 100));
  // six color ranges: range values (4 × i16) then hue / saturation / lightness (3 × i16), all neutral
  const ranges = [[315, 345, 15, 45], [15, 45, 75, 105], [75, 105, 135, 165], [135, 165, 195, 225], [195, 225, 255, 285], [255, 285, 315, 345]];
  for (const rg of ranges) { for (const v of rg) w.i16(v); w.i16(0); w.i16(0); w.i16(0); }
}

function readBalance(r: Reader): Record<string, unknown> {
  const tri = (): number[] => [r.i16() / 100, r.i16() / 100, r.i16() / 100];
  const shadows = tri(), midtones = tri(), highlights = tri();
  return { shadows, midtones, highlights, preserveLuminosity: r.left > 0 ? !!r.u8() : true };
}
function writeBalance(w: Writer, p: Record<string, unknown>): void {
  for (const k of ["shadows", "midtones", "highlights"]) {
    const v = (p[k] as number[] | undefined) ?? [0, 0, 0];
    for (let i = 0; i < 3; i++) w.i16(Math.round((v[i] ?? 0) * 100));
  }
  w.u8(p.preserveLuminosity === false ? 0 : 1); w.u8(0);
}

function readSelective(r: Reader): Record<string, unknown> {
  r.u16();
  const absolute = r.u16() === 1;
  const names = ["", "reds", "yellows", "greens", "cyans", "blues", "magentas", "whites", "neutrals", "blacks"];
  const out: Record<string, unknown> = { method: absolute ? "absolute" : "relative" };
  for (const nm of names) {
    const v = [r.i16() / 100, r.i16() / 100, r.i16() / 100, r.i16() / 100];
    if (nm) out[nm] = v;
  }
  return out;
}

function readMixer(r: Reader): Record<string, unknown> {
  r.u16();
  const monochrome = !!r.u16();
  const row = (): number[] => [r.i16() / 100, r.i16() / 100, r.i16() / 100, r.i16() / 100, r.i16() / 100];
  const red = row(), green = row(), blue = row();
  return { monochrome, red, green, blue };
}

function readPhotoFilter(r: Reader): Record<string, unknown> {
  const version = r.u16();
  let color: number[] = [0, 0, 0];
  if (version === 3) { color = [r.i32() / 100, r.i32() / 100, r.i32() / 100]; } // Lab × 100
  else { r.u16(); color = [r.u16() / 65535, r.u16() / 65535, r.u16() / 65535]; r.u16(); }
  const density = r.u32() / 100;
  const preserveLuminosity = !!r.u8();
  return version === 3 ? { lab: color, density, preserveLuminosity } : { color, density, preserveLuminosity };
}

function descParams(r: Reader): Record<string, unknown> {
  const d = readVersioned(r);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(d.items)) { const v = num(d, k, NaN); out[k] = Number.isNaN(v) ? flag(d, k) : v; }
  return out;
}

export const ADJUSTMENTS: AdjustCodec[] = [
  { key: "levl", op: "levels", label: "Levels", read: readLevels, write: writeLevels },
  { key: "curv", op: "curves", label: "Curves", read: readCurves, write: writeCurves },
  {
    key: "brit", op: "brightnessContrast", label: "Brightness/Contrast",
    read: (r) => ({ brightness: r.i16() / 100, contrast: r.i16() / 100, legacy: true }),
  },
  {
    key: "CgEd", op: "brightnessContrast", label: "Brightness/Contrast",
    read: (r) => { const d = readVersioned(r); return { brightness: num(d, "Brgh") / 100, contrast: num(d, "Cntr") / 100, legacy: flag(d, "useLegacy") }; },
    write: (w, p) => writeVersioned(w, desc("null", { Vrsn: long(1), Brgh: long(n(p, "brightness") * 100), Cntr: long(n(p, "contrast") * 100), means: long(127), "Lab ": bool(false), useLegacy: bool(!!p.legacy), Auto: bool(false) })),
  },
  { key: "hue2", op: "hueSaturation", label: "Hue/Saturation", read: readHueSat, write: writeHueSat },
  { key: "blnc", op: "colorBalance", label: "Color Balance", read: readBalance, write: writeBalance },
  {
    key: "blwh", op: "blackWhite", label: "Black & White",
    read: (r) => { const d = readVersioned(r); return { reds: num(d, "Rd  ") / 100, yellows: num(d, "Yllw") / 100, greens: num(d, "Grn ") / 100, cyans: num(d, "Cyn ") / 100, blues: num(d, "Bl  ") / 100, magentas: num(d, "Mgnt") / 100, tint: flag(d, "useTint") }; },
    write: (w, p) => writeVersioned(w, desc("null", {
      "Rd  ": long(n(p, "reds", 0.4) * 100), Yllw: long(n(p, "yellows", 0.6) * 100), "Grn ": long(n(p, "greens", 0.4) * 100),
      "Cyn ": long(n(p, "cyans", 0.6) * 100), "Bl  ": long(n(p, "blues", 0.2) * 100), Mgnt: long(n(p, "magentas", 0.8) * 100),
      useTint: bool(!!p.tint), tintColor: obj("RGBC", { "Rd  ": doub(225), "Grn ": doub(211), "Bl  ": doub(179) }),
      bwPresetKind: { t: "enum", type: "bwPresetKind", v: "bwPresetKindCustom" }, blackAndWhitePresetFileName: { t: "TEXT", v: "" },
    })),
  },
  { key: "phfl", op: "photoFilter", label: "Photo Filter", read: readPhotoFilter },
  {
    key: "expA", op: "exposure", label: "Exposure",
    read: (r) => { r.u16(); const amount = r.f32(), offset = r.f32(), gamma = r.f32(); return { amount, offset, gamma }; },
    write: (w, p) => { w.u16(1); w.f32(n(p, "amount")); w.f32(n(p, "offset")); w.f32(n(p, "gamma", 1)); },
  },
  {
    key: "vibA", op: "vibrance", label: "Vibrance",
    read: (r) => { const d = readVersioned(r); return { amount: num(d, "vibrance") / 100, saturation: num(d, "Strt") / 100 }; },
    write: (w, p) => writeVersioned(w, desc("null", { vibrance: long(n(p, "amount") * 100), Strt: long(n(p, "saturation") * 100) })),
  },
  { key: "nvrt", op: "invert", label: "Invert", read: () => ({}), write: () => {} },
  { key: "post", op: "posterize", label: "Posterize", read: (r) => ({ levels: r.u16() }), write: (w, p) => { w.u16(Math.round(n(p, "levels", 4))); w.u16(0); } },
  { key: "thrs", op: "threshold", label: "Threshold", read: (r) => ({ level: r.u16() / 255 }), write: (w, p) => { w.u16(Math.round(n(p, "level", 0.5) * 255)); w.u16(0); } },
  { key: "grdm", op: "gradientMap", label: "Gradient Map" },
  { key: "selc", op: "selectiveColor", label: "Selective Color", read: readSelective },
  { key: "mixr", op: "channelMixer", label: "Channel Mixer", read: readMixer },
  { key: "clrL", op: "colorLookup", label: "Color Lookup", read: descParams },
];
export const ADJUST_BY_KEY = new Map(ADJUSTMENTS.map((a) => [a.key, a]));
/** First codec per op that can write (CgEd over the legacy brit). */
export const ADJUST_BY_OP = new Map<string, AdjustCodec>();
for (const a of ADJUSTMENTS) if (!ADJUST_BY_OP.has(a.op) || (a.write && !ADJUST_BY_OP.get(a.op)!.write)) ADJUST_BY_OP.set(a.op, a);

export type { Descriptor };
