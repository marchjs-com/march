// Select menu extras: Subject and Sky (AI hooks with classic fallbacks), Focus Area, Select and Mask (edge detection
// radius / smart radius, smooth, feather, contrast, shift edge, decontaminate colors; output to selection, layer mask,
// new layer, new layer with mask), Modify (border / smooth / expand / contract / feather as undo steps), Transform
// Selection, and layer selection (all layers, similar layers, find by name / kind).

import { blurPlane } from "./alpha.ts";
import type { ImageDocument } from "./document.ts";
import { hasRaster, isContainer, walk, type Layer, type LayerKind } from "./layers.ts";
import { oklab } from "./paint.ts";
import { border, combine, contract, expand, feather, smooth, type SelectOp } from "./selection.ts";
import { Mask, type Rect } from "./tiles.ts";
import { gradient, hookMask, samplePixels, type AiHooks } from "./tools/select-tools.ts";

type MaskResult = Mask | Promise<Mask>;
const isPromise = <T>(v: unknown): v is Promise<T> => !!v && typeof (v as Promise<T>).then === "function";

/** Apply a (possibly async) mask as one step. */
function applyMask(doc: ImageDocument, label: string, m: MaskResult, op: SelectOp): void | Promise<void> {
  if (isPromise<Mask>(m)) return m.then((x) => { doc.change(label, () => combine(doc, x, op)); });
  doc.change(label, () => combine(doc, m, op));
}

// ——— small planes ———

interface Small { w: number; h: number; k: number; px: Float32Array }
/** Box-downsample straight RGBA to at most `max` pixels on the long side. */
function downsample(px: Float32Array, w: number, h: number, max = 256): Small {
  const k = Math.max(1, Math.ceil(Math.max(w, h) / max)), sw = Math.ceil(w / k), sh = Math.ceil(h / k), out = new Float32Array(sw * sh * 4);
  const cnt = new Float32Array(sw * sh);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, j = ((y / k) | 0) * sw + ((x / k) | 0);
    out[j * 4]! += px[i]!; out[j * 4 + 1]! += px[i + 1]!; out[j * 4 + 2]! += px[i + 2]!; out[j * 4 + 3]! += px[i + 3]!; cnt[j]!++;
  }
  for (let j = 0; j < cnt.length; j++) for (let c = 0; c < 4; c++) out[j * 4 + c]! /= cnt[j]! || 1;
  return { w: sw, h: sh, k, px: out };
}
/** Bilinear upsample of a small 0–1 plane into a doc-size mask. */
function upsample(p: Float32Array, s: { w: number; h: number; k: number }, w: number, h: number): Mask {
  const m = new Mask(w, h), d = m.data;
  for (let y = 0; y < h; y++) {
    const fy = Math.max(0, Math.min(s.h - 1, (y + 0.5) / s.k - 0.5)), y0 = Math.floor(fy), y1 = Math.min(s.h - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = Math.max(0, Math.min(s.w - 1, (x + 0.5) / s.k - 0.5)), x0 = Math.floor(fx), x1 = Math.min(s.w - 1, x0 + 1), tx = fx - x0;
      const v = (p[y0 * s.w + x0]! * (1 - tx) + p[y0 * s.w + x1]! * tx) * (1 - ty) + (p[y1 * s.w + x0]! * (1 - tx) + p[y1 * s.w + x1]! * tx) * ty;
      d[y * w + x] = Math.round(Math.max(0, Math.min(1, v)) * 255);
    }
  }
  return m;
}
/** Otsu threshold of a 0–1 plane. */
export function otsu(p: Float32Array): number {
  const hist = new Float64Array(256);
  for (let i = 0; i < p.length; i++) hist[Math.max(0, Math.min(255, Math.round(p[i]! * 255)))]!++;
  let sum = 0;
  for (let i = 0; i < 256; i++) sum += i * hist[i]!;
  let sb = 0, wb = 0, best = 0, t = 128;
  for (let i = 0; i < 256; i++) {
    wb += hist[i]!;
    if (!wb) continue;
    const wf = p.length - wb;
    if (!wf) break;
    sb += i * hist[i]!;
    const mb = sb / wb, mf = (sum - sb) / wf, v = wb * wf * (mb - mf) ** 2;
    if (v > best) { best = v; t = i; }
  }
  return t / 255;
}
/** Keep the largest 4-connected component of a binary plane and fill its holes. */
function largestComponent(b: Uint8Array, w: number, h: number): Uint8Array {
  const lab = new Int32Array(w * h), sizes: number[] = [0];
  for (let i = 0; i < b.length; i++) {
    if (!b[i] || lab[i]) continue;
    const id = sizes.length, st = [i];
    lab[i] = id;
    let n = 0;
    while (st.length) {
      const j = st.pop()!, x = j % w;
      n++;
      for (const k of [j - w, j + w, x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1]) if (k >= 0 && k < b.length && b[k] && !lab[k]) { lab[k] = id; st.push(k); }
    }
    sizes.push(n);
  }
  let big = 0;
  for (let i = 1; i < sizes.length; i++) if (sizes[i]! > (sizes[big] ?? 0)) big = i;
  const out = new Uint8Array(w * h);
  if (!big) return out;
  for (let i = 0; i < out.length; i++) out[i] = lab[i] === big ? 1 : 0;
  // fill holes: background not reachable from the border becomes foreground
  const reach = new Uint8Array(w * h), st: number[] = [];
  for (let x = 0; x < w; x++) for (const y of [0, h - 1]) { const i = y * w + x; if (!out[i] && !reach[i]) { reach[i] = 1; st.push(i); } }
  for (let y = 0; y < h; y++) for (const x of [0, w - 1]) { const i = y * w + x; if (!out[i] && !reach[i]) { reach[i] = 1; st.push(i); } }
  while (st.length) {
    const j = st.pop()!, x = j % w;
    for (const k of [j - w, j + w, x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1]) if (k >= 0 && k < out.length && !out[k] && !reach[k]) { reach[k] = 1; st.push(k); }
  }
  for (let i = 0; i < out.length; i++) if (!out[i] && !reach[i]) out[i] = 1;
  return out;
}

const pixelsOf = (doc: ImageDocument): { width: number; height: number; data: Float32Array } => ({ width: doc.width, height: doc.height, data: samplePixels(doc, true) });

// ——— subject ———

/**
 * Saliency without a model: distance in OKLab from the colors along the image border (the nearest of the four sides),
 * weighted toward the center, Otsu threshold, the largest component with holes filled.
 */
export function saliencySubject(doc: ImageDocument, px: Float32Array = samplePixels(doc, true)): Mask {
  const s = downsample(px, doc.width, doc.height), n = s.w * s.h, lab = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const o = oklab(s.px[i * 4]!, s.px[i * 4 + 1]!, s.px[i * 4 + 2]!); lab[i * 3] = o[0]; lab[i * 3 + 1] = o[1]; lab[i * 3 + 2] = o[2]; }
  const band = Math.max(1, Math.round(Math.min(s.w, s.h) * 0.05));
  const sides: number[][] = [];
  const mean = (test: (x: number, y: number) => boolean): number[] => {
    const m = [0, 0, 0];
    let c = 0;
    for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) if (test(x, y)) { const i = (y * s.w + x) * 3; m[0]! += lab[i]!; m[1]! += lab[i + 1]!; m[2]! += lab[i + 2]!; c++; }
    return m.map((v) => v / Math.max(1, c));
  };
  sides.push(mean((_x, y) => y < band), mean((_x, y) => y >= s.h - band), mean((x) => x < band), mean((x) => x >= s.w - band));
  const sal = new Float32Array(n), cx = s.w / 2, cy = s.h / 2, sig = 0.4 * Math.hypot(s.w, s.h) / 2;
  let max = 1e-6;
  for (let y = 0; y < s.h; y++) for (let x = 0; x < s.w; x++) {
    const i = y * s.w + x;
    let d = Infinity;
    for (const m of sides) d = Math.min(d, Math.hypot(lab[i * 3]! - m[0]!, lab[i * 3 + 1]! - m[1]!, lab[i * 3 + 2]! - m[2]!));
    const v = d * Math.exp(-((x - cx) ** 2 + (y - cy) ** 2) / (2 * sig * sig)) * (s.px[i * 4 + 3]! > 0 ? 1 : 0);
    sal[i] = v; if (v > max) max = v;
  }
  for (let i = 0; i < n; i++) sal[i]! /= max;
  blurPlane(sal, s.w, s.h, 1);
  const t = Math.max(0.15, otsu(sal)), bin = new Uint8Array(n);
  for (let i = 0; i < n; i++) bin[i] = sal[i]! >= t ? 1 : 0;
  const keep = largestComponent(bin, s.w, s.h), plane = new Float32Array(n);
  for (let i = 0; i < n; i++) plane[i] = keep[i]!;
  return upsample(plane, s, doc.width, doc.height);
}

/** Select › Subject: the AI hook when present, else the saliency fallback. */
export function subjectMask(doc: ImageDocument, ai?: AiHooks): MaskResult {
  const r = ai?.selectSubject?.(pixelsOf(doc));
  if (isPromise<Mask | Uint8Array | null>(r)) return r.then((m) => (m ? hookMask(doc, m) : saliencySubject(doc)));
  return r ? hookMask(doc, r) : saliencySubject(doc);
}
export const selectSubject = (doc: ImageDocument, o: { ai?: AiHooks | undefined; op?: SelectOp } = {}): void | Promise<void> => applyMask(doc, "Select Subject", subjectMask(doc, o.ai), o.op ?? "new");

// ——— sky ———

/** Sky without a model: bright, smooth (low texture) pixels connected to the top edge, not too saturated unless blue. */
export function skyFallback(doc: ImageDocument, px: Float32Array = samplePixels(doc, true)): Mask {
  const s = downsample(px, doc.width, doc.height), n = s.w * s.h, L = new Float32Array(n), cand = new Uint8Array(n);
  const lab = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const o = oklab(s.px[i * 4]!, s.px[i * 4 + 1]!, s.px[i * 4 + 2]!); L[i] = o[0]; lab[i * 3] = o[0]; lab[i * 3 + 1] = o[1]; lab[i * 3 + 2] = o[2]; }
  const tex = gradient(L, s.w, s.h).mag;
  blurPlane(tex, s.w, s.h, 1.5);
  for (let i = 0; i < n; i++) {
    const a = lab[i * 3 + 1]!, b = lab[i * 3 + 2]!, chroma = Math.hypot(a, b), bluish = b < -0.02;
    cand[i] = L[i]! > 0.55 && tex[i]! < 0.03 && (bluish || chroma < 0.06) ? 1 : 0;
  }
  const out = new Float32Array(n), st: number[] = [];
  for (let x = 0; x < s.w; x++) if (cand[x]) { out[x] = 1; st.push(x); }
  while (st.length) {
    const j = st.pop()!, x = j % s.w;
    for (const k of [j - s.w, j + s.w, x > 0 ? j - 1 : -1, x < s.w - 1 ? j + 1 : -1]) if (k >= 0 && k < n && cand[k] && !out[k]) { out[k] = 1; st.push(k); }
  }
  return upsample(out, s, doc.width, doc.height);
}
export function skyMask(doc: ImageDocument, ai?: AiHooks): MaskResult {
  const r = ai?.selectSky?.(pixelsOf(doc));
  if (isPromise<Mask | Uint8Array | null>(r)) return r.then((m) => (m ? hookMask(doc, m) : skyFallback(doc)));
  return r ? hookMask(doc, r) : skyFallback(doc);
}
export const selectSky = (doc: ImageDocument, o: { ai?: AiHooks | undefined; op?: SelectOp } = {}): void | Promise<void> => applyMask(doc, "Select Sky", skyMask(doc, o.ai), o.op ?? "new");

// ——— focus area ———

/** Select › Focus Area: in-focus pixels by local sharpness (|Laplacian| averaged), `range` 0–1 (more = more selected). */
export function focusAreaMask(doc: ImageDocument, o: { range?: number; noise?: number; softEdge?: boolean } = {}): Mask {
  const px = samplePixels(doc, true), w = doc.width, h = doc.height, n = w * h, lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = 0.299 * px[i * 4]! + 0.587 * px[i * 4 + 1]! + 0.114 * px[i * 4 + 2]!;
  const sharp = new Float32Array(n), noise = o.noise ?? 0.01;
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, l = 4 * lum[i]! - lum[i - 1]! - lum[i + 1]! - lum[i - w]! - lum[i + w]!;
    sharp[i] = Math.max(0, Math.abs(l) - noise);
  }
  blurPlane(sharp, w, h, Math.max(2, Math.min(w, h) * 0.02));
  let max = 1e-6;
  for (let i = 0; i < n; i++) if (sharp[i]! > max) max = sharp[i]!;
  const t = 1 - Math.max(0, Math.min(1, o.range ?? 0.5)), m = new Mask(w, h);
  for (let i = 0; i < n; i++) {
    const v = sharp[i]! / max;
    m.data[i] = o.softEdge ? Math.round(Math.max(0, Math.min(1, (v - t) / 0.1 + 0.5)) * 255) : v >= t ? 255 : 0;
  }
  return m;
}
export const selectFocusArea = (doc: ImageDocument, o: { range?: number; noise?: number; softEdge?: boolean; op?: SelectOp } = {}): void => { applyMask(doc, "Focus Area", focusAreaMask(doc, o), o.op ?? "new"); };

// ——— select and mask ———

export interface RefineOptions {
  /** Edge detection radius (px): the band where the edge is re-estimated from colors. */
  radius?: number | undefined;
  /** Smart radius: the band narrows on hard edges and widens on soft ones. */
  smartRadius?: boolean | undefined;
  /** Smooth 0–100. */
  smooth?: number | undefined;
  /** Feather (px). */
  feather?: number | undefined;
  /** Contrast 0–100 %. */
  contrast?: number | undefined;
  /** Shift edge −100…100 %. */
  shiftEdge?: number | undefined;
  /** Replace fringe colors with nearby foreground colors (0 = off, 0–1 amount). */
  decontaminate?: number | undefined;
  output?: "selection" | "mask" | "layer" | "layer-mask" | undefined;
}

/**
 * The refined matte (0–1 per pixel) of the selection: inside the edge band each pixel's alpha is its position between
 * the local background and foreground mean colors (Gaussian-weighted, from outside / inside the selection).
 */
export function refineMatte(doc: ImageDocument, o: RefineOptions = {}, px: Float32Array = samplePixels(doc, true)): { alpha: Float32Array; fg: Float32Array } {
  const w = doc.width, h = doc.height, n = w * h, sel = doc.selection ?? new Mask(w, h);
  const a0 = new Float32Array(n);
  for (let i = 0; i < n; i++) a0[i] = sel.data[i]! / 255;
  const radius = Math.max(0, o.radius ?? 0);
  const alpha = a0.slice();
  // local means of the inside (F) and the outside (B) colors
  const sigma = Math.max(2, radius || 3);
  const fw = new Float32Array(n), bw = new Float32Array(n), F = [new Float32Array(n), new Float32Array(n), new Float32Array(n)], B = [new Float32Array(n), new Float32Array(n), new Float32Array(n)];
  for (let i = 0; i < n; i++) {
    const inside = a0[i]! >= 0.99 ? 1 : 0, outside = a0[i]! <= 0.01 ? 1 : 0;
    fw[i] = inside; bw[i] = outside;
    for (let c = 0; c < 3; c++) { F[c]![i] = px[i * 4 + c]! * inside; B[c]![i] = px[i * 4 + c]! * outside; }
  }
  blurPlane(fw, w, h, sigma); blurPlane(bw, w, h, sigma);
  for (let c = 0; c < 3; c++) { blurPlane(F[c]!, w, h, sigma); blurPlane(B[c]!, w, h, sigma); }
  const fg = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) for (let c = 0; c < 3; c++) fg[i * 3 + c] = fw[i]! > 1e-4 ? F[c]![i]! / fw[i]! : px[i * 4 + c]!;
  if (radius > 0) {
    // distance band around the 50 % edge (two-pass box approximation through a blurred hard mask)
    const band = new Float32Array(n);
    for (let i = 0; i < n; i++) band[i] = a0[i]! >= 0.5 ? 1 : 0;
    blurPlane(band, w, h, radius / 2);
    let edgeStrength: Float32Array | null = null;
    if (o.smartRadius) {
      const lum = new Float32Array(n);
      for (let i = 0; i < n; i++) lum[i] = 0.299 * px[i * 4]! + 0.587 * px[i * 4 + 1]! + 0.114 * px[i * 4 + 2]!;
      edgeStrength = gradient(lum, w, h).mag;
      blurPlane(edgeStrength, w, h, 1);
    }
    for (let i = 0; i < n; i++) {
      let b = band[i]!;
      if (b <= 0.02 || b >= 0.98) continue;
      // smart radius: a hard edge (strong gradient) keeps a narrow band
      if (edgeStrength && edgeStrength[i]! > 0.25 && (b < 0.25 || b > 0.75)) continue;
      if (fw[i]! < 1e-3 || bw[i]! < 1e-3) continue;
      let num = 0, den = 0;
      for (let c = 0; c < 3; c++) {
        const f = F[c]![i]! / fw[i]!, bb = B[c]![i]! / bw[i]!, d = f - bb;
        num += (px[i * 4 + c]! - bb) * d; den += d * d;
      }
      if (den < 1e-4) continue;
      b = num / den;
      alpha[i] = b < 0 ? 0 : b > 1 ? 1 : b;
    }
  }
  const sm = o.smooth ?? 0;
  if (sm > 0) {
    blurPlane(alpha, w, h, sm / 20 + 0.5);
    // smoothing rounds the outline without growing soft halos
    for (let i = 0; i < n; i++) { const v = alpha[i]!; alpha[i] = Math.max(0, Math.min(1, (v - 0.5) * 2 + 0.5)); }
  }
  if ((o.feather ?? 0) > 0) blurPlane(alpha, w, h, o.feather!);
  const k = (o.contrast ?? 0) / 100, shift = (o.shiftEdge ?? 0) / 100;
  if (k > 0 || shift) {
    const lo = 0.5 * k, hi = 1 - 0.5 * k;
    for (let i = 0; i < n; i++) {
      let v = alpha[i]! + shift * 0.5;
      if (k > 0) v = (v - lo) / Math.max(1e-3, hi - lo);
      alpha[i] = v < 0 ? 0 : v > 1 ? 1 : v;
    }
  }
  return { alpha, fg };
}

/** Select › Select and Mask… › OK: refine and send to the chosen output (one step). */
export function selectAndMask(doc: ImageDocument, o: RefineOptions = {}): Layer | null {
  const src = doc.active, px = src && hasRaster(src) ? src.raster.read(0, 0, doc.width, doc.height) : samplePixels(doc, true);
  const { alpha, fg } = refineMatte(doc, o, samplePixels(doc, true));
  const w = doc.width, h = doc.height, n = w * h, m = new Mask(w, h);
  for (let i = 0; i < n; i++) m.data[i] = Math.round(alpha[i]! * 255);
  const out = o.output ?? "selection", dc = Math.max(0, Math.min(1, o.decontaminate ?? 0));
  let made: Layer | null = null;
  doc.change("Select and Mask", () => {
    if (out === "selection") { doc.selection = m.isEmpty() ? null : m; return; }
    if (out === "mask") {
      if (src && !isContainer(src) && !doc.isBackground(src)) { const lm = m.clone(); lm.outside = 0; src.mask = { mask: lm, enabled: true, linked: true, density: 1, feather: 0 }; }
      doc.selection = null;
      return;
    }
    // a new layer: the source pixels (decontaminated in the fringe), masked by alpha or with a layer mask
    const l = doc.newPixelLayer(`${src?.name ?? "Layer"} copy`), buf = px.slice();
    for (let i = 0; i < n; i++) {
      const a = alpha[i]!;
      if (dc > 0 && a > 0 && a < 1) for (let c = 0; c < 3; c++) buf[i * 4 + c] = buf[i * 4 + c]! + (fg[i * 3 + c]! - buf[i * 4 + c]!) * dc;
      if (out === "layer") buf[i * 4 + 3] = buf[i * 4 + 3]! * a;
    }
    l.raster.write(0, 0, w, h, buf);
    if (out === "layer-mask") { const lm = m.clone(); lm.outside = 0; l.mask = { mask: lm, enabled: true, linked: true, density: 1, feather: 0 }; }
    if (src) { doc.add(l, { above: src.id }); src.visible = false; } else doc.add(l);
    doc.selection = null;
    made = l;
  });
  return made;
}

// ——— modify (one step each, reusing selection.ts) ———

export const modifyBorder = (doc: ImageDocument, width: number): void => doc.change("Border", () => border(doc, width));
export const modifySmooth = (doc: ImageDocument, radius: number): void => doc.change("Smooth", () => smooth(doc, radius));
export const modifyExpand = (doc: ImageDocument, n: number): void => doc.change("Expand", () => expand(doc, n));
export const modifyContract = (doc: ImageDocument, n: number): void => doc.change("Contract", () => contract(doc, n));
export const modifyFeather = (doc: ImageDocument, radius: number): void => doc.change("Feather", () => feather(doc, radius));

// ——— transform selection ———

/** Resample a mask through an affine [a, b, c, d, e, f] (doc → doc: x' = a·x + c·y + e, y' = b·x + d·y + f). */
export type MaskResampler = (src: Mask, matrix: number[]) => Mask;

/** Local resampler (inverse mapping): nearest neighbour (hard edges stay hard), or bilinear with `smooth`. */
export function resampleMask(src: Mask, m: number[], smooth = false): Mask {
  const [a, b, c, d, e, f] = m as [number, number, number, number, number, number];
  const det = a * d - b * c;
  const out = new Mask(src.width, src.height);
  if (Math.abs(det) < 1e-12) return out;
  const ia = d / det, ib = -b / det, ic = -c / det, id = a / det, ie = (c * f - d * e) / det, iF = (b * e - a * f) / det;
  const w = src.width, h = src.height, s = src.data, o = out.data;
  const g = (xx: number, yy: number): number => (xx < 0 || yy < 0 || xx >= w || yy >= h ? 0 : s[yy * w + xx]!);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const px = x + 0.5, py = y + 0.5, sx = ia * px + ic * py + ie, sy = ib * px + id * py + iF;
    if (!smooth) { o[y * w + x] = g(Math.floor(sx), Math.floor(sy)); continue; }
    const fx = sx - 0.5, fy = sy - 0.5, x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
    o[y * w + x] = Math.round((g(x0, y0) * (1 - tx) + g(x0 + 1, y0) * tx) * (1 - ty) + (g(x0, y0 + 1) * (1 - tx) + g(x0 + 1, y0 + 1) * tx) * ty);
  }
  return out;
}

/** The affine of scale / rotate (degrees) / move about a center (default: the selection bounds' center). */
export function selectionMatrix(o: { scaleX?: number; scaleY?: number; angle?: number; dx?: number; dy?: number; cx?: number; cy?: number }, bounds: Rect): number[] {
  const sx = o.scaleX ?? 1, sy = o.scaleY ?? 1, r = ((o.angle ?? 0) * Math.PI) / 180, cs = Math.cos(r), sn = Math.sin(r);
  const cx = o.cx ?? bounds.x + bounds.w / 2, cy = o.cy ?? bounds.y + bounds.h / 2;
  const a = cs * sx, b = sn * sx, c = -sn * sy, d = cs * sy;
  return [a, b, c, d, cx - a * cx - c * cy + (o.dx ?? 0), cy - b * cx - d * cy + (o.dy ?? 0)];
}

/** Select › Transform Selection (scale / rotate / move the selection, not the pixels). */
export function transformSelection(doc: ImageDocument, t: number[] | { scaleX?: number; scaleY?: number; angle?: number; dx?: number; dy?: number; cx?: number; cy?: number }, resampler: MaskResampler = resampleMask): void {
  const sel = doc.selection;
  if (!sel) return;
  const b = sel.bounds();
  if (!b) return;
  const m = Array.isArray(t) ? t : selectionMatrix(t, b);
  doc.change("Transform Selection", () => { const r = resampler(sel, m); doc.selection = r.isEmpty() ? null : r; });
}

// ——— layer selection ———

/** Select › All Layers (not the locked background). */
export function selectAllLayers(doc: ImageDocument): void {
  const ids = doc.all().filter((l) => !doc.isBackground(l)).map((l) => l.id);
  doc.change("Select All Layers", () => { doc.selected = ids; if (!doc.activeId || !ids.includes(doc.activeId)) doc.activeId = ids[ids.length - 1] ?? null; });
}

/** Select › Similar Layers: every layer of the active layer's kind. */
export function selectSimilarLayers(doc: ImageDocument): void {
  const a = doc.active;
  if (!a) return;
  const ids = doc.all().filter((l) => l.kind === a.kind && !doc.isBackground(l)).map((l) => l.id);
  doc.change("Select Similar Layers", () => { doc.selected = ids; });
}

/** Select › Find Layers: by name (case-insensitive substring) and / or kind. */
export function findLayers(doc: ImageDocument, q: { name?: string | undefined; kind?: LayerKind | undefined }): Layer[] {
  const name = q.name?.toLowerCase();
  return [...walk(doc.layers)].map(([l]) => l).filter((l) => (!name || l.name.toLowerCase().includes(name)) && (!q.kind || l.kind === q.kind));
}
/** Find and select the matches. */
export function selectFoundLayers(doc: ImageDocument, q: { name?: string | undefined; kind?: LayerKind | undefined }): Layer[] {
  const found = findLayers(doc, q);
  if (found.length) doc.change("Find Layers", () => { doc.selected = found.map((l) => l.id); doc.activeId = found[found.length - 1]!.id; });
  return found;
}
