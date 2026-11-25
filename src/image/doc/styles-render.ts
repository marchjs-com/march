// Layer styles (effects) renderer: turns a layer's LayerStyle into the passes the compositor draws (see
// composite.ts › stylePasses / drawPasses). Everything works on the region the compositor hands over (the tile grown by
// styleHalo) with single-channel float planes: blur is blurPlane, spread / choke / precise / stroke use distanceTo.
//
// Conventions:
// - percentages (spread, range, jitter, noise, depth, soften is in px) are 0–1 like opacity; sizes and distances are
//   pixels, multiplied by LayerStyle.scale.
// - angles are degrees, counter-clockwise from the right (120 = light from the upper left), y grows downwards; shadows
//   fall away from the light. `globalLight: true` uses doc.globalLight.
// - several instances of an effect (drop shadows, strokes, overlays…): index 0 is drawn on top.
// - passes: "under" = drop shadows, outer glow, the outside part of outer bevel / emboss / pillow, outside strokes;
//   "content" = the layer with fill opacity applied and the interior effects composited inside its alpha (pattern,
//   gradient, color overlay, satin, inner glow, inner shadow, inner bevel); "over" = inside / center strokes and
//   stroke emboss. The compositor draws the content pass with fill 1 (fill is already in it).

import { compositeInto, hash01, type BlendMode } from "./blend.ts";
import { blurPlane, distanceTo } from "./alpha.ts";
import { renderHooks } from "./composite.ts";
import type { ImageDocument } from "./document.ts";
import { hasRaster, type Layer, type RGBA } from "./layers.ts";
import { gradientLut, renderGradient, renderPattern } from "./paint.ts";
import type { BevelFx, Contour, GlowFx, LayerStyle, SatinFx, ShadowFx, StrokeFx, StylePass } from "./styles.ts";
import type { Rect } from "./tiles.ts";

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const RAD = Math.PI / 180;

/** Per-call working state: the region, the layer's alpha plane and lazily built distance fields. */
interface Ctx {
  doc: ImageDocument;
  layer: Layer;
  r: Rect;
  w: number;
  h: number;
  n: number;
  /** Layer alpha over the region. */
  A: Float32Array;
  /** Effect scale. */
  k: number;
  /** Distance from outside pixels to the shape (0 inside). */
  dOut: Float32Array | null;
  /** Distance from inside pixels to the outside (0 outside). */
  dIn: Float32Array | null;
  /** Shared straight RGBA scratch for interior effects. */
  tmp: Float32Array;
}

function distOut(c: Ctx): Float32Array {
  const A = c.A;
  return (c.dOut ??= distanceTo((i) => A[i]! >= 0.5, c.w, c.h));
}
function distIn(c: Ctx): Float32Array {
  const A = c.A;
  return (c.dIn ??= distanceTo((i) => A[i]! < 0.5, c.w, c.h));
}

/** A contour as a 256-entry lookup (null = linear). */
export function contourLut(c: Contour | undefined): Float32Array | null {
  if (!c || c.length === 0) return null;
  const pts = [...c].sort((a, b) => a[0] - b[0]);
  const lut = new Float32Array(256);
  let j = 0;
  for (let i = 0; i < 256; i++) {
    const x = i / 255;
    while (j < pts.length - 1 && pts[j + 1]![0] < x) j++;
    const a = pts[j]!, b = pts[Math.min(pts.length - 1, j + 1)]!;
    let v: number;
    if (x <= pts[0]![0]) v = pts[0]![1];
    else if (x >= pts[pts.length - 1]![0]) v = pts[pts.length - 1]![1];
    else v = a[1] + (b[1] - a[1]) * ((x - a[0]) / Math.max(1e-6, b[0] - a[0]));
    lut[i] = clamp01(v);
  }
  return lut;
}

function applyLut(p: Float32Array, lut: Float32Array | null): void {
  if (!lut) return;
  for (let i = 0; i < p.length; i++) p[i] = lut[Math.round(clamp01(p[i]!) * 255)]!;
}

/** out(x, y) = src(x − dx, y − dy), bilinear, edges clamped. */
function shift(src: Float32Array, w: number, h: number, dx: number, dy: number, out = new Float32Array(src.length)): Float32Array {
  if (Math.abs(dx) < 1e-6 && Math.abs(dy) < 1e-6) { out.set(src); return out; }
  const ix = Math.floor(dx), iy = Math.floor(dy), fx = dx - ix, fy = dy - iy;
  for (let y = 0; y < h; y++) {
    const ya = Math.min(h - 1, Math.max(0, y - iy)) * w, yb = Math.min(h - 1, Math.max(0, y - iy - 1)) * w;
    for (let x = 0; x < w; x++) {
      const xa = Math.min(w - 1, Math.max(0, x - ix)), xb = Math.min(w - 1, Math.max(0, x - ix - 1));
      const top = src[ya + xa]! * (1 - fx) + src[ya + xb]! * fx;
      const bot = src[yb + xa]! * (1 - fx) + src[yb + xb]! * fx;
      out[y * w + x] = top * (1 - fy) + bot * fy;
    }
  }
  return out;
}

/** Grow a coverage plane by r pixels (anti-aliased, distance based). */
function growPlane(p: Float32Array, w: number, h: number, r: number): void {
  if (r <= 0) return;
  const d = distanceTo((i) => p[i]! >= 0.5, w, h);
  for (let i = 0; i < p.length; i++) { const g = clamp01(r + 0.5 - d[i]!); if (g > p[i]!) p[i] = g; }
}

/** Grain: v × (1 − noise × hash), stable per document pixel. */
function applyNoise(c: Ctx, p: Float32Array, noise: number | undefined, seed: number): void {
  if (!noise || noise <= 0) return;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const i = y * c.w + x;
    p[i] = p[i]! * (1 - noise * hash01(c.r.x + x, c.r.y + y, seed));
  }
}

/** Straight RGBA of a solid color with alpha = plane × color alpha. */
function colorize(p: Float32Array, color: RGBA, out: Float32Array): Float32Array {
  const ca = color[3]!;
  for (let i = 0, o = 0; i < p.length; i++, o += 4) { out[o] = color[0]!; out[o + 1] = color[1]!; out[o + 2] = color[2]!; out[o + 3] = p[i]! * ca; }
  return out;
}

const lightAngle = (doc: ImageDocument, angle: number, global: boolean | undefined): number => (global ? doc.globalLight.angle : angle);

// ——— shadows ———

function shadowPlane(c: Ctx, fx: ShadowFx, inner: boolean): Float32Array {
  const size = fx.size * c.k, dist = fx.distance * c.k, spread = clamp01(fx.spread);
  const a = lightAngle(c.doc, fx.angle, fx.globalLight) * RAD;
  const src = inner ? c.A.map((v) => 1 - v) : c.A;
  const p = shift(src, c.w, c.h, -Math.cos(a) * dist, Math.sin(a) * dist);
  growPlane(p, c.w, c.h, size * spread);
  blurPlane(p, c.w, c.h, size * (1 - spread));
  applyLut(p, contourLut(fx.contour));
  applyNoise(c, p, fx.noise, inner ? 11 : 13);
  if (!inner && fx.knockout) for (let i = 0; i < p.length; i++) p[i] = p[i]! * (1 - c.A[i]!);
  return p;
}

// ——— glows ———

function glowPlane(c: Ctx, fx: GlowFx, inner: boolean): Float32Array {
  const size = Math.max(0, fx.size * c.k), spread = clamp01(fx.spread);
  let p: Float32Array;
  if (fx.technique === "precise") {
    const d = inner ? distIn(c) : distOut(c), s0 = size * spread, span = Math.max(1e-6, size - s0);
    p = new Float32Array(c.n);
    // distances are between pixel centers: the first pixel past the edge is 1 away
    for (let i = 0; i < c.n; i++) { const dd = Math.max(0, d[i]! - 1); p[i] = dd <= s0 ? 1 : clamp01(1 - (dd - s0) / span); }
    if (!inner) for (let i = 0; i < c.n; i++) if (c.A[i]! > p[i]!) p[i] = c.A[i]!;
  } else {
    p = inner ? c.A.map((v) => 1 - v) : c.A.slice();
    growPlane(p, c.w, c.h, size * spread);
    blurPlane(p, c.w, c.h, size * (1 - spread));
  }
  if (inner && fx.source === "center") for (let i = 0; i < c.n; i++) p[i] = 1 - p[i]!;
  const lut = contourLut(fx.contour);
  if (lut) {
    const range = fx.range && fx.range > 0 ? fx.range : 1;
    for (let i = 0; i < c.n; i++) p[i] = lut[Math.round(clamp01(p[i]! / range) * 255)]!;
  }
  applyNoise(c, p, fx.noise, inner ? 17 : 19);
  return p;
}

/** Glow pixels: a solid color, or a gradient from the source (t = 0) outwards with jitter. */
function glowPixels(c: Ctx, fx: GlowFx, p: Float32Array, out: Float32Array): Float32Array {
  if (!fx.gradient || fx.color) return colorize(p, fx.color ?? [1, 1, 1, 1], out);
  const lut = gradientLut(fx.gradient, 256), jitter = fx.jitter ?? 0;
  for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
    const i = y * c.w + x, o = i * 4;
    let t = 1 - p[i]!;
    if (jitter > 0) t += (hash01(c.r.x + x, c.r.y + y, 23) - 0.5) * jitter;
    const g = Math.round(clamp01(t) * 255) * 4;
    out[o] = lut[g]!; out[o + 1] = lut[g + 1]!; out[o + 2] = lut[g + 2]!; out[o + 3] = p[i]! * lut[g + 3]!;
  }
  return out;
}

// ——— satin ———

function satinPlane(c: Ctx, fx: SatinFx): Float32Array {
  const a = fx.angle * RAD, d = fx.distance * c.k, size = fx.size * c.k;
  const dx = Math.cos(a) * d, dy = -Math.sin(a) * d;
  const s1 = shift(c.A, c.w, c.h, dx, dy), s2 = shift(c.A, c.w, c.h, -dx, -dy);
  blurPlane(s1, c.w, c.h, size);
  blurPlane(s2, c.w, c.h, size);
  for (let i = 0; i < c.n; i++) s1[i] = Math.abs(s1[i]! - s2[i]!);
  applyLut(s1, contourLut(fx.contour));
  if (fx.invert) for (let i = 0; i < c.n; i++) s1[i] = 1 - s1[i]!;
  return s1;
}

// ——— bevel & emboss ———

interface Shading { hi: Float32Array; sh: Float32Array }

/** Highlight / shadow amounts of a bevel. `strokeCov` is the stroke's coverage for "stroke" emboss. */
function bevelShading(c: Ctx, fx: BevelFx, strokeCov: Float32Array | null): Shading {
  const size = Math.max(1, fx.size * c.k), half = size / 2, n = c.n;
  const t = new Float32Array(n);
  if (fx.style === "stroke") {
    if (strokeCov) {
      const d = distanceTo((i) => strokeCov[i]! < 0.5, c.w, c.h);
      for (let i = 0; i < n; i++) t[i] = clamp01((d[i]! - 0.5) / size);
    }
  } else {
    const din = distIn(c), dout = distOut(c);
    for (let i = 0; i < n; i++) {
      const inside = c.A[i]! >= 0.5;
      switch (fx.style) {
        case "inner": t[i] = inside ? clamp01((din[i]! - 0.5) / size) : 0; break;
        case "outer": t[i] = inside ? 1 : 1 - clamp01((dout[i]! - 0.5) / size); break;
        case "emboss": t[i] = inside ? 0.5 + 0.5 * clamp01((din[i]! - 0.5) / half) : 0.5 - 0.5 * clamp01((dout[i]! - 0.5) / half); break;
        case "pillow": t[i] = inside ? clamp01((din[i]! - 0.5) / half) : clamp01((dout[i]! - 0.5) / half); break;
      }
    }
  }
  if (fx.technique === "smooth") {
    for (let i = 0; i < n; i++) t[i] = Math.sin(t[i]! * Math.PI / 2);
    blurPlane(t, c.w, c.h, Math.max(1, size / 4));
  } else if (fx.technique === "chisel-soft") blurPlane(t, c.w, c.h, 1.5);
  // height in pixels
  const sign = fx.direction === "down" ? -1 : 1, hs = sign * size * fx.depth;
  for (let i = 0; i < n; i++) t[i] = t[i]! * hs;
  if (fx.texture) {
    const tex = c.tmp;
    renderPattern(fx.texture.pattern, fx.texture.scale || 1, c.r, tex);
    const td = fx.texture.depth * size * 0.25 * sign;
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      if (c.A[i]! <= 0) continue;
      const lum = 0.299 * tex[o]! + 0.587 * tex[o + 1]! + 0.114 * tex[o + 2]!;
      t[i] = t[i]! + (lum - 0.5) * td * c.A[i]!;
    }
  }
  const a = lightAngle(c.doc, fx.angle, fx.globalLight) * RAD, alt = (fx.globalLight ? c.doc.globalLight.altitude : fx.altitude) * RAD;
  const lx = Math.cos(alt) * Math.cos(a), ly = -Math.cos(alt) * Math.sin(a), lz = Math.sin(alt);
  const lut = contourLut(fx.contour);
  const flat = lut ? lut[Math.round(clamp01(lz) * 255)]! : lz;
  const hi = new Float32Array(n), sh = new Float32Array(n);
  const w = c.w, h = c.h;
  for (let y = 0; y < h; y++) {
    const yu = Math.max(0, y - 1) * w, yd = Math.min(h - 1, y + 1) * w, row = y * w;
    for (let x = 0; x < w; x++) {
      const gx = (t[row + Math.min(w - 1, x + 1)]! - t[row + Math.max(0, x - 1)]!) / 2;
      const gy = (t[yd + x]! - t[yu + x]!) / 2;
      if (gx === 0 && gy === 0) continue;
      let s = (-gx * lx - gy * ly + lz) / Math.sqrt(gx * gx + gy * gy + 1);
      if (lut) s = lut[Math.round(clamp01(s) * 255)]!;
      if (s > flat) hi[row + x] = clamp01((s - flat) / Math.max(1e-6, 1 - flat));
      else sh[row + x] = clamp01((flat - s) / Math.max(1e-6, flat));
    }
  }
  const soften = fx.soften * c.k;
  if (soften > 0) { blurPlane(hi, w, h, soften); blurPlane(sh, w, h, soften); }
  return { hi, sh };
}

// ——— stroke ———

function strokeCoverage(c: Ctx, fx: StrokeFx): Float32Array {
  const size = fx.size * c.k, n = c.n, S = new Float32Array(n), A = c.A;
  if (fx.position === "outside") {
    const d = distOut(c);
    // the shape's interior stays free (fill opacity shows through), its anti-aliased edge is backed by the stroke
    for (let i = 0; i < n; i++) S[i] = A[i]! >= 0.999 ? 0 : A[i]! >= 0.5 ? 1 : clamp01(size + 1 - d[i]!);
  } else if (fx.position === "inside") {
    const d = distIn(c);
    for (let i = 0; i < n; i++) S[i] = A[i]! >= 0.5 ? clamp01(size + 1 - d[i]!) * A[i]! : 0;
  } else {
    const din = distIn(c), dout = distOut(c), half = size / 2;
    for (let i = 0; i < n; i++) S[i] = A[i]! >= 0.5 ? clamp01(half + 1 - din[i]!) : clamp01(half + 1 - dout[i]!);
  }
  return S;
}

function strokePixels(c: Ctx, fx: StrokeFx, S: Float32Array, box: Rect): Float32Array {
  const out = new Float32Array(c.n * 4), f = fx.fill;
  if (f.type === "color") return colorize(S, f.color, out);
  if (f.type === "gradient") renderGradient(f.gradient, c.r, out, box);
  else renderPattern(f.pattern, f.scale, c.r, out);
  for (let i = 0; i < c.n; i++) out[i * 4 + 3] = out[i * 4 + 3]! * S[i]!;
  return out;
}

// ——— layer bounds (relative gradients) ———

const boxCache = new WeakMap<object, { v: number; r: Rect | null }>();

function layerBox(doc: ImageDocument, l: Layer): Rect {
  if (hasRaster(l)) {
    let e = boxCache.get(l.raster);
    if (!e || e.v !== l.raster.version) { e = { v: l.raster.version, r: l.raster.bounds() }; boxCache.set(l.raster, e); }
    if (e.r) return e.r;
  }
  return doc.bounds;
}

// ——— the hook ———

const noFx = (s: LayerStyle): boolean => !s.enabled;
const on = <T extends { enabled: boolean }>(list: T[] | undefined): T[] => (list ? list.filter((f) => f.enabled).reverse() : []);

/** The passes of a layer's effects over `r` (the compositor's region grown by styleHalo); `px` is straight RGBA. */
export function renderStyles(doc: ImageDocument, layer: Layer, px: Float32Array, r: Rect): StylePass[] {
  const s = layer.styles;
  if (!s || noFx(s)) return [];
  const n = r.w * r.h;
  const A = new Float32Array(n);
  for (let i = 0; i < n; i++) A[i] = px[i * 4 + 3]!;
  const c: Ctx = { doc, layer, r, w: r.w, h: r.h, n, A, k: s.scale ?? 1, dOut: null, dIn: null, tmp: new Float32Array(n * 4) };
  const under: StylePass[] = [], over: StylePass[] = [];
  let box: Rect | null = null;
  const getBox = (): Rect => (box ??= layerBox(doc, layer));

  // under: drop shadows, outer glow
  for (const fx of on(s.dropShadow)) under.push({ px: colorize(shadowPlane(c, fx, false), fx.color, new Float32Array(n * 4)), blend: fx.blend, opacity: fx.opacity, place: "under" });
  if (s.outerGlow?.enabled) {
    const g = s.outerGlow;
    under.push({ px: glowPixels(c, g, glowPlane(c, g, false), new Float32Array(n * 4)), blend: g.blend, opacity: g.opacity, place: "under" });
  }

  // interior effects, bottom to top, each composited inside the layer's alpha
  const interior: { blend: BlendMode; opacity: number; draw: (out: Float32Array) => void }[] = [];
  if (s.patternOverlay?.enabled) {
    const p = s.patternOverlay;
    interior.push({ blend: p.blend, opacity: p.opacity, draw: (o) => renderPattern(p.value.pattern, p.value.scale, r, o) });
  }
  for (const g of on(s.gradientOverlay)) interior.push({ blend: g.blend, opacity: g.opacity, draw: (o) => renderGradient(g.value, r, o, getBox()) });
  for (const co of on(s.colorOverlay)) interior.push({ blend: co.blend, opacity: co.opacity, draw: (o) => { const v = co.value; for (let i = 0; i < o.length; i += 4) { o[i] = v[0]!; o[i + 1] = v[1]!; o[i + 2] = v[2]!; o[i + 3] = v[3]!; } } });
  if (s.satin?.enabled) { const f = s.satin; interior.push({ blend: f.blend, opacity: f.opacity, draw: (o) => colorize(satinPlane(c, f), f.color, o) }); }
  if (s.innerGlow?.enabled) { const g = s.innerGlow; interior.push({ blend: g.blend, opacity: g.opacity, draw: (o) => glowPixels(c, g, glowPlane(c, g, true), o) }); }
  for (const fx of on(s.innerShadow)) interior.push({ blend: fx.blend, opacity: fx.opacity, draw: (o) => colorize(shadowPlane(c, fx, true), fx.color, o) });

  // strokes (needed before the bevel for stroke emboss)
  const strokes = on(s.stroke).map((fx) => ({ fx, S: strokeCoverage(c, fx) }));

  const bv = s.bevel?.enabled ? s.bevel : null;
  if (bv) {
    const strokeCov = bv.style === "stroke" ? strokes[0]?.S ?? null : null;
    const { hi, sh } = bevelShading(c, bv, strokeCov);
    const parts: [Shading[keyof Shading], BevelFx["highlight"]][] = [[sh, bv.shadow], [hi, bv.highlight]];
    if (bv.style === "stroke") {
      if (strokeCov) for (const [p, m] of parts) {
        const q = p.slice();
        for (let i = 0; i < n; i++) q[i] = q[i]! * strokeCov[i]!;
        over.push({ px: colorize(q, m.color, new Float32Array(n * 4)), blend: m.blend, opacity: m.opacity, place: "over" });
      }
    } else {
      if (bv.style !== "outer") for (const [p, m] of parts) interior.push({ blend: m.blend, opacity: m.opacity, draw: (o) => colorize(p, m.color, o) });
      if (bv.style !== "inner") for (const [p, m] of parts) {
        const q = new Float32Array(n);
        for (let i = 0; i < n; i++) q[i] = p[i]! * (1 - A[i]!);
        under.push({ px: colorize(q, m.color, new Float32Array(n * 4)), blend: m.blend, opacity: m.opacity, place: "under" });
      }
    }
  }

  // strokes: outside ones back the layer (under), inside / center ones cover it (over); stroke emboss lies above them
  const strokePasses: StylePass[] = strokes.map(({ fx, S }) => ({ px: strokePixels(c, fx, S, getBox()), blend: fx.blend, opacity: fx.opacity, place: fx.position === "outside" ? "under" : "over" }));
  under.push(...strokePasses.filter((p) => p.place === "under"));
  over.unshift(...strokePasses.filter((p) => p.place === "over"));

  const passes: StylePass[] = [...under];
  if (interior.length) {
    // the layer at its fill opacity, then each interior effect inside its alpha; coverage never exceeds the layer's
    const fill = layer.fill;
    const base = new Float32Array(n * 4);
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      const a = A[i]! * fill;
      base[o] = px[o]! * a; base[o + 1] = px[o + 1]! * a; base[o + 2] = px[o + 2]! * a; base[o + 3] = a;
    }
    const tmp = c.tmp;
    for (const e of interior) {
      tmp.fill(0);
      e.draw(tmp);
      compositeInto(base, tmp, { mode: e.blend, opacity: e.opacity, mask: A, x: r.x, y: r.y, w: r.w });
    }
    for (let i = 0, o = 0; i < n; i++, o += 4) {
      const a = base[o + 3]!;
      if (a <= 0) continue;
      const cap = Math.min(a, A[i]!), k = 1 / a;
      base[o] = base[o]! * k; base[o + 1] = base[o + 1]! * k; base[o + 2] = base[o + 2]! * k; base[o + 3] = cap;
    }
    passes.push({ px: base, blend: "normal", opacity: 1, place: "content" });
  }
  passes.push(...over);
  return passes;
}

/** Register the renderer with the compositor. */
export function installStyles(): void { renderHooks.styles = renderStyles; }

