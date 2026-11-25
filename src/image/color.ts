// Colour maths for ops, on linear RGB without clamping (an op in the middle of a chain may go past 0–1): OKLab /
// OKLCh (the same matrices as the motion engine's colour engine, which works on clamped display values), hex parsing
// into linear, and the encoded ↔ linear curve helpers tone ops share.
import { toEncoded, toLinear } from "./raster.ts";

/** Linear RGB → OKLab into out[0..2]. */
export function linToOklab(r: number, g: number, b: number, out: Float32Array | number[]): void {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  out[0] = 0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s;
  out[1] = 1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s;
  out[2] = 0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s;
}
/** OKLab → linear RGB into out[0..2] (not clamped). */
export function oklabToLin(L: number, a: number, b: number, out: Float32Array | number[]): void {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  out[0] = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  out[1] = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  out[2] = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
}

const lab = new Float32Array(3);
/** Run fn on the OKLCh of a linear colour (L 0–1, C, h in degrees) and write the result back (in place). */
export function withLch(rgb: Float32Array, fn: (lch: [number, number, number]) => void): void {
  linToOklab(Math.max(0, rgb[0]!), Math.max(0, rgb[1]!), Math.max(0, rgb[2]!), lab);
  const C = Math.hypot(lab[1]!, lab[2]!), h = (Math.atan2(lab[2]!, lab[1]!) * 180) / Math.PI;
  const lch: [number, number, number] = [lab[0]!, C, h < 0 ? h + 360 : h];
  fn(lch);
  const hr = (lch[2] * Math.PI) / 180;
  oklabToLin(lch[0], lch[1] * Math.cos(hr), lch[1] * Math.sin(hr), rgb);
}

/** Parse #rgb / #rrggbb into linear RGB. */
export function hexToLin(hex: string): [number, number, number] {
  let s = hex.trim().replace(/^#/, "");
  if (s.length === 3) s = s.replace(/./g, "$&$&");
  const n = parseInt(s.slice(0, 6), 16);
  if (!Number.isFinite(n)) return [0, 0, 0];
  return [toLinear(((n >> 16) & 255) / 255), toLinear(((n >> 8) & 255) / 255), toLinear((n & 255) / 255)];
}

/** Apply an encoded-space curve f(0–1) → 0–1 to each channel of a linear colour (in place). */
export function perChannelEncoded(rgb: Float32Array, f: (e: number) => number): void {
  for (let k = 0; k < 3; k++) { const v = rgb[k]!; rgb[k] = toLinear(Math.max(0, f(toEncoded(Math.max(0, v))))) * (v < 0 ? 0 : 1); }
}

/** Scale a linear colour so its perceptual lightness becomes f(L) (hue and saturation kept). L = cbrt(luminance). */
export function toneByLightness(rgb: Float32Array, f: (L: number) => number): void {
  const Y = 0.2126 * rgb[0]! + 0.7152 * rgb[1]! + 0.0722 * rgb[2]!;
  if (Y <= 1e-7) { const L2 = f(0); if (L2 > 0) { const y = L2 ** 3; rgb[0] = rgb[1] = rgb[2] = y; } return; }
  const L = Math.cbrt(Y), L2 = Math.max(0, f(L)), k = (L2 / L) ** 3;
  rgb[0] = rgb[0]! * k; rgb[1] = rgb[1]! * k; rgb[2] = rgb[2]! * k;
}

/**
 * Monotone cubic spline through points (x ascending, 0–1) sampled into a table of n entries (Fritsch–Carlson: no
 * overshoot, so a curve never folds back). Points outside are held flat.
 */
export function curveTable(points: readonly (readonly [number, number])[], n = 1024): Float32Array {
  const pts = [...points].map(([x, y]) => [Math.min(1, Math.max(0, x)), Math.min(1, Math.max(0, y))] as [number, number]).sort((a, b) => a[0] - b[0]);
  const out = new Float32Array(n);
  if (pts.length < 2) { for (let i = 0; i < n; i++) out[i] = pts.length ? pts[0]![1] : i / (n - 1); return out; }
  const k = pts.length, dx: number[] = [], m: number[] = [], t: number[] = new Array(k).fill(0);
  for (let i = 0; i < k - 1; i++) { dx[i] = pts[i + 1]![0] - pts[i]![0] || 1e-6; m[i] = (pts[i + 1]![1] - pts[i]![1]) / dx[i]!; }
  t[0] = m[0]!; t[k - 1] = m[k - 2]!;
  for (let i = 1; i < k - 1; i++) t[i] = m[i - 1]! * m[i]! <= 0 ? 0 : (m[i - 1]! + m[i]!) / 2;
  for (let i = 0; i < k - 1; i++) {
    if (m[i] === 0) { t[i] = 0; t[i + 1] = 0; continue; }
    const a = t[i]! / m[i]!, b = t[i + 1]! / m[i]!, s = a * a + b * b;
    if (s > 9) { const q = 3 / Math.sqrt(s); t[i] = q * a * m[i]!; t[i + 1] = q * b * m[i]!; }
  }
  let seg = 0;
  for (let j = 0; j < n; j++) {
    const x = j / (n - 1);
    if (x <= pts[0]![0]) { out[j] = pts[0]![1]; continue; }
    if (x >= pts[k - 1]![0]) { out[j] = pts[k - 1]![1]; continue; }
    while (seg < k - 2 && x > pts[seg + 1]![0]) seg++;
    const h = dx[seg]!, u = (x - pts[seg]![0]) / h, u2 = u * u, u3 = u2 * u;
    out[j] = Math.min(1, Math.max(0, (2 * u3 - 3 * u2 + 1) * pts[seg]![1] + (u3 - 2 * u2 + u) * h * t[seg]! + (-2 * u3 + 3 * u2) * pts[seg + 1]![1] + (u3 - u2) * h * t[seg + 1]!));
  }
  return out;
}

/** Read a table (0–1 domain) with linear interpolation. */
export function readTable(t: Float32Array, x: number): number {
  const n = t.length - 1, f = Math.min(n, Math.max(0, x * n)), i = Math.min(n - 1, f | 0), u = f - i;
  return t[i]! + (t[i + 1]! - t[i]!) * u;
}

/** Hue distance in degrees (0–180). */
export const hueDist = (a: number, b: number): number => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
