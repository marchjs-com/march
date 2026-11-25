// Color profiles as matrices + tone curves (no ICC engine): sRGB, Display P3, Adobe RGB (1998), ProPhoto RGB,
// Rec. 2020 and gray profiles (gamma 2.2 / 1.8, a 20 % dot gain curve as an approximation). Conversions go through
// XYZ with Bradford chromatic adaptation (PCS = D50, like ICC). Rendering intents: relative colorimetric (gamut clip
// toward gray at the same luminance), perceptual (soft compression of chroma near and beyond the gamut edge),
// saturation (per-channel clip, keeps saturation) and absolute colorimetric (no white point adaptation).

export type Vec3 = [number, number, number];
/** Row-major 3×3 matrix. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** Rendering intent. @tr Dönüştürme amacı. */
export type Intent = "perceptual" | "relative" | "saturation" | "absolute";
export const INTENTS: { value: Intent; label: string }[] = [
  { value: "perceptual", label: "Perceptual" }, { value: "relative", label: "Relative Colorimetric" },
  { value: "saturation", label: "Saturation" }, { value: "absolute", label: "Absolute Colorimetric" },
];

/** A tone reproduction curve: encoded value ↔ linear light. */
export type Trc =
  | { type: "srgb" }
  | { type: "gamma"; gamma: number }
  | { type: "rec2020" }
  | { type: "prophoto" }
  | { type: "dotgain"; gain: number };

export interface Profile {
  name: string;
  /** Other names the profile is known by (document metadata, file profiles). */
  aliases: string[];
  kind: "rgb" | "gray";
  /** Media white point (XYZ, Y = 1). */
  white: Vec3;
  /** Linear RGB → XYZ (relative to the profile's white); gray profiles: unused (identity). */
  toXYZ: Mat3;
  fromXYZ: Mat3;
  trc: Trc;
}

export const D50: Vec3 = [0.9642, 1, 0.8249];
export const D65: Vec3 = [0.95047, 1, 1.08883];

export function mul3(m: Mat3, v: Vec3): Vec3 {
  return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
}
export function matMul(a: Mat3, b: Mat3): Mat3 {
  const r = new Array<number>(9);
  for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3]! * b[j]! + a[i * 3 + 1]! * b[3 + j]! + a[i * 3 + 2]! * b[6 + j]!;
  return r as Mat3;
}
export function invert3(m: Mat3): Mat3 {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h, B = -(d * i - f * g), C = d * h - e * g;
  const det = a * A + b * B + c * C;
  const k = 1 / det;
  return [A * k, -(b * i - c * h) * k, (b * f - c * e) * k, B * k, (a * i - c * g) * k, -(a * f - c * d) * k, C * k, -(a * h - b * g) * k, (a * e - b * d) * k];
}
export const IDENTITY: Mat3 = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** RGB → XYZ matrix from xy primaries and a white point. */
export function primariesMatrix(r: [number, number], g: [number, number], b: [number, number], white: Vec3): Mat3 {
  const col = (p: [number, number]): Vec3 => [p[0] / p[1], 1, (1 - p[0] - p[1]) / p[1]];
  const R = col(r), G = col(g), B = col(b);
  const m: Mat3 = [R[0], G[0], B[0], R[1], G[1], B[1], R[2], G[2], B[2]];
  const s = mul3(invert3(m), white);
  return [m[0] * s[0], m[1] * s[1], m[2] * s[2], m[3] * s[0], m[4] * s[1], m[5] * s[2], m[6] * s[0], m[7] * s[1], m[8] * s[2]];
}

const BRADFORD: Mat3 = [0.8951, 0.2664, -0.1614, -0.7502, 1.7135, 0.0367, 0.0389, -0.0685, 1.0296];
const BRADFORD_INV = invert3(BRADFORD);
/** Bradford chromatic adaptation matrix from one white point to another. */
export function bradford(from: Vec3, to: Vec3): Mat3 {
  const s = mul3(BRADFORD, from), d = mul3(BRADFORD, to);
  const diag: Mat3 = [d[0] / s[0], 0, 0, 0, d[1] / s[1], 0, 0, 0, d[2] / s[2]];
  return matMul(BRADFORD_INV, matMul(diag, BRADFORD));
}

// ——— tone curves ———

/** Encoded (0–1) → linear light. Values outside 0–1 are extended symmetrically (unbounded floats). */
export function decode(t: Trc, v: number): number {
  const s = v < 0 ? -1 : 1, a = Math.abs(v);
  let r: number;
  switch (t.type) {
    case "srgb": r = a <= 0.04045 ? a / 12.92 : Math.pow((a + 0.055) / 1.055, 2.4); break;
    case "gamma": r = Math.pow(a, t.gamma); break;
    case "rec2020": r = a < 0.08124794403514049 ? a / 4.5 : Math.pow((a + 0.09929682680944) / 1.09929682680944, 1 / 0.45); break;
    case "prophoto": r = a < 16 / 512 ? a / 16 : Math.pow(a, 1.8); break;
    case "dotgain": {
      // value = 1 − ink; the press spreads the dot: k' = k + 4·gain·k(1−k); reflectance ≈ 1 − k'
      const k = 1 - Math.min(1, a), kk = Math.min(1, k + 4 * t.gain * k * (1 - k));
      r = 1 - kk;
      break;
    }
  }
  return s * r;
}

/** Linear light → encoded (0–1). */
export function encode(t: Trc, v: number): number {
  const s = v < 0 ? -1 : 1, a = Math.abs(v);
  let r: number;
  switch (t.type) {
    case "srgb": r = a <= 0.0031308 ? a * 12.92 : 1.055 * Math.pow(a, 1 / 2.4) - 0.055; break;
    case "gamma": r = Math.pow(a, 1 / t.gamma); break;
    case "rec2020": r = a < 0.018053968510807 ? a * 4.5 : 1.09929682680944 * Math.pow(a, 0.45) - 0.09929682680944; break;
    case "prophoto": r = a < 1 / 512 ? a * 16 : Math.pow(a, 1 / 1.8); break;
    case "dotgain": {
      // invert k' = k + 4g·k(1−k) for k (quadratic), value = 1 − k
      const kk = 1 - Math.min(1, a), g4 = 4 * t.gain;
      const k = g4 < 1e-9 ? kk : (1 + g4 - Math.sqrt((1 + g4) * (1 + g4) - 4 * g4 * kk)) / (2 * g4);
      r = 1 - k;
      break;
    }
  }
  return s * r;
}

// ——— the built-in profiles ———

function rgbProfile(name: string, aliases: string[], r: [number, number], g: [number, number], b: [number, number], white: Vec3, trc: Trc): Profile {
  const toXYZ = primariesMatrix(r, g, b, white);
  return { name, aliases, kind: "rgb", white, toXYZ, fromXYZ: invert3(toXYZ), trc };
}
function grayProfile(name: string, aliases: string[], trc: Trc): Profile {
  return { name, aliases, kind: "gray", white: D50, toXYZ: IDENTITY, fromXYZ: IDENTITY, trc };
}

export const SRGB = rgbProfile("sRGB IEC61966-2.1", ["sRGB", "srgb"], [0.64, 0.33], [0.3, 0.6], [0.15, 0.06], D65, { type: "srgb" });
export const DISPLAY_P3 = rgbProfile("Display P3", ["P3", "display-p3"], [0.68, 0.32], [0.265, 0.69], [0.15, 0.06], D65, { type: "srgb" });
export const ADOBE_RGB = rgbProfile("Adobe RGB (1998)", ["Adobe RGB", "a98-rgb"], [0.64, 0.33], [0.21, 0.71], [0.15, 0.06], D65, { type: "gamma", gamma: 563 / 256 });
export const PROPHOTO_RGB = rgbProfile("ProPhoto RGB", ["ROMM RGB", "prophoto-rgb"], [0.7347, 0.2653], [0.1596, 0.8404], [0.0366, 0.0001], D50, { type: "prophoto" });
export const REC2020 = rgbProfile("Rec. 2020", ["ITU-R BT.2020", "rec2020"], [0.708, 0.292], [0.17, 0.797], [0.131, 0.046], D65, { type: "rec2020" });
export const GRAY_22 = grayProfile("Gray Gamma 2.2", ["gray"], { type: "gamma", gamma: 2.2 });
export const GRAY_18 = grayProfile("Gray Gamma 1.8", [], { type: "gamma", gamma: 1.8 });
export const DOT_GAIN_20 = grayProfile("Dot Gain 20%", ["Dot Gain 20 %"], { type: "dotgain", gain: 0.2 });

export const PROFILES: Profile[] = [SRGB, DISPLAY_P3, ADOBE_RGB, PROPHOTO_RGB, REC2020, GRAY_22, GRAY_18, DOT_GAIN_20];
const extra = new Map<string, Profile>();

/** Add a profile (e.g. one parsed from a file's matrix/TRC tags). */
export function registerProfile(p: Profile): void { extra.set(p.name.toLowerCase(), p); }

/** A profile by name or alias (case-insensitive); unknown names fall back to sRGB. */
export function getProfile(name: string | null | undefined): Profile {
  if (!name) return SRGB;
  const k = name.toLowerCase();
  const e = extra.get(k);
  if (e) return e;
  for (const p of PROFILES) if (p.name.toLowerCase() === k || p.aliases.some((a) => a.toLowerCase() === k)) return p;
  return SRGB;
}
/** True when the name or alias is a known profile. */
export const hasProfile = (name: string): boolean => extra.has(name.toLowerCase()) || PROFILES.some((p) => p.name.toLowerCase() === name.toLowerCase() || p.aliases.some((a) => a.toLowerCase() === name.toLowerCase()));

// ——— conversions ———

/** Linear values of a pixel in its profile → XYZ in the profile's white (gray: Y only, scaled to the white). */
function linToXYZ(p: Profile, l: Vec3): Vec3 {
  if (p.kind === "gray") return [p.white[0] * l[0], p.white[1] * l[0], p.white[2] * l[0]];
  return mul3(p.toXYZ, l);
}

/** A color in a profile (encoded 0–1) → XYZ D50 (the PCS). */
export function toPCS(p: Profile, c: ArrayLike<number>): Vec3 {
  const l: Vec3 = p.kind === "gray" ? [decode(p.trc, c[0]!), 0, 0] : [decode(p.trc, c[0]!), decode(p.trc, c[1]!), decode(p.trc, c[2]!)];
  const xyz = linToXYZ(p, l);
  return mul3(bradford(p.white, D50), xyz);
}

/** Bring linear values inside 0–1 with an intent. Mutates and returns `l`. */
export function gamutMap(l: Vec3, intent: Intent, lum: Vec3 = [0.2126, 0.7152, 0.0722]): Vec3 {
  if (intent === "saturation") {
    for (let i = 0; i < 3; i++) l[i] = l[i]! < 0 ? 0 : l[i]! > 1 ? 1 : l[i]!;
    return l;
  }
  let Y = lum[0] * l[0] + lum[1] * l[1] + lum[2] * l[2];
  Y = Y < 0 ? 0 : Y > 1 ? 1 : Y;
  // r = how far toward the gamut edge the color is along the line from gray (Y) through it (1 = on the edge)
  let tmax = Infinity;
  for (let i = 0; i < 3; i++) {
    const d = l[i]! - Y;
    if (d > 1e-12) tmax = Math.min(tmax, (1 - Y) / d);
    else if (d < -1e-12) tmax = Math.min(tmax, -Y / d);
  }
  if (!Number.isFinite(tmax)) { l[0] = l[1] = l[2] = Y; return l; }
  const r = 1 / tmax;
  let scale = 1;
  if (intent === "perceptual") {
    const knee = 0.8;
    if (r > knee) scale = (knee + (1 - knee) * Math.tanh((r - knee) / (1 - knee))) / r;
  } else if (r > 1) scale = 1 / r;
  if (scale !== 1) for (let i = 0; i < 3; i++) l[i] = Y + (l[i]! - Y) * scale;
  for (let i = 0; i < 3; i++) l[i] = l[i]! < 0 ? 0 : l[i]! > 1 ? 1 : l[i]!;
  return l;
}

/** XYZ D50 → a color in a profile (encoded 0–1), gamut mapped with `intent`. */
export function fromPCS(p: Profile, xyz: Vec3, intent: Intent = "relative"): Vec3 {
  const x = mul3(bradford(D50, p.white), xyz);
  if (p.kind === "gray") { const v = encode(p.trc, Math.max(0, Math.min(1, x[1] / p.white[1]))); return [v, v, v]; }
  const l = gamutMap(mul3(p.fromXYZ, x), intent, [p.toXYZ[3], p.toXYZ[4], p.toXYZ[5]]);
  return [encode(p.trc, l[0]), encode(p.trc, l[1]), encode(p.trc, l[2])];
}

/** A fast converter between two profiles: works on straight RGBA floats in place (alpha untouched). */
export interface Converter {
  /** Convert one color (encoded 0–1). */
  color(c: ArrayLike<number>): Vec3;
  /** Convert straight RGBA floats in place. */
  pixels(px: Float32Array): Float32Array;
  /** Without gamut mapping (raw linear values may leave 0–1): for gamut checks. */
  raw(c: ArrayLike<number>): Vec3;
}

export function converter(src: Profile | string, dst: Profile | string, intent: Intent = "relative"): Converter {
  const s = typeof src === "string" ? getProfile(src) : src, d = typeof dst === "string" ? getProfile(dst) : dst;
  // linear src → XYZ (src white) → [adapt] → XYZ (dst white) → linear dst
  const adapt = intent === "absolute" ? IDENTITY : bradford(s.white, d.white);
  const sGray = s.kind === "gray", dGray = d.kind === "gray";
  const dLum: Vec3 = dGray ? [1 / 3, 1 / 3, 1 / 3] : [d.toXYZ[3], d.toXYZ[4], d.toXYZ[5]];
  // one matrix from linear source to linear destination (gray: from the gray's white / to luminance)
  let M: Mat3;
  if (sGray && dGray) M = [1, 0, 0, 1, 0, 0, 1, 0, 0];
  else if (sGray) { const w = mul3(d.fromXYZ, mul3(adapt, s.white)); M = [w[0], 0, 0, w[1], 0, 0, w[2], 0, 0]; }
  else if (dGray) { const a = matMul(adapt, s.toXYZ), k = 1 / d.white[1]; M = [a[3] * k, a[4] * k, a[5] * k, a[3] * k, a[4] * k, a[5] * k, a[3] * k, a[4] * k, a[5] * k]; }
  else M = matMul(d.fromXYZ, matMul(adapt, s.toXYZ));
  const same = s === d, st = s.trc, dt = d.trc;
  const lin: Vec3 = [0, 0, 0];
  const toLin = (r: number, g: number, b: number): Vec3 => {
    const a = decode(st, r), bb = sGray ? 0 : decode(st, g), c = sGray ? 0 : decode(st, b);
    lin[0] = M[0] * a + M[1] * bb + M[2] * c; lin[1] = M[3] * a + M[4] * bb + M[5] * c; lin[2] = M[6] * a + M[7] * bb + M[8] * c;
    return lin;
  };
  return {
    color(c) {
      if (same) return [c[0]!, c[1]!, c[2]!];
      const l = gamutMap(toLin(c[0]!, c[1]!, c[2]!), intent, dLum);
      return [encode(dt, l[0]), encode(dt, l[1]), encode(dt, l[2])];
    },
    raw(c) { const l = toLin(c[0]!, c[1]!, c[2]!); return [encode(dt, l[0]), encode(dt, l[1]), encode(dt, l[2])]; },
    pixels(px) {
      if (same) return px;
      for (let i = 0; i < px.length; i += 4) {
        if (px[i + 3]! <= 0) continue;
        const l = gamutMap(toLin(px[i]!, px[i + 1]!, px[i + 2]!), intent, dLum);
        px[i] = encode(dt, l[0]); px[i + 1] = encode(dt, l[1]); px[i + 2] = encode(dt, l[2]);
      }
      return px;
    },
  };
}

/** Convert one color between profiles. */
export const convertColor = (c: ArrayLike<number>, src: string | Profile, dst: string | Profile, intent: Intent = "relative"): Vec3 => converter(src, dst, intent).color(c);
