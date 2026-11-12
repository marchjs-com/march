// Colors for the value layer: parsed to OKLab (perceptually even mixing: no muddy midpoints), premultiplied by alpha,
// written back as oklab() for CSS (so native CSS interpolation is OKLab too) or as sRGB numbers for canvas / WebGL.

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
const toLin = (c: number): number => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c: number): number => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

/** sRGB 0..1 → OKLab, written into out[0..2]. */
export function srgbToOklab(r: number, g: number, b: number, out: Float64Array | number[], i = 0): void {
  const R = toLin(r), G = toLin(g), B = toLin(b);
  const l = Math.cbrt(0.4122214708 * R + 0.5363325363 * G + 0.0514459929 * B);
  const m = Math.cbrt(0.2119034982 * R + 0.6806995451 * G + 0.1073969566 * B);
  const s = Math.cbrt(0.0883024619 * R + 0.2817188376 * G + 0.6299787005 * B);
  out[i] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  out[i + 1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  out[i + 2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}
/** OKLab → sRGB 0..1 (clamped), written into out[i..i+2]. */
export function oklabToSrgb(L: number, a: number, b: number, out: Float64Array | Float32Array | number[], i = 0): void {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  out[i] = clamp01(toGamma(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s));
  out[i + 1] = clamp01(toGamma(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s));
  out[i + 2] = clamp01(toGamma(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s));
}

const NAMED: Record<string, string> = { transparent: "#0000", black: "#000", white: "#fff", red: "#f00", green: "#008000", blue: "#00f", yellow: "#ff0", cyan: "#0ff", magenta: "#f0f", gray: "#808080", grey: "#808080", orange: "#ffa500", purple: "#800080", pink: "#ffc0cb" };
const NUM = /-?(?:\d*\.\d+|\d+)(?:e[-+]?\d+)?%?|none/gi;
const part = (s: string | undefined, scale: number): number => (s == null || s === "none" ? 0 : s.endsWith("%") ? (parseFloat(s) / 100) * scale : parseFloat(s));

/**
 * Parse a CSS color into premultiplied OKLab + alpha: out = [L·α, a·α, b·α, α]. Returns false when `s` is not a color
 * this parser knows (hex, rgb(), hsl(), oklab(), oklch(), a few names).
 */
export function parseColor(input: string, out: Float64Array | number[], i = 0): boolean {
  let s = input.trim().toLowerCase();
  s = NAMED[s] ?? s;
  let L: number, A: number, B: number, alpha = 1;
  const rgb = (r: number, g: number, b: number): void => { const t = [0, 0, 0]; srgbToOklab(r, g, b, t); L = t[0]!; A = t[1]!; B = t[2]!; };
  if (s[0] === "#") {
    const h = s.slice(1);
    if (!/^[0-9a-f]+$/.test(h) || ![3, 4, 6, 8].includes(h.length)) return false;
    const short = h.length < 5;
    const at = (k: number): number => (short ? parseInt(h[k]! + h[k]!, 16) : parseInt(h.slice(k * 2, k * 2 + 2), 16)) / 255;
    rgb(at(0), at(1), at(2));
    if (h.length === 4 || h.length === 8) alpha = at(3);
  } else {
    const m = /^(rgba?|hsla?|oklab|oklch)\((.*)\)$/.exec(s);
    if (!m) return false;
    const v = m[2]!.match(NUM) ?? [];
    if (v.length < 3) return false;
    const fn = m[1]!;
    if (v[3] != null) alpha = part(v[3], 1);
    if (fn.startsWith("rgb")) rgb(part(v[0], 255) / 255, part(v[1], 255) / 255, part(v[2], 255) / 255);
    else if (fn.startsWith("hsl")) {
      const H = (((parseFloat(v[0]!) % 360) + 360) % 360) / 360, S = part(v[1], 100) / 100, Li = part(v[2], 100) / 100;
      const f = (n: number): number => { const k = (n + H * 12) % 12; const a = S * Math.min(Li, 1 - Li); return Li - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)); };
      rgb(f(0), f(8), f(4));
    } else if (fn === "oklab") { L = part(v[0], 1); A = part(v[1], 0.4); B = part(v[2], 0.4); }
    else { L = part(v[0], 1); const C = part(v[1], 0.4), h = (parseFloat(v[2]!) * Math.PI) / 180; A = C * Math.cos(h); B = C * Math.sin(h); }
  }
  out[i] = L! * alpha; out[i + 1] = A! * alpha; out[i + 2] = B! * alpha; out[i + 3] = alpha;
  return true;
}

const f = (x: number, d = 1e4): number => Math.round(x * d) / d;
/** Premultiplied OKLab + alpha → CSS oklab() string. */
export function formatOklab(v: Float64Array | number[], i = 0): string {
  const a = v[i + 3]!;
  if (a <= 0) return "oklab(0 0 0 / 0)";
  const s = `oklab(${f(v[i]! / a)} ${f(v[i + 1]! / a)} ${f(v[i + 2]! / a)}`;
  return a >= 1 ? `${s})` : `${s} / ${f(clamp01(a), 1e3)})`;
}
/** Premultiplied OKLab + alpha → sRGB 0..1 + alpha into out (WebGL uniforms, canvas math). */
export function oklabToRgba(v: Float64Array | number[], i: number, out: Float32Array | Float64Array | number[], j = 0): void {
  const a = v[i + 3]!;
  if (a <= 0) { out[j] = out[j + 1] = out[j + 2] = out[j + 3] = 0; return; }
  oklabToSrgb(v[i]! / a, v[i + 1]! / a, v[i + 2]! / a, out, j);
  out[j + 3] = clamp01(a);
}

/** Mix two CSS colors in OKLab (t = 0 → a, 1 → b). Returns an oklab() string, or b when either is not a color. */
export function mixColor(a: string, b: string, t: number): string {
  const x = [0, 0, 0, 0], y = [0, 0, 0, 0];
  if (!parseColor(a, x) || !parseColor(b, y)) return t < 0.5 ? a : b;
  for (let k = 0; k < 4; k++) x[k] = x[k]! + (y[k]! - x[k]!) * t;
  return formatOklab(x);
}
