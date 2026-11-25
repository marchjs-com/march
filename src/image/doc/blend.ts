// The 27 layer blend modes and the compositing kernel. Colors are 0–1 floats; the backdrop is premultiplied, the
// source straight alpha (as stored). Formulas follow the W3C Compositing spec where it defines the mode and the
// documented image-editor behaviour otherwise (soft light, vivid / linear / pin light, hard mix, divide, subtract,
// darker / lighter color, dissolve).

/** A layer blend mode. @tr Katman karışım kipi. */
export type BlendMode =
  | "normal" | "dissolve"
  | "darken" | "multiply" | "color-burn" | "linear-burn" | "darker-color"
  | "lighten" | "screen" | "color-dodge" | "linear-dodge" | "lighter-color"
  | "overlay" | "soft-light" | "hard-light" | "vivid-light" | "linear-light" | "pin-light" | "hard-mix"
  | "difference" | "exclusion" | "subtract" | "divide"
  | "hue" | "saturation" | "color" | "luminosity";

/** Modes in menu order, with the separators between their families. */
export const BLEND_GROUPS: BlendMode[][] = [
  ["normal", "dissolve"],
  ["darken", "multiply", "color-burn", "linear-burn", "darker-color"],
  ["lighten", "screen", "color-dodge", "linear-dodge", "lighter-color"],
  ["overlay", "soft-light", "hard-light", "vivid-light", "linear-light", "pin-light", "hard-mix"],
  ["difference", "exclusion", "subtract", "divide"],
  ["hue", "saturation", "color", "luminosity"],
];
export const BLEND_MODES: BlendMode[] = BLEND_GROUPS.flat();

/** English menu labels (translated by the UI). */
export const BLEND_LABELS: Record<BlendMode, string> = {
  normal: "Normal", dissolve: "Dissolve", darken: "Darken", multiply: "Multiply", "color-burn": "Color Burn",
  "linear-burn": "Linear Burn", "darker-color": "Darker Color", lighten: "Lighten", screen: "Screen",
  "color-dodge": "Color Dodge", "linear-dodge": "Linear Dodge (Add)", "lighter-color": "Lighter Color",
  overlay: "Overlay", "soft-light": "Soft Light", "hard-light": "Hard Light", "vivid-light": "Vivid Light",
  "linear-light": "Linear Light", "pin-light": "Pin Light", "hard-mix": "Hard Mix", difference: "Difference",
  exclusion: "Exclusion", subtract: "Subtract", divide: "Divide", hue: "Hue", saturation: "Saturation",
  color: "Color", luminosity: "Luminosity",
};

/** Modes whose fill opacity mixes the blended result instead of thinning the source (the "special eight"). */
export const FILL_SPECIAL = new Set<BlendMode>(["color-burn", "linear-burn", "color-dodge", "linear-dodge", "vivid-light", "linear-light", "hard-mix", "difference"]);

const c01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

function colorDodge(b: number, s: number): number {
  if (b <= 0) return 0;
  if (s >= 1) return 1;
  return Math.min(1, b / (1 - s));
}
function colorBurn(b: number, s: number): number {
  if (b >= 1) return 1;
  if (s <= 0) return 0;
  return 1 - Math.min(1, (1 - b) / s);
}

/** Separable blend functions B(backdrop, source) per channel. */
export const SEPARABLE: Partial<Record<BlendMode, (b: number, s: number) => number>> = {
  normal: (_b, s) => s,
  dissolve: (_b, s) => s,
  darken: (b, s) => Math.min(b, s),
  multiply: (b, s) => b * s,
  "color-burn": colorBurn,
  "linear-burn": (b, s) => Math.max(0, b + s - 1),
  lighten: (b, s) => Math.max(b, s),
  screen: (b, s) => b + s - b * s,
  "color-dodge": colorDodge,
  "linear-dodge": (b, s) => Math.min(1, b + s),
  overlay: (b, s) => (b <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
  "soft-light": (b, s) => (s <= 0.5 ? b - (1 - 2 * s) * b * (1 - b) : b + (2 * s - 1) * (Math.sqrt(b) - b)),
  "hard-light": (b, s) => (s <= 0.5 ? 2 * b * s : 1 - 2 * (1 - b) * (1 - s)),
  "vivid-light": (b, s) => (s <= 0.5 ? colorBurn(b, 2 * s) : colorDodge(b, 2 * (s - 0.5))),
  "linear-light": (b, s) => c01(b + 2 * s - 1),
  "pin-light": (b, s) => (s <= 0.5 ? Math.min(b, 2 * s) : Math.max(b, 2 * s - 1)),
  "hard-mix": (b, s) => (b + s >= 1 ? 1 : 0),
  difference: (b, s) => Math.abs(b - s),
  exclusion: (b, s) => b + s - 2 * b * s,
  subtract: (b, s) => Math.max(0, b - s),
  divide: (b, s) => (s <= 0 ? (b <= 0 ? 0 : 1) : Math.min(1, b / s)),
};

// non-separable helpers (W3C)
const lum = (r: number, g: number, b: number): number => 0.3 * r + 0.59 * g + 0.11 * b;
function clipColor(c: number[]): number[] {
  const l = lum(c[0]!, c[1]!, c[2]!);
  const n = Math.min(c[0]!, c[1]!, c[2]!), x = Math.max(c[0]!, c[1]!, c[2]!);
  if (n < 0) for (let i = 0; i < 3; i++) c[i] = l + ((c[i]! - l) * l) / (l - n || 1);
  if (x > 1) for (let i = 0; i < 3; i++) c[i] = l + ((c[i]! - l) * (1 - l)) / (x - l || 1);
  return c;
}
function setLum(c: number[], l: number): number[] {
  const d = l - lum(c[0]!, c[1]!, c[2]!);
  return clipColor([c[0]! + d, c[1]! + d, c[2]! + d]);
}
const sat = (c: number[]): number => Math.max(c[0]!, c[1]!, c[2]!) - Math.min(c[0]!, c[1]!, c[2]!);
function setSat(c: number[], s: number): number[] {
  const out = [0, 0, 0];
  let mx = 0, mn = 0;
  for (let i = 1; i < 3; i++) { if (c[i]! > c[mx]!) mx = i; if (c[i]! < c[mn]!) mn = i; }
  if (mx === mn) return out;
  const md = 3 - mx - mn;
  if (c[mx]! > c[mn]!) { out[md] = ((c[md]! - c[mn]!) * s) / (c[mx]! - c[mn]!); out[mx] = s; }
  return out;
}

/** Blend one straight backdrop color with one straight source color (the B() of the compositing formula). */
export function blendColor(mode: BlendMode, b: number[], s: number[]): number[] {
  const f = SEPARABLE[mode]!;
  if (f) return [f(b[0]!, s[0]!), f(b[1]!, s[1]!), f(b[2]!, s[2]!)];
  switch (mode) {
    case "darker-color": return lum(s[0]!, s[1]!, s[2]!) < lum(b[0]!, b[1]!, b[2]!) ? s.slice(0, 3) : b.slice(0, 3);
    case "lighter-color": return lum(s[0]!, s[1]!, s[2]!) > lum(b[0]!, b[1]!, b[2]!) ? s.slice(0, 3) : b.slice(0, 3);
    case "hue": return setLum(setSat(s, sat(b)), lum(b[0]!, b[1]!, b[2]!));
    case "saturation": return setLum(setSat(b, sat(s)), lum(b[0]!, b[1]!, b[2]!));
    case "color": return setLum(s.slice(0, 3), lum(b[0]!, b[1]!, b[2]!));
    case "luminosity": return setLum(b.slice(0, 3), lum(s[0]!, s[1]!, s[2]!));
  }
  return s.slice(0, 3);
}

/** A stable per-pixel noise in [0, 1) (dissolve). */
export function hash01(x: number, y: number, seed = 0): number {
  let h = (x * 374761393 + y * 668265263 + seed * 2246822519) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

export interface BlendArgs {
  mode: BlendMode;
  /** Layer opacity 0–1. */
  opacity: number;
  /** Fill opacity 0–1 (pixels only, not styles). */
  fill?: number | undefined;
  /** Per-pixel coverage 0–1 (masks), same pixel count; null = 1. */
  mask?: Float32Array | null | undefined;
  /** Document position of pixel 0 and the row width (dissolve noise). */
  x?: number | undefined;
  y?: number | undefined;
  w?: number | undefined;
  seed?: number | undefined;
  /** Channels that receive the result (Blending Options › Channels: R, G, B). */
  channels?: [boolean, boolean, boolean] | undefined;
}

/**
 * Composite a straight-alpha source over a premultiplied backdrop in place: dst = src ⊕ dst.
 * co = αs·(1−αb)·Cs + αs·αb·B(Cb, Cs) + (1−αs)·αb·Cb, αo = αs + αb·(1−αs).
 */
export function compositeInto(dst: Float32Array, src: Float32Array, a: BlendArgs): void {
  const n = dst.length >> 2, mode = a.mode, fill = a.fill ?? 1, op = a.opacity, mask = a.mask;
  const special = FILL_SPECIAL.has(mode) && fill < 1;
  const sepF = SEPARABLE[mode]!;
  const w = a.w ?? 1, x0 = a.x ?? 0, y0 = a.y ?? 0, seed = a.seed ?? 0;
  const ch = a.channels;
  const bc = [0, 0, 0], sc = [0, 0, 0];
  for (let p = 0; p < n; p++) {
    const i = p << 2;
    let as = src[i + 3]! * op * (special ? 1 : fill);
    if (mask) as *= mask[p]!;
    if (as <= 0) continue;
    if (mode === "dissolve") {
      as = hash01(x0 + (p % w), y0 + ((p / w) | 0), seed) < as ? 1 : 0;
      if (!as) continue;
    }
    const ab = dst[i + 3]!;
    const ia = ab > 0 ? 1 / ab : 0;
    const br = dst[i]! * ia, bg = dst[i + 1]! * ia, bb = dst[i + 2]! * ia;
    const sr = src[i]!, sg = src[i + 1]!, sb = src[i + 2]!;
    let xr: number, xg: number, xb: number;
    if (ab <= 0) { xr = sr; xg = sg; xb = sb; }
    else if (sepF) { xr = sepF(br, sr); xg = sepF(bg, sg); xb = sepF(bb, sb); }
    else {
      bc[0] = br; bc[1] = bg; bc[2] = bb; sc[0] = sr; sc[1] = sg; sc[2] = sb;
      const r = blendColor(mode, bc, sc);
      xr = r[0]!; xg = r[1]!; xb = r[2]!;
    }
    const ao = as + ab * (1 - as);
    let or = as * (1 - ab) * sr + as * ab * xr + (1 - as) * ab * br;
    let og = as * (1 - ab) * sg + as * ab * xg + (1 - as) * ab * bg;
    let ob = as * (1 - ab) * sb + as * ab * xb + (1 - as) * ab * bb;
    let oa = ao;
    if (special) {
      // fill mixes the blended result with the backdrop
      or = dst[i]! + (or - dst[i]!) * fill; og = dst[i + 1]! + (og - dst[i + 1]!) * fill;
      ob = dst[i + 2]! + (ob - dst[i + 2]!) * fill; oa = ab + (ao - ab) * fill;
    }
    if (ch) {
      // a closed channel keeps the backdrop's color (at the new coverage)
      if (!ch[0]!) or = br * oa;
      if (!ch[1]!) og = bg * oa;
      if (!ch[2]!) ob = bb * oa;
    }
    dst[i] = or; dst[i + 1] = og; dst[i + 2] = ob; dst[i + 3] = oa;
  }
}

/** Premultiply straight RGBA in place. */
export function premultiply(px: Float32Array): Float32Array {
  for (let i = 0; i < px.length; i += 4) { const a = px[i + 3]!; px[i]! *= a; px[i + 1]! *= a; px[i + 2]! *= a; }
  return px;
}
/** Straight from premultiplied RGBA in place. */
export function unpremultiply(px: Float32Array): Float32Array {
  for (let i = 0; i < px.length; i += 4) {
    const a = px[i + 3]!;
    if (a > 0) { const k = 1 / a; px[i]! *= k; px[i + 1]! *= k; px[i + 2]! *= k; } else { px[i] = px[i + 1] = px[i + 2] = 0; }
  }
  return px;
}
