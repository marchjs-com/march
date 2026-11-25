// gradient-map: maps each pixel's lightness onto a colour gradient (stops at 0–1, mixed in OKLab), so dark tones take
// the first colour and bright tones the last.
import { defineOp, opOf, type ImageOp } from "../op.ts";
import { hexToLin, linToOklab, oklabToLin } from "../color.ts";

export interface GradientStop { /** Position 0–1 (0: black, 1: white in the image). */ at: number; /** #rgb / #rrggbb. */ color: string }
export interface GradientMapParams { stops: GradientStop[] }

const N = 256;
/** The gradient sampled into N OKLab triples (L, a, b) by lightness 0–1. */
export function gradientTable(stops: readonly GradientStop[]): Float32Array {
  const s = [...stops].sort((a, b) => a.at - b.at).map((st) => {
    const o = [0, 0, 0], l = hexToLin(st.color);
    linToOklab(l[0], l[1], l[2], o);
    return { at: Math.min(1, Math.max(0, st.at)), lab: o };
  });
  const t = new Float32Array(N * 3);
  if (!s.length) { for (let i = 0; i < N; i++) t[i * 3] = i / (N - 1); return t; }
  for (let i = 0, j = 0; i < N; i++) {
    const x = i / (N - 1);
    while (j < s.length - 1 && x > s[j + 1]!.at) j++;
    const a = s[j]!, b = s[Math.min(s.length - 1, j + 1)]!;
    const u = x <= a.at ? 0 : x >= b.at ? 1 : (x - a.at) / (b.at - a.at || 1);
    for (let k = 0; k < 3; k++) t[i * 3 + k] = a.lab[k]! + (b.lab[k]! - a.lab[k]!) * u;
  }
  return t;
}

const lab = new Float32Array(3);
/** Replace a linear colour by the gradient colour at its OKLab lightness (in place). */
export function mapThrough(c: Float32Array, table: Float32Array): void {
  linToOklab(Math.max(0, c[0]!), Math.max(0, c[1]!), Math.max(0, c[2]!), lab);
  const f = Math.min(N - 1, Math.max(0, lab[0]! * (N - 1))), i = Math.min(N - 2, f | 0), u = f - i, o = i * 3;
  oklabToLin(table[o]! + (table[o + 3]! - table[o]!) * u, table[o + 1]! + (table[o + 4]! - table[o + 1]!) * u, table[o + 2]! + (table[o + 5]! - table[o + 2]!) * u, c);
}

export const GRADIENT_MAP = defineOp<GradientMapParams>({
  type: "gradient-map", kind: "color",
  defaults: { stops: [{ at: 0, color: "#000000" }, { at: 1, color: "#ffffff" }] },
  prepare: (p) => gradientTable(p.stops),
  colorWith: (c, _p, t) => mapThrough(c, t as Float32Array),
});
/** Gradient map: `gradientMap([{ at: 0, color: "#1a0b3d" }, { at: 0.5, color: "#d9467a" }, { at: 1, color: "#ffe29a" }])`. */
export const gradientMap = (stops?: GradientStop[]): ImageOp<GradientMapParams> => opOf(GRADIENT_MAP, stops ? { stops } : {});
