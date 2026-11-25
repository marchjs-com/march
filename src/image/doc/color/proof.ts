// CMYK soft proof — an APPROXIMATION, not an ICC CMYK engine. Inks follow a Beer–Lambert density model over linear
// sRGB reflectance: each ink adds optical density to the three channels (a main absorption plus two side
// absorptions, the same for every ink so that equal C, M, Y prints neutral), black adds equal density everywhere.
// Separation: gray component replacement (GCR amount, black limit), a total ink limit, and dot gain compensation
// in the reported plate values (the press gain k' = k + 4g·k(1−k) brings them back to the intended coverage). Colors
// that need negative ink or exceed the ink limit come back changed: that is the gamut. Presets are generic
// parameter sets, named by paper type.

import type { ImageDocument } from "../document.ts";
import { renderRegion } from "../composite.ts";
import { Mask, type Rect } from "../tiles.ts";
import { rgbToLab, deltaE76 } from "./convert.ts";
import { SRGB, bradford, decode, encode, getProfile, invert3, matMul, mul3, type Mat3, type Profile, type Vec3 } from "./profiles.ts";

/** A CMYK press simulation. @tr CMYK baskı benzetimi. */
export interface ProofSetup {
  id: string;
  label: string;
  /** Total ink limit (sum of C+M+Y+K coverage, 1 = 100 %). */
  inkLimit: number;
  /** Black limit 0–1. */
  blackLimit: number;
  /** Gray component replacement 0 (none) – 1 (maximum). */
  gcr: number;
  /** Dot gain at 50 % (0.2 = 20 %). */
  dotGain: number;
  /** Maximum density of a solid C / M / Y and of K. */
  inkDensity: number;
  blackDensity: number;
  /** Side absorptions of an ink in the two other channels (fractions of its main density). */
  crosstalk: [number, number];
  /** Paper white (linear sRGB reflectance), used only when the proof simulates paper color. */
  paper: Vec3;
}

export const PROOF_PRESETS: ProofSetup[] = [
  { id: "coated", label: "Coated sheetfed (approx.)", inkLimit: 3.3, blackLimit: 1, gcr: 0.6, dotGain: 0.14, inkDensity: 1.5, blackDensity: 1.8, crosstalk: [0.08, 0.03], paper: [0.93, 0.93, 0.9] },
  { id: "web-coated", label: "Web coated (approx.)", inkLimit: 3.0, blackLimit: 0.95, gcr: 0.45, dotGain: 0.2, inkDensity: 1.4, blackDensity: 1.7, crosstalk: [0.1, 0.04], paper: [0.9, 0.9, 0.86] },
  { id: "uncoated", label: "Uncoated (approx.)", inkLimit: 2.6, blackLimit: 0.9, gcr: 0.5, dotGain: 0.26, inkDensity: 1.15, blackDensity: 1.4, crosstalk: [0.13, 0.05], paper: [0.88, 0.88, 0.84] },
  { id: "newsprint", label: "Newsprint (approx.)", inkLimit: 2.4, blackLimit: 0.85, gcr: 0.6, dotGain: 0.3, inkDensity: 0.95, blackDensity: 1.15, crosstalk: [0.16, 0.06], paper: [0.78, 0.77, 0.72] },
];

/** A setup by id, label, or a document's proof profile name ("Coated …", "Web Coated …", "Uncoated …"). */
export function getProofSetup(name?: string | null): ProofSetup {
  const n = (name ?? "").toLowerCase();
  const exact = PROOF_PRESETS.find((p) => p.id === n || p.label.toLowerCase() === n);
  if (exact) return exact;
  if (n.includes("news")) return PROOF_PRESETS[3]!;
  if (n.includes("uncoated")) return PROOF_PRESETS[2]!;
  if (n.includes("web")) return PROOF_PRESETS[1]!;
  return PROOF_PRESETS[0]!;
}

const MIN_REFLECT = 1e-4;

interface Model { A: Mat3; Ainv: Mat3; s: ProofSetup; toLin: Mat3; fromLin: Mat3; p: Profile }
const models = new WeakMap<ProofSetup, Map<string, Model>>();

/** The model for a setup and a document profile (cached). */
function model(s: ProofSetup, profile: Profile | string = SRGB): Model {
  const p = typeof profile === "string" ? getProfile(profile) : profile;
  let byProfile = models.get(s);
  if (!byProfile) models.set(s, (byProfile = new Map()));
  const hit = byProfile.get(p.name);
  if (hit) return hit;
  const d = s.inkDensity, [a1, a2] = s.crosstalk;
  // rows: R, G, B channel density; columns: C, M, Y
  const A: Mat3 = [d, d * a2, d * a1, d * a1, d, d * a2, d * a2, d * a1, d];
  // document profile linear → linear sRGB (the ink model's space), and back
  let toLin: Mat3;
  if (p.kind === "gray") { const w = mul3(SRGB.fromXYZ, mul3(bradford(p.white, SRGB.white), p.white)); toLin = [w[0], 0, 0, w[1], 0, 0, w[2], 0, 0]; }
  else toLin = matMul(SRGB.fromXYZ, matMul(bradford(p.white, SRGB.white), p.toXYZ));
  const fromLin = p.kind === "gray" ? ([0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722, 0.2126, 0.7152, 0.0722] as Mat3) : invert3(toLin);
  const m: Model = { A, Ainv: invert3(A), s, toLin, fromLin, p };
  byProfile.set(p.name, m);
  return m;
}

/** Plate value for an intended printed coverage (undo the press dot gain). */
function compensate(k: number, g: number): number {
  if (k <= 0 || k >= 1 || g <= 0) return k;
  const g4 = 4 * g;
  return (1 + g4 - Math.sqrt((1 + g4) * (1 + g4) - 4 * g4 * k)) / (2 * g4);
}
/** Printed coverage of a plate value (press dot gain). */
const gain = (p: number, g: number): number => Math.min(1, p + 4 * g * p * (1 - p));

const tmpD: Vec3 = [0, 0, 0];
/** Separate linear sRGB reflectance into printed coverages [c, m, y, k] (intended, before dot gain compensation). */
function separate(m: Model, lr: number, lg: number, lb: number, out: number[]): number[] {
  const s = m.s;
  const R = Math.max(MIN_REFLECT, Math.min(1, lr)), G = Math.max(MIN_REFLECT, Math.min(1, lg)), B = Math.max(MIN_REFLECT, Math.min(1, lb));
  tmpD[0] = -Math.log10(R); tmpD[1] = -Math.log10(G); tmpD[2] = -Math.log10(B);
  const gray = Math.min(tmpD[0], tmpD[1], tmpD[2]);
  // GCR: black takes a share of the gray component, growing with darkness
  let k = Math.min(s.blackLimit, (s.gcr * gray) / s.blackDensity);
  // in deep shadows the colored inks alone cannot reach the density: black carries the rest
  const cmyMax = s.inkDensity * (1 + s.crosstalk[0] + s.crosstalk[1]);
  if (gray - k * s.blackDensity > cmyMax) k = Math.min(s.blackLimit, (gray - cmyMax) / s.blackDensity);
  const kd = k * s.blackDensity;
  const d0 = tmpD[0] - kd, d1 = tmpD[1] - kd, d2 = tmpD[2] - kd, A = m.Ainv;
  let c = A[0] * d0 + A[1] * d1 + A[2] * d2, mm = A[3] * d0 + A[4] * d1 + A[5] * d2, y = A[6] * d0 + A[7] * d1 + A[8] * d2;
  c = c < 0 ? 0 : c > 1 ? 1 : c; mm = mm < 0 ? 0 : mm > 1 ? 1 : mm; y = y < 0 ? 0 : y > 1 ? 1 : y;
  const sum = c + mm + y + k;
  if (sum > s.inkLimit && c + mm + y > 0) { const f = Math.max(0, s.inkLimit - k) / (c + mm + y); c *= f; mm *= f; y *= f; }
  out[0] = c; out[1] = mm; out[2] = y; out[3] = k;
  return out;
}

/** Printed coverages → linear sRGB reflectance. */
function print(m: Model, c: number, mm: number, y: number, k: number, paper: boolean, out: Vec3): Vec3 {
  const A = m.A, kd = k * m.s.blackDensity;
  out[0] = Math.pow(10, -(A[0] * c + A[1] * mm + A[2] * y + kd));
  out[1] = Math.pow(10, -(A[3] * c + A[4] * mm + A[5] * y + kd));
  out[2] = Math.pow(10, -(A[6] * c + A[7] * mm + A[8] * y + kd));
  if (paper) { out[0] *= m.s.paper[0]; out[1] *= m.s.paper[1]; out[2] *= m.s.paper[2]; }
  return out;
}

const lin3 = (m: Mat3, p: Profile, r: number, g: number, b: number): Vec3 => {
  const a = decode(p.trc, r), bb = p.kind === "gray" ? 0 : decode(p.trc, g), c = p.kind === "gray" ? 0 : decode(p.trc, b);
  return [m[0] * a + m[1] * bb + m[2] * c, m[3] * a + m[4] * bb + m[5] * c, m[6] * a + m[7] * bb + m[8] * c];
};

/** RGB (in `profile`) → CMYK plate values 0–1 (what the separated file would hold). */
export function rgbToCmyk(r: number, g: number, b: number, setup: ProofSetup = PROOF_PRESETS[0]!, profile: Profile | string = SRGB): [number, number, number, number] {
  const m = model(setup, profile), l = lin3(m.toLin, m.p, r, g, b);
  const t = separate(m, l[0], l[1], l[2], [0, 0, 0, 0]);
  const dg = setup.dotGain;
  return [compensate(t[0]!, dg), compensate(t[1]!, dg), compensate(t[2]!, dg), compensate(t[3]!, dg)];
}

/** CMYK plate values → RGB (in `profile`) as printed. */
export function cmykToRgb(c: number, mm: number, y: number, k: number, setup: ProofSetup = PROOF_PRESETS[0]!, profile: Profile | string = SRGB, paper = false): Vec3 {
  const m = model(setup, profile), dg = setup.dotGain;
  const l = print(m, gain(c, dg), gain(mm, dg), gain(y, dg), gain(k, dg), paper, [0, 0, 0]);
  return linToEncoded(m, l);
}

function linToEncoded(m: Model, l: Vec3): Vec3 {
  const f = m.fromLin, p = m.p;
  const x = f[0] * l[0] + f[1] * l[1] + f[2] * l[2], y = f[3] * l[0] + f[4] * l[1] + f[5] * l[2], z = f[6] * l[0] + f[7] * l[1] + f[8] * l[2];
  const c = (v: number): number => encode(p.trc, v < 0 ? 0 : v > 1 ? 1 : v);
  return [c(x), c(y), c(z)];
}

/** A color as it would print (separate, then print), in the same profile. */
export function proofColor(r: number, g: number, b: number, setup: ProofSetup = PROOF_PRESETS[0]!, profile: Profile | string = SRGB, paper = false): Vec3 {
  const m = model(setup, profile), l = lin3(m.toLin, m.p, r, g, b);
  const t = separate(m, l[0], l[1], l[2], [0, 0, 0, 0]);
  return linToEncoded(m, print(m, t[0]!, t[1]!, t[2]!, t[3]!, paper, [0, 0, 0]));
}

/** A 3D lookup table of the proof transform (33³ by default) for whole images: trilinear interpolation. */
export class ProofLut {
  readonly n: number;
  readonly table: Float32Array;
  constructor(setup: ProofSetup = PROOF_PRESETS[0]!, profile: Profile | string = SRGB, n = 33, paper = false) {
    this.n = n;
    this.table = new Float32Array(n * n * n * 3);
    const m = model(setup, profile), t = [0, 0, 0, 0], o: Vec3 = [0, 0, 0];
    let i = 0;
    for (let b = 0; b < n; b++) for (let g = 0; g < n; g++) for (let r = 0; r < n; r++) {
      const l = lin3(m.toLin, m.p, r / (n - 1), g / (n - 1), b / (n - 1));
      separate(m, l[0], l[1], l[2], t);
      const e = linToEncoded(m, print(m, t[0]!, t[1]!, t[2]!, t[3]!, paper, o));
      this.table[i++] = e[0]; this.table[i++] = e[1]; this.table[i++] = e[2];
    }
  }
  /** Proof straight RGBA floats in place. */
  apply(px: Float32Array): Float32Array {
    const n = this.n, T = this.table, s = n - 1;
    for (let i = 0; i < px.length; i += 4) {
      const fr = Math.max(0, Math.min(1, px[i]!)) * s, fg = Math.max(0, Math.min(1, px[i + 1]!)) * s, fb = Math.max(0, Math.min(1, px[i + 2]!)) * s;
      const r0 = Math.min(s - 1, fr | 0), g0 = Math.min(s - 1, fg | 0), b0 = Math.min(s - 1, fb | 0);
      const dr = fr - r0, dg = fg - g0, db = fb - b0;
      for (let c = 0; c < 3; c++) {
        const at = (r: number, g: number, b: number): number => T[((b * n + g) * n + r) * 3 + c]!;
        const c00 = at(r0, g0, b0) * (1 - dr) + at(r0 + 1, g0, b0) * dr, c10 = at(r0, g0 + 1, b0) * (1 - dr) + at(r0 + 1, g0 + 1, b0) * dr;
        const c01 = at(r0, g0, b0 + 1) * (1 - dr) + at(r0 + 1, g0, b0 + 1) * dr, c11 = at(r0, g0 + 1, b0 + 1) * (1 - dr) + at(r0 + 1, g0 + 1, b0 + 1) * dr;
        px[i + c] = (c00 * (1 - dg) + c10 * dg) * (1 - db) + (c01 * (1 - dg) + c11 * dg) * db;
      }
    }
    return px;
  }
}

const lutCache = new WeakMap<ProofSetup, Map<string, ProofLut>>();
function lutFor(setup: ProofSetup, profile: string, paper: boolean): ProofLut {
  let m = lutCache.get(setup);
  if (!m) lutCache.set(setup, (m = new Map()));
  const key = `${profile}|${paper}`;
  let l = m.get(key);
  if (!l) m.set(key, (l = new ProofLut(setup, profile, 33, paper)));
  return l;
}

/** The composite of a region as it would print (straight RGBA): View › Proof Colors. */
export function softProof(doc: ImageDocument, r: Rect, setup: ProofSetup = getProofSetup(doc.proof.profile), opts: { paper?: boolean } = {}): Float32Array {
  const px = renderRegion(doc, r);
  for (let i = 0; i < px.length; i += 4) { const a = px[i + 3]!; if (a > 0) { px[i]! /= a; px[i + 1]! /= a; px[i + 2]! /= a; } }
  return lutFor(setup, doc.profile, !!opts.paper).apply(px);
}

/**
 * Gamut warning: 255 where a color changes by more than `threshold` ΔE (CIE76, Lab D50) when proofed. Works on
 * straight RGBA floats; the proof is computed exactly per pixel (no LUT) so the edge of the gamut is not blurred.
 */
export function gamutWarningPixels(px: Float32Array, profile: Profile | string = SRGB, setup: ProofSetup = PROOF_PRESETS[0]!, threshold = 2): Uint8Array {
  const n = px.length >> 2, out = new Uint8Array(n), p = typeof profile === "string" ? getProfile(profile) : profile;
  const cache = new Map<number, number>();
  for (let i = 0; i < n; i++) {
    const k = i * 4;
    if (px[k + 3]! <= 0) continue;
    const r = px[k]!, g = px[k + 1]!, b = px[k + 2]!;
    // repeated colors are common: memoize on the 8-bit key
    const key = (Math.round(r * 255) << 16) | (Math.round(g * 255) << 8) | Math.round(b * 255);
    let v = cache.get(key);
    if (v === undefined) {
      const pr = proofColor(r, g, b, setup, p);
      v = deltaE76(rgbToLab(r, g, b, p), rgbToLab(pr[0], pr[1], pr[2], p)) > threshold ? 255 : 0;
      if (cache.size < 1 << 18) cache.set(key, v);
    }
    out[i] = v;
  }
  return out;
}

/** View › Gamut Warning for the whole document, as a mask (255 = out of the proof gamut). */
export function gamutWarning(doc: ImageDocument, setup: ProofSetup = getProofSetup(doc.proof.profile), threshold = 2, r: Rect = doc.bounds): Mask {
  const px = renderRegion(doc, r);
  for (let i = 0; i < px.length; i += 4) { const a = px[i + 3]!; if (a > 0) { px[i]! /= a; px[i + 1]! /= a; px[i + 2]! /= a; } }
  const flags = gamutWarningPixels(px, doc.profile, setup, threshold), m = new Mask(doc.width, doc.height);
  for (let y = 0; y < r.h; y++) m.data.set(flags.subarray(y * r.w, (y + 1) * r.w), (r.y + y) * doc.width + r.x);
  return m;
}
