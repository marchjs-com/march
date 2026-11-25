// Color picker conversions: RGB ↔ HSB ↔ HSL ↔ Lab (D50, through the document profile) ↔ CMYK (the proof model) ↔ hex,
// nearest web-safe color and color differences. RGB values are 0–1 floats in the given profile (sRGB by default).

import { D50, fromPCS, getProfile, toPCS, type Intent, type Profile, type Vec3 } from "./profiles.ts";

/** H 0–360, S and B 0–1. */
export function rgbToHsb(r: number, g: number, b: number): Vec3 {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, mx > 0 ? d / mx : 0, mx];
}
export function hsbToRgb(h: number, s: number, v: number): Vec3 {
  h = (((h % 360) + 360) % 360) / 60;
  const i = Math.floor(h), f = h - i, p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
  switch (i) {
    case 0: return [v, t, p];
    case 1: return [q, v, p];
    case 2: return [p, v, t];
    case 3: return [p, q, v];
    case 4: return [t, p, v];
    default: return [v, p, q];
  }
}
/** H 0–360, S and L 0–1. */
export function rgbToHsl(r: number, g: number, b: number): Vec3 {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = (mx + mn) / 2, d = mx - mn;
  if (d === 0) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  return [rgbToHsb(r, g, b)[0], s, l];
}
export function hslToRgb(h: number, s: number, l: number): Vec3 {
  const v = l + s * Math.min(l, 1 - l);
  return hsbToRgb(h, v === 0 ? 0 : 2 * (1 - l / v), v);
}

// ——— Lab (D50) ———

const EPS = 216 / 24389, KAPPA = 24389 / 27;
export function xyzToLab(x: number, y: number, z: number, white: Vec3 = D50): Vec3 {
  const f = (t: number): number => (t > EPS ? Math.cbrt(t) : (KAPPA * t + 16) / 116);
  const fx = f(x / white[0]), fy = f(y / white[1]), fz = f(z / white[2]);
  return [116 * fy - 16, 500 * (fx - fy), 200 * (fy - fz)];
}
export function labToXyz(L: number, a: number, b: number, white: Vec3 = D50): Vec3 {
  const fy = (L + 16) / 116, fx = fy + a / 500, fz = fy - b / 200;
  const inv = (f: number): number => (f ** 3 > EPS ? f ** 3 : (116 * f - 16) / KAPPA);
  const y = L > KAPPA * EPS ? fy ** 3 : L / KAPPA;
  return [inv(fx) * white[0], y * white[1], inv(fz) * white[2]];
}
/** RGB in a profile → CIE Lab D50. */
export function rgbToLab(r: number, g: number, b: number, profile: Profile | string = "sRGB IEC61966-2.1"): Vec3 {
  const p = typeof profile === "string" ? getProfile(profile) : profile;
  const xyz = toPCS(p, [r, g, b]);
  return xyzToLab(xyz[0], xyz[1], xyz[2]);
}
/** CIE Lab D50 → RGB in a profile (gamut mapped with the intent). */
export function labToRgb(L: number, a: number, b: number, profile: Profile | string = "sRGB IEC61966-2.1", intent: Intent = "relative"): Vec3 {
  const p = typeof profile === "string" ? getProfile(profile) : profile;
  return fromPCS(p, labToXyz(L, a, b), intent);
}
/** CIE76 color difference. */
export const deltaE76 = (a: ArrayLike<number>, b: ArrayLike<number>): number => Math.hypot(a[0]! - b[0]!, a[1]! - b[1]!, a[2]! - b[2]!);

/** CIEDE2000 color difference. */
export function deltaE2000(l1: ArrayLike<number>, l2: ArrayLike<number>): number {
  const [L1, a1, b1] = [l1[0]!, l1[1]!, l1[2]!], [L2, a2, b2] = [l2[0]!, l2[1]!, l2[2]!];
  const C1 = Math.hypot(a1, b1), C2 = Math.hypot(a2, b2), Cm = (C1 + C2) / 2;
  const G = 0.5 * (1 - Math.sqrt(Cm ** 7 / (Cm ** 7 + 25 ** 7)));
  const ap1 = a1 * (1 + G), ap2 = a2 * (1 + G);
  const Cp1 = Math.hypot(ap1, b1), Cp2 = Math.hypot(ap2, b2);
  const hp = (a: number, b: number): number => { const h = (Math.atan2(b, a) * 180) / Math.PI; return h < 0 ? h + 360 : h; };
  const h1 = hp(ap1, b1), h2 = hp(ap2, b2);
  const dL = L2 - L1, dC = Cp2 - Cp1;
  let dh = h2 - h1;
  if (Cp1 * Cp2 === 0) dh = 0; else if (dh > 180) dh -= 360; else if (dh < -180) dh += 360;
  const dH = 2 * Math.sqrt(Cp1 * Cp2) * Math.sin((dh * Math.PI) / 360);
  const Lm = (L1 + L2) / 2, Cpm = (Cp1 + Cp2) / 2;
  let hm = h1 + h2;
  if (Cp1 * Cp2 !== 0) hm = Math.abs(h1 - h2) > 180 ? (h1 + h2 + (h1 + h2 < 360 ? 360 : -360)) / 2 : (h1 + h2) / 2;
  const rad = Math.PI / 180;
  const T = 1 - 0.17 * Math.cos((hm - 30) * rad) + 0.24 * Math.cos(2 * hm * rad) + 0.32 * Math.cos((3 * hm + 6) * rad) - 0.2 * Math.cos((4 * hm - 63) * rad);
  const dTheta = 30 * Math.exp(-(((hm - 275) / 25) ** 2));
  const Rc = 2 * Math.sqrt(Cpm ** 7 / (Cpm ** 7 + 25 ** 7));
  const Sl = 1 + (0.015 * (Lm - 50) ** 2) / Math.sqrt(20 + (Lm - 50) ** 2), Sc = 1 + 0.045 * Cpm, Sh = 1 + 0.015 * Cpm * T;
  const Rt = -Math.sin(2 * dTheta * rad) * Rc;
  return Math.sqrt((dL / Sl) ** 2 + (dC / Sc) ** 2 + (dH / Sh) ** 2 + Rt * (dC / Sc) * (dH / Sh));
}

// ——— hex and web colors ———

/** "#rrggbb" (or "#rrggbbaa" when alpha < 1). */
export function toHex(r: number, g: number, b: number, a = 1): string {
  const h = (v: number): string => Math.round(Math.max(0, Math.min(1, v)) * 255).toString(16).padStart(2, "0");
  return `#${h(r)}${h(g)}${h(b)}${a < 1 ? h(a) : ""}`;
}
/** Parse "#rgb", "#rgba", "#rrggbb", "#rrggbbaa" (the # is optional); null when not a hex color. */
export function parseHex(s: string): [number, number, number, number] | null {
  const m = /^#?([0-9a-f]{3,8})$/i.exec(s.trim());
  if (!m) return null;
  let h = m[1]!;
  if (h.length === 3 || h.length === 4) h = [...h].map((c) => c + c).join("");
  if (h.length !== 6 && h.length !== 8) return null;
  const v = (i: number): number => parseInt(h.slice(i, i + 2), 16) / 255;
  return [v(0), v(2), v(4), h.length === 8 ? v(6) : 1];
}
/** The nearest of the 216 web-safe colors (each channel a multiple of 0x33). */
export function nearestWebSafe(r: number, g: number, b: number): Vec3 {
  const q = (v: number): number => Math.round(Math.max(0, Math.min(1, v)) * 5) / 5;
  return [q(r), q(g), q(b)];
}
export const isWebSafe = (r: number, g: number, b: number): boolean => { const w = nearestWebSafe(r, g, b); return Math.abs(w[0] - r) < 1 / 510 && Math.abs(w[1] - g) < 1 / 510 && Math.abs(w[2] - b) < 1 / 510; };
