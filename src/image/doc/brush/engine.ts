// The brush engine: turns pointer samples into dabs and dabs into pixels.
//
// Samples → smoothing (moving average or lazy rope, catch-up at the end) → interpolation along the path (position and
// pen data) → spacing (a dab every `spacing × size` pixels) → dynamics (size / angle / roundness / scatter / color /
// opacity / flow, each driven by off, fade, pressure, tilt, rotation, wheel, direction or initial direction) →
// symmetry copies → dab alpha (tip, texture, dual tip, noise, wet edges) → the stroke buffer.
//
// The stroke buffer is a sparse set of 256² premultiplied RGBA tiles in document space: dabs accumulate there (flow;
// build-up or strongest-dab-wins), and after each segment the touched rectangles are composited once onto the
// pixels the layer had when the stroke began, with the stroke's opacity as a cap and the tool's blend mode (plus
// "behind" and "clear"). So overlapping dabs inside one stroke never exceed the opacity. The pre-stroke pixels are
// the tile arrays the history journal keeps anyway (no copy). Writes honour the selection, the transparency lock (alpha
// kept), the background layer (erasing paints the background color) and can target the layer mask instead.
// Retouch tools use "direct" dabs: each dab reads the current pixels, a callback changes them, and they are written
// back (blur, smudge, dodge, sponge, mixer…). The caller owns the history step (doc.begin on down, doc.commit on up).

import { compositeInto, hash01, type BlendMode } from "../blend.ts";
import { maskCoverage } from "../alpha.ts";
import type { ImageDocument } from "../document.ts";
import { hasRaster, type Layer, type Pattern, type RGBA } from "../layers.ts";
import { builtinPatterns } from "../paint.ts";
import { Mask, TILE, TiledRaster, currentEdit, tileKey, type PixelArray, type Rect } from "../tiles.ts";
import { dabRect, rasterDab, rng, tipShape, type DabGeometry, type TipShape } from "./tips.ts";
import type { BrushControl, BrushPreset, TextureSettings } from "./presets.ts";

/** A brush's paint mode: a layer blend mode, or "behind" (only under existing paint) and "clear" (erase). */
export type PaintMode = BlendMode | "behind" | "clear";
/** Where painting lands. */
export type PaintTarget = "layer" | "mask";

/** One pointer sample as the engine reads it. */
export interface BrushSample {
  x: number;
  y: number;
  /** 0–1. */
  pressure: number;
  tiltX?: number | undefined;
  tiltY?: number | undefined;
  /** Barrel rotation, degrees. */
  twist?: number | undefined;
  /** Airbrush stylus wheel 0–1. */
  wheel?: number | undefined;
  pointerType?: "mouse" | "pen" | "touch" | undefined;
}

export type SymmetryType = "vertical" | "horizontal" | "both" | "diagonal" | "radial" | "mandala";
/** Paint symmetry about a center. @tr Boya simetrisi. */
export interface Symmetry {
  type: SymmetryType;
  cx: number;
  cy: number;
  /** Radial / mandala segments (2–12). */
  segments?: number | undefined;
  /** Axis rotation in degrees. */
  angle?: number | undefined;
}

/** What a direct dab callback gets about the dab. */
export interface DabInfo {
  x: number;
  y: number;
  size: number;
  /** Radians. */
  angle: number;
  pressure: number;
  /** Dab number in the stroke (0 = first). */
  index: number;
  /** Unit stroke direction (0, 0 before the pointer moved). */
  dirX: number;
  dirY: number;
  color: RGBA;
  /** Index of the symmetry copy (0 = the original). */
  copy: number;
}

/**
 * A retouch dab: `px` holds the current straight RGBA of `r` (the layer, or the mask as gray); change it in place.
 * `a` is the dab's alpha (tip × flow × pressure) per pixel.
 */
export type DirectDab = (r: Rect, px: Float32Array, a: Float32Array, info: DabInfo) => void;

export interface StrokeSettings {
  preset: BrushPreset;
  /** Diameter override (the options bar size). */
  size?: number | undefined;
  /** Hardness override for round tips (0–1). */
  hardness?: number | undefined;
  /** Angle (degrees) / roundness (0–1) overrides. */
  angle?: number | undefined;
  roundness?: number | undefined;
  /** Spacing override (fraction of the size). */
  spacing?: number | undefined;
  /** 0–1: the stroke's maximum coverage. */
  opacity?: number | undefined;
  /** 0–1: coverage each dab adds. */
  flow?: number | undefined;
  mode?: PaintMode | undefined;
  fg?: RGBA | undefined;
  bg?: RGBA | undefined;
  /** Smoothing 0–1 and how (moving average or a lazy rope / pulled string). */
  smoothing?: number | undefined;
  smoothingMode?: "average" | "rope" | undefined;
  /** Finish the stroke at the pointer (smoothing catch-up). */
  catchUp?: boolean | undefined;
  symmetry?: Symmetry | null | undefined;
  airbrush?: boolean | undefined;
  /** Pen pressure drives size / opacity (options bar buttons), overriding the preset's control. */
  pressureSize?: boolean | undefined;
  pressureOpacity?: boolean | undefined;
  /** No anti-aliasing (pencil). */
  aliased?: boolean | undefined;
  target?: PaintTarget | undefined;
  /** View zoom (the rope length is in screen pixels). */
  zoom?: number | undefined;
  /** Per-pixel paint (clone, pattern, history): fill straight RGBA for a document rectangle. Alpha thins the dab. */
  source?: ((r: Rect, out: Float32Array, info: DabInfo) => void) | undefined;
  /** Retouch tools: change pixels directly per dab (no stroke buffer, no opacity cap). */
  direct?: DirectDab | undefined;
  /** Every dab's alpha (spot healing collects the stroke region). */
  collect?: ((r: Rect, a: Float32Array) => void) | undefined;
  /** Extra patterns for textures (ids looked up here first, then the built-ins). */
  patterns?: Pattern[] | undefined;
  /** The texture shared by presets with "protect texture". */
  protectedTexture?: TextureSettings | undefined;
  seed?: number | undefined;
  /** false: dabs are only collected (spot healing marks its region; the pixels change at the end). */
  paint?: boolean | undefined;
  /** The stroke places no dabs of its own: the tool calls stamp() (art history brush). */
  manual?: boolean | undefined;
  /** Called with each rectangle that changed (only touched tiles). */
  invalidate?: ((r: Rect) => void) | undefined;
}

// ——— the surface: original pixels, current pixels, guarded writes ———

const lum = (r: number, g: number, b: number): number => 0.3 * r + 0.59 * g + 0.11 * b;

/** Why a layer cannot be painted (null = it can). English text the UI translates. */
export function paintBlocker(doc: ImageDocument, layer: Layer | null, target: PaintTarget = "layer"): string | null {
  if (!layer) return "Select a layer to paint on";
  if (target === "mask") return layer.mask ? null : "The layer has no mask";
  if (layer.kind !== "pixel") return hasRaster(layer) ? "Rasterize this layer to paint on it" : "This layer has no pixels to paint on";
  if (layer.locks.pixels) return "The layer's pixels are locked";
  if (!doc.visibleInTree(layer.id)) return "The layer is hidden";
  return null;
}

/** Read a rectangle of a raster through a tile getter (originals or live tiles) as straight float RGBA. */
function readTiles(raster: TiledRaster, r: Rect, out: Float32Array, get: (key: number) => PixelArray | null): void {
  out.fill(0, 0, r.w * r.h * 4);
  const inv = 1 / raster.max, rx = r.x - raster.ox, ry = r.y - raster.oy;
  const tx0 = Math.floor(rx / TILE), ty0 = Math.floor(ry / TILE), tx1 = Math.floor((rx + r.w - 1) / TILE), ty1 = Math.floor((ry + r.h - 1) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
    const t = get(tileKey(tx, ty));
    if (!t) continue;
    const sx0 = Math.max(rx, tx * TILE), sy0 = Math.max(ry, ty * TILE), sx1 = Math.min(rx + r.w, (tx + 1) * TILE), sy1 = Math.min(ry + r.h, (ty + 1) * TILE);
    for (let sy = sy0; sy < sy1; sy++) {
      let si = ((sy - ty * TILE) * TILE + (sx0 - tx * TILE)) * 4, di = ((sy - ry) * r.w + (sx0 - rx)) * 4;
      for (let sx = sx0; sx < sx1; sx++, si += 4, di += 4) {
        out[di] = t[si]! * inv; out[di + 1] = t[si + 1]! * inv; out[di + 2] = t[si + 2]! * inv; out[di + 3] = t[si + 3]! * inv;
      }
    }
  }
}

/**
 * The pixels a stroke paints: a pixel layer's raster or a layer mask. Keeps the pre-stroke pixels (by reference to
 * the journaled tiles), applies the selection, the transparency lock and the background rule on every write.
 */
export class PaintSurface {
  readonly doc: ImageDocument;
  readonly layer: Layer;
  readonly target: PaintTarget;
  readonly raster: TiledRaster | null;
  readonly mask: Mask | null;
  /** Alpha is kept (transparency lock or background layer). */
  readonly keepAlpha: boolean;
  readonly background: boolean;
  private orig = new Map<number, PixelArray | null>();
  private origMask: Uint8Array | null = null;
  private cov = new Float32Array(0);

  constructor(doc: ImageDocument, layer: Layer, target: PaintTarget = "layer") {
    this.doc = doc;
    this.layer = layer;
    this.target = target;
    if (target === "mask") {
      const m = layer.mask!.mask;
      this.mask = m;
      this.raster = null;
      const ed = currentEdit();
      // the journal keeps the current array when the mask is first written in this edit: no copy needed then
      this.origMask = ed && !ed.masks.has(m) ? m.data : m.data.slice();
      this.keepAlpha = false;
      this.background = false;
    } else {
      this.mask = null;
      this.raster = (layer as { raster: TiledRaster }).raster;
      this.background = doc.isBackground(layer);
      this.keepAlpha = layer.locks.transparency || this.background;
    }
  }

  private origTile(k: number): PixelArray | null {
    let t = this.orig.get(k);
    if (t !== undefined) return t;
    const live = this.raster!.tiles.get(k) ?? null, ed = currentEdit();
    // untouched in the open edit → the first write copies the tile and the journal keeps this array unchanged
    const kept = !!ed && !ed.touched.get(this.raster!)?.has(k);
    t = live && !kept ? live.slice() : live;
    this.orig.set(k, t);
    return t;
  }

  /** Pixels as they were when the stroke began (straight RGBA; a mask reads as opaque gray). */
  readOriginal(r: Rect, out: Float32Array): Float32Array {
    if (this.mask) this.readMaskInto(this.origMask!, r, out);
    else readTiles(this.raster!, r, out, (k) => this.origTile(k));
    return out;
  }

  /** Pixels as they are now. */
  readCurrent(r: Rect, out: Float32Array): Float32Array {
    if (this.mask) this.readMaskInto(this.mask.data, r, out);
    else {
      // capture originals of these tiles first (a direct dab may be the first write)
      const rx = r.x - this.raster!.ox, ry = r.y - this.raster!.oy;
      for (let ty = Math.floor(ry / TILE); ty <= Math.floor((ry + r.h - 1) / TILE); ty++) for (let tx = Math.floor(rx / TILE); tx <= Math.floor((rx + r.w - 1) / TILE); tx++) this.origTile(tileKey(tx, ty));
      this.raster!.read(r.x, r.y, r.w, r.h, out);
    }
    return out;
  }

  private readMaskInto(d: Uint8Array, r: Rect, out: Float32Array): void {
    const m = this.mask!, inv = 1 / 255;
    for (let y = 0, i = 0; y < r.h; y++) {
      const sy = r.y + y;
      for (let x = 0; x < r.w; x++, i += 4) {
        const sx = r.x + x;
        const v = (sx < 0 || sy < 0 || sx >= m.width || sy >= m.height ? m.outside : d[sy * m.width + sx]!) * inv;
        out[i] = v; out[i + 1] = v; out[i + 2] = v; out[i + 3] = 1;
      }
    }
  }

  /**
   * Write `res` over `r`. `base` is what the pixels were before this change (the stroke's originals, or the current
   * pixels for a direct dab): the selection mixes between the two (premultiplied), the alpha lock keeps base alpha.
   * `useSelection` false writes outside the selection too (patch destination, content-aware move).
   */
  commit(r: Rect, res: Float32Array, base: Float32Array, useSelection = true): void {
    const n = r.w * r.h, sel = useSelection ? this.doc.selection : null;
    if (sel) {
      if (this.cov.length < n) this.cov = new Float32Array(n);
      const cov = maskCoverage(sel, r, this.cov);
      for (let p = 0; p < n; p++) {
        const s = cov[p]!;
        if (s >= 1) continue;
        const i = p << 2, ba = base[i + 3]!, ra = res[i + 3]!;
        const oa = ba + (ra - ba) * s;
        if (oa <= 0) { res[i] = res[i + 1] = res[i + 2] = res[i + 3] = 0; continue; }
        const k = 1 / oa;
        res[i] = (base[i]! * ba + (res[i]! * ra - base[i]! * ba) * s) * k;
        res[i + 1] = (base[i + 1]! * ba + (res[i + 1]! * ra - base[i + 1]! * ba) * s) * k;
        res[i + 2] = (base[i + 2]! * ba + (res[i + 2]! * ra - base[i + 2]! * ba) * s) * k;
        res[i + 3] = oa;
      }
    }
    if (this.keepAlpha) {
      for (let i = 0; i < n * 4; i += 4) {
        const ba = base[i + 3]!;
        if (ba <= 0) { res[i] = res[i + 1] = res[i + 2] = res[i + 3] = 0; }
        else if (res[i + 3]! <= 0) { res[i] = base[i]!; res[i + 1] = base[i + 1]!; res[i + 2] = base[i + 2]!; res[i + 3] = ba; }
        else res[i + 3] = ba;
      }
    }
    if (this.mask) {
      const m = this.mask, d = m.writable();
      const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(m.width, r.x + r.w), y1 = Math.min(m.height, r.y + r.h);
      for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
        const i = ((y - r.y) * r.w + (x - r.x)) * 4;
        const v = lum(res[i]!, res[i + 1]!, res[i + 2]!);
        d[y * m.width + x] = Math.round(Math.max(0, Math.min(1, v)) * 255);
      }
    } else this.raster!.write(r.x, r.y, r.w, r.h, res);
  }
}

// ——— textures ———

let builtins: Pattern[] | null = null;
const lumCache = new WeakMap<Pattern, Float32Array>();

function patternLum(p: Pattern): Float32Array {
  let l = lumCache.get(p);
  if (!l) {
    l = new Float32Array(p.width * p.height);
    for (let i = 0; i < l.length; i++) { const a = p.pixels[i * 4 + 3]!; l[i] = lum(p.pixels[i * 4]!, p.pixels[i * 4 + 1]!, p.pixels[i * 4 + 2]!) * a + (1 - a); }
    lumCache.set(p, l);
  }
  return l;
}

/** A pattern by id (extra libraries first, then the built-ins). */
export function findPattern(id: string, extra?: Pattern[] | undefined): Pattern | null {
  const hit = extra?.find((p) => p.id === id);
  if (hit) return hit;
  builtins ??= builtinPatterns();
  return builtins.find((p) => p.id === id) ?? null;
}

const c01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Apply a texture's modulation to one alpha value; t is the texture value 0–1 (1 = paper top / white). */
export function textureAlpha(mode: TextureSettings["mode"], a: number, t: number, depth: number): number {
  let f: number;
  switch (mode ?? "multiply") {
    case "multiply": f = a * t; break;
    case "subtract": f = Math.max(0, a - (1 - t)); break;
    case "height": f = c01((a - (1 - t)) * 2); break;
    case "linear-height": f = c01(a * (0.5 + t) - (1 - t) * 0.5); break;
    case "darken": f = Math.min(a, t); break;
    case "overlay": f = a < 0.5 ? 2 * a * t : 1 - 2 * (1 - a) * (1 - t); break;
    case "color-burn": f = t <= 0 ? 0 : 1 - Math.min(1, (1 - a) / t); break;
    case "linear-burn": f = Math.max(0, a + t - 1); break;
    case "hard-mix": f = a > 0 && a + t >= 1 ? 1 : 0; break;
    default: f = a * t;
  }
  return a + (f - a) * depth;
}

// ——— symmetry ———

interface Xform { m00: number; m01: number; m10: number; m11: number; /** degrees added to the dab angle, or the mirror axis */ rot: number; mirror: boolean; axis: number }

/** The transforms (identity first) of a symmetry. */
export function symmetryTransforms(s: Symmetry | null | undefined): Xform[] {
  const id: Xform = { m00: 1, m01: 0, m10: 0, m11: 1, rot: 0, mirror: false, axis: 0 };
  if (!s) return [id];
  const base = ((s.angle ?? 0) * Math.PI) / 180;
  const rot = (a: number): Xform => ({ m00: Math.cos(a), m01: -Math.sin(a), m10: Math.sin(a), m11: Math.cos(a), rot: a, mirror: false, axis: 0 });
  const mir = (axis: number): Xform => ({ m00: Math.cos(2 * axis), m01: Math.sin(2 * axis), m10: Math.sin(2 * axis), m11: -Math.cos(2 * axis), rot: 0, mirror: true, axis });
  const n = Math.max(2, Math.min(32, Math.round(s.segments ?? 6)));
  switch (s.type) {
    case "vertical": return [id, mir(base + Math.PI / 2)];
    case "horizontal": return [id, mir(base)];
    case "both": return [id, mir(base + Math.PI / 2), mir(base), rot(Math.PI)];
    case "diagonal": return [id, mir(base + Math.PI / 4)];
    case "radial": return Array.from({ length: n }, (_, k) => (k ? rot((k * 2 * Math.PI) / n) : id));
    case "mandala": {
      const out: Xform[] = [];
      for (let k = 0; k < n; k++) { out.push(k ? rot((k * 2 * Math.PI) / n) : id); out.push(mir(base + (k * Math.PI) / n)); }
      return out;
    }
  }
}

// ——— colors ———

function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d > 0) h = mx === r ? ((g - b) / d + 6) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, mx > 0 ? d / mx : 0, mx];
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
  h = ((h % 1) + 1) % 1;
  const i = Math.floor(h * 6), f = h * 6 - i, p = v * (1 - s), q = v * (1 - f * s), t = v * (1 - (1 - f) * s);
  switch (i % 6) { case 0: return [v, t, p]; case 1: return [q, v, p]; case 2: return [p, v, t]; case 3: return [p, q, v]; case 4: return [t, p, v]; default: return [v, p, q]; }
}

// ——— the stroke ———

/** Stroke-buffer tiles kept between strokes (1 MB each), so a new stroke rarely allocates. */
const tilePool: Float32Array[] = [];
const POOL_MAX = 24;
const takeTile = (): Float32Array => { const t = tilePool.pop(); if (t) { t.fill(0); return t; } return new Float32Array(TILE * TILE * 4); };

interface PenState { x: number; y: number; pressure: number; tiltX: number; tiltY: number; twist: number; wheel: number }

const toPen = (p: BrushSample): PenState => ({
  x: p.x, y: p.y,
  // a mouse has no pressure: it paints at full pressure
  pressure: p.pointerType === "mouse" ? 1 : Math.max(0, Math.min(1, p.pressure)),
  tiltX: p.tiltX ?? 0, tiltY: p.tiltY ?? 0, twist: p.twist ?? 0, wheel: p.wheel ?? 1,
});

const lerpPen = (a: PenState, b: PenState, t: number): PenState => ({
  x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, pressure: a.pressure + (b.pressure - a.pressure) * t,
  tiltX: a.tiltX + (b.tiltX - a.tiltX) * t, tiltY: a.tiltY + (b.tiltY - a.tiltY) * t, twist: a.twist + (b.twist - a.twist) * t, wheel: a.wheel + (b.wheel - a.wheel) * t,
});

/** A stroke in progress. Create on pointer down, feed samples, end on pointer up. */
export class BrushStroke {
  readonly surface: PaintSurface;
  readonly s: StrokeSettings;
  readonly preset: BrushPreset;
  private tip: TipShape | null;
  private dualTip: TipShape | null;
  private rand: () => number;
  private xforms: Xform[];
  private mode: PaintMode;
  private color: RGBA;
  private opacity: number;
  private flow: number;
  private size: number;
  private hardness: number;
  private spacing: number;
  private texture: TextureSettings | null;
  private texLum: Float32Array | null = null;
  private texPat: Pattern | null = null;
  private strokeTex = 1;
  /** Stroke buffer: premultiplied RGBA per document tile. */
  private tiles = new Map<number, Float32Array>();
  /** Touched rectangle per document tile: [x0, y0, x1, y1). */
  private dirty = new Map<number, [number, number, number, number]>();
  private last: PenState | null = null;
  private smoothPos: { x: number; y: number } | null = null;
  private raw: PenState | null = null;
  private carry = 0;
  private lastSize = 1;
  private dirX = 0;
  private dirY = 0;
  private initialDir: number | null = null;
  /** Dabs placed (fade counts these). */
  index = 0;
  private airAcc = 0;
  private alive = false;
  // scratch
  private aBuf = new Float32Array(64 * 64);
  private a2Buf = new Float32Array(64 * 64);
  private srcBuf = new Float32Array(64 * 64 * 4);
  private oBuf = new Float32Array(0);
  private rBuf = new Float32Array(0);
  private sBuf = new Float32Array(0);

  constructor(surface: PaintSurface, settings: StrokeSettings) {
    this.surface = surface;
    this.s = settings;
    const p = settings.preset;
    this.preset = p;
    this.tip = tipShape(p.tip);
    this.dualTip = p.dual ? tipShape(p.dual.tip) : null;
    this.rand = rng(settings.seed ?? ((Math.random() * 2 ** 31) | 0));
    this.xforms = symmetryTransforms(settings.symmetry);
    this.size = Math.max(0.5, settings.size ?? p.size);
    this.hardness = settings.hardness ?? (p.tip.type === "round" ? p.tip.hardness : 1);
    this.spacing = settings.spacing ?? p.spacing ?? 0.25;
    this.opacity = c01(settings.opacity ?? 1);
    this.flow = c01(settings.flow ?? 1);
    let mode: PaintMode = settings.mode ?? "normal";
    let fg: RGBA = settings.fg ?? [0, 0, 0, 1];
    // erasing where alpha cannot change (background, alpha lock) or on a mask paints the background color
    if (mode === "clear" && (surface.keepAlpha || surface.mask)) { mode = "normal"; fg = settings.bg ?? [1, 1, 1, 1]; }
    if (surface.mask && mode !== "clear") mode = mode === "behind" ? "normal" : mode;
    this.mode = mode;
    this.color = [...fg] as RGBA;
    const tex = p.protectTexture && settings.protectedTexture ? settings.protectedTexture : p.texture ?? null;
    this.texture = tex;
    if (tex) {
      this.texPat = findPattern(tex.pattern, settings.patterns);
      this.texLum = this.texPat ? patternLum(this.texPat) : null;
    }
    // per-stroke color jitter
    if (p.color && !p.color.perTip) this.color = this.jitterColor(1);
  }

  /** Doc-space rectangle clipped to the canvas, or null. */
  private clip(r: Rect): Rect | null {
    const d = this.surface.doc;
    const x0 = Math.max(0, r.x), y0 = Math.max(0, r.y), x1 = Math.min(d.width, r.x + r.w), y1 = Math.min(d.height, r.y + r.h);
    return x1 > x0 && y1 > y0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }

  private control(c: BrushControl | undefined, pen: PenState, fadeSteps: number): number {
    switch (c ?? "off") {
      case "off": return 1;
      case "fade": return Math.max(0, 1 - this.index / Math.max(1, fadeSteps));
      case "pressure": return pen.pressure;
      case "tilt": return c01(1 - Math.hypot(pen.tiltX, pen.tiltY) / 90);
      case "rotation": return (((pen.twist % 360) + 360) % 360) / 360;
      case "wheel": return c01(pen.wheel);
      case "direction": return ((Math.atan2(this.dirY, this.dirX) * 180) / Math.PI + 360) % 360 / 360;
      case "initial-direction": return (((this.initialDir ?? 0) * 180) / Math.PI + 360) % 360 / 360;
    }
  }

  /** Angle (radians) a control adds to the tip angle. */
  private angleControl(c: BrushControl | undefined, pen: PenState, fadeSteps: number): number {
    switch (c ?? "off") {
      case "off": return 0;
      case "fade": return (Math.min(1, this.index / Math.max(1, fadeSteps))) * Math.PI * 2;
      case "pressure": return pen.pressure * Math.PI * 2;
      case "tilt": return pen.tiltX || pen.tiltY ? Math.atan2(pen.tiltY, pen.tiltX) : 0;
      case "rotation": return (pen.twist * Math.PI) / 180;
      case "wheel": return pen.wheel * Math.PI * 2;
      case "direction": return this.dirX || this.dirY ? Math.atan2(this.dirY, this.dirX) : 0;
      case "initial-direction": return this.initialDir ?? 0;
    }
  }

  private jitterColor(ctrl: number): RGBA {
    const cd = this.preset.color, fg = this.s.fg ?? [0, 0, 0, 1], bg = this.s.bg ?? [1, 1, 1, 1];
    if (!cd) return [...this.color] as RGBA;
    const j = cd.fgBgJitter ?? 0;
    const t = cd.fgBgControl && cd.fgBgControl !== "off" ? (1 - ctrl) * (j || 1) : j * this.rand();
    let r = fg[0]! + (bg[0]! - fg[0]!) * t, g = fg[1]! + (bg[1]! - fg[1]!) * t, b = fg[2]! + (bg[2]! - fg[2]!) * t;
    let [h, s, v] = rgbToHsv(r, g, b);
    h += (this.rand() * 2 - 1) * (cd.hueJitter ?? 0) * 0.5;
    s = c01(s + (this.rand() * 2 - 1) * (cd.saturationJitter ?? 0));
    v = c01(v + (this.rand() * 2 - 1) * (cd.brightnessJitter ?? 0));
    if (cd.purity) s = c01(cd.purity > 0 ? s + (1 - s) * cd.purity : s * (1 + cd.purity));
    [r, g, b] = hsvToRgb(h, s, v);
    return [r, g, b, fg[3] ?? 1];
  }

  // ——— input ———

  /** Pointer down: the first dab. */
  begin(p: BrushSample): void {
    const pen = toPen(p);
    this.alive = true;
    this.raw = pen;
    this.smoothPos = { x: pen.x, y: pen.y };
    this.last = pen;
    this.carry = 0;
    this.placeDabs(pen);
    this.flush();
  }

  /** Pointer move. */
  move(p: BrushSample): void {
    if (!this.alive || !this.last) return;
    const pen = toPen(p);
    this.raw = pen;
    const sm = this.smoothTo(pen);
    if (!sm) { this.flush(); return; }
    this.lineTo({ ...pen, x: sm.x, y: sm.y });
    this.flush();
  }

  /** Pointer up: catch up with the pointer (when smoothing) and finish. */
  end(p?: BrushSample): void {
    if (!this.alive) return;
    if (p) this.raw = toPen(p);
    if ((this.s.catchUp ?? true) && this.raw && this.last && (this.raw.x !== this.last.x || this.raw.y !== this.last.y)) this.lineTo(this.raw);
    this.flush();
    this.alive = false;
    this.release();
  }

  /** Give the stroke buffer back to the pool (end() does this). */
  release(): void {
    for (const t of this.tiles.values()) if (tilePool.length < POOL_MAX) tilePool.push(t);
    this.tiles.clear();
  }

  /** Airbrush: build up while the pointer is held still. The UI calls this from its frame clock. */
  tick(dt: number): void {
    if (!this.alive || !(this.s.airbrush ?? this.preset.airbrush) || !this.last) return;
    this.airAcc += dt;
    const interval = 1000 / 30;
    let n = 0;
    while (this.airAcc >= interval && n < 8) { this.airAcc -= interval; this.placeDabs(this.last); n++; }
    if (n) this.flush();
  }

  /** One dab placed by a tool (art history brush): explicit position, size, color and alpha. */
  stamp(x: number, y: number, o: { size?: number | undefined; color?: RGBA | undefined; alpha?: number | undefined; angle?: number | undefined } = {}): void {
    const g: DabGeometry = { x, y, size: o.size ?? this.size, angle: o.angle ?? 0, roundness: 1, flipX: false, flipY: false };
    const pen: PenState = { x, y, pressure: 1, tiltX: 0, tiltY: 0, twist: 0, wheel: 1 };
    this.dab(g, o.color ?? this.color, o.alpha ?? 1, pen);
    this.index++;
  }

  /** Paint everything touched since the last flush (also called by move / end / tick). */
  flush(): void {
    for (const [k, d] of this.dirty) {
      const r: Rect = { x: d[0], y: d[1], w: d[2] - d[0], h: d[3] - d[1] };
      if (!this.s.direct && this.s.paint !== false) this.compositeTile(k, r);
      this.s.invalidate?.(r);
    }
    this.dirty.clear();
  }

  private smoothTo(pen: PenState): { x: number; y: number } | null {
    const amt = c01(this.s.smoothing ?? this.preset.smoothing ?? 0), sp = this.smoothPos!;
    if (amt <= 0) { sp.x = pen.x; sp.y = pen.y; return sp; }
    if ((this.s.smoothingMode ?? "rope") === "rope") {
      const rope = (amt * 80) / (this.s.zoom ?? 1);
      const dx = pen.x - sp.x, dy = pen.y - sp.y, d = Math.hypot(dx, dy);
      if (d <= rope) return null;
      const k = (d - rope) / d;
      sp.x += dx * k; sp.y += dy * k;
      return sp;
    }
    const k = 1 - amt * 0.9;
    sp.x += (pen.x - sp.x) * k; sp.y += (pen.y - sp.y) * k;
    return sp;
  }

  /** Walk from the last dab position to `to`, placing dabs every spacing step. */
  private lineTo(to: PenState): void {
    const from = this.last!;
    const dx = to.x - from.x, dy = to.y - from.y, len = Math.hypot(dx, dy);
    if (len < 1e-6) return;
    this.dirX = dx / len; this.dirY = dy / len;
    if (this.initialDir === null) this.initialDir = Math.atan2(dy, dx);
    if (this.spacing <= 0) { this.placeDabs(to); this.last = to; return; }
    let t = 0;
    for (;;) {
      const step = Math.max(0.5, this.spacing * this.lastSize);
      const need = step - this.carry;
      if (t + need / len > 1 + 1e-9) { this.carry += (1 - t) * len; break; }
      t += need / len;
      this.carry = 0;
      this.placeDabs(lerpPen(from, to, t));
    }
    this.last = to;
  }

  /** Dynamics for one spacing step: one or more dabs (scatter count), each copied by symmetry. */
  private placeDabs(pen: PenState): void {
    if (this.s.manual) { this.index++; return; }
    const p = this.preset, sh = p.shape ?? {}, fade = sh.fadeSteps ?? 25;
    const sizeCtl = this.s.pressureSize ? "pressure" : sh.sizeControl;
    const sc = p.scatter;
    let count = 1;
    if (sc) {
      count = Math.max(1, Math.round((sc.count ?? 1) * (1 - (sc.countJitter ?? 0) * this.rand()) * (sc.countControl && sc.countControl !== "off" ? this.control(sc.countControl, pen, fade) : 1)));
    }
    let baseSize = this.size;
    for (let c = 0; c < count; c++) {
      const sizeK = (sizeCtl && sizeCtl !== "off" ? (sh.minDiameter ?? 0) + (1 - (sh.minDiameter ?? 0)) * this.control(sizeCtl, pen, fade) : 1) * (1 - (sh.sizeJitter ?? 0) * this.rand());
      const size = Math.max(0.5, this.size * sizeK);
      baseSize = c === 0 ? size : baseSize;
      const angle = (((this.s.angle ?? p.angle ?? 0) * Math.PI) / 180) + (sh.angleJitter ?? 0) * (this.rand() * 2 - 1) * Math.PI + this.angleControl(sh.angleControl, pen, fade);
      const rc = sh.roundnessControl && sh.roundnessControl !== "off" ? (sh.minRoundness ?? 0.25) + (1 - (sh.minRoundness ?? 0.25)) * this.control(sh.roundnessControl, pen, fade) : 1;
      const roundness = Math.max(0.01, (this.s.roundness ?? p.roundness ?? 1) * rc * (1 - (sh.roundnessJitter ?? 0) * this.rand() * (1 - (sh.minRoundness ?? 0))));
      let x = pen.x, y = pen.y;
      if (sc && sc.amount > 0) {
        const k = sc.amount * size * (sc.control && sc.control !== "off" ? this.control(sc.control, pen, fade) : 1);
        const across = (this.rand() * 2 - 1) * k, along = sc.bothAxes ? (this.rand() * 2 - 1) * k : 0;
        const ux = this.dirX || 1, uy = this.dirX || this.dirY ? this.dirY : 0;
        x += -uy * across + ux * along; y += ux * across + uy * along;
      }
      const tr = p.transfer ?? {};
      const opCtl = this.s.pressureOpacity ? "pressure" : tr.opacityControl;
      const op = (opCtl && opCtl !== "off" ? (tr.minOpacity ?? 0) + (1 - (tr.minOpacity ?? 0)) * this.control(opCtl, pen, fade) : 1) * (1 - (tr.opacityJitter ?? 0) * this.rand());
      const fl = (tr.flowControl && tr.flowControl !== "off" ? (tr.minFlow ?? 0) + (1 - (tr.minFlow ?? 0)) * this.control(tr.flowControl, pen, fade) : 1) * (1 - (tr.flowJitter ?? 0) * this.rand());
      const color = p.color?.perTip ? this.jitterColor(this.control(p.color.fgBgControl, pen, fade)) : this.color;
      if (this.texture?.eachTip) {
        const t = this.texture;
        this.strokeTex = (t.depthControl && t.depthControl !== "off" ? (t.minDepth ?? 0) + (1 - (t.minDepth ?? 0)) * this.control(t.depthControl, pen, fade) : 1) * (1 - (t.depthJitter ?? 0) * this.rand());
      }
      const g: DabGeometry = {
        x, y, size, angle, roundness,
        flipX: !!p.flipX !== (!!sh.flipXJitter && this.rand() < 0.5),
        flipY: !!p.flipY !== (!!sh.flipYJitter && this.rand() < 0.5),
      };
      this.dab(g, color, op * fl, pen);
    }
    this.lastSize = baseSize;
    this.index++;
  }

  /** One dab and its symmetry copies. */
  private dab(g0: DabGeometry, color: RGBA, k: number, pen: PenState): void {
    const sym = this.s.symmetry;
    for (let c = 0; c < this.xforms.length; c++) {
      const xf = this.xforms[c]!;
      let g = g0;
      if (c > 0 && sym) {
        const dx = g0.x - sym.cx, dy = g0.y - sym.cy;
        g = {
          ...g0,
          x: sym.cx + xf.m00 * dx + xf.m01 * dy, y: sym.cy + xf.m10 * dx + xf.m11 * dy,
          angle: xf.mirror ? 2 * xf.axis - g0.angle : g0.angle + xf.rot,
          flipY: xf.mirror ? !g0.flipY : g0.flipY,
        };
      }
      this.oneDab(g, color, k, pen, c);
    }
  }

  private oneDab(g: DabGeometry, color: RGBA, k: number, pen: PenState, copy: number): void {
    const full = dabRect(g, this.tip), r = this.clip(full);
    if (!r) return;
    const n = r.w * r.h;
    if (this.aBuf.length < n) { this.aBuf = new Float32Array(n * 2); this.a2Buf = new Float32Array(n * 2); this.srcBuf = new Float32Array(n * 8); }
    const a = this.aBuf;
    const p = this.preset;
    rasterDab(g, this.tip, { hardness: this.hardness, aliased: this.s.aliased ?? p.aliased, wetEdges: p.wetEdges }, r, a);
    if (this.dualTip && p.dual) {
      const d = p.dual, a2 = this.a2Buf;
      const s = d.scatter ? d.scatter * g.size : 0;
      rasterDab({ x: g.x + (this.rand() * 2 - 1) * s, y: g.y + (this.rand() * 2 - 1) * s, size: d.size, angle: 0, roundness: 1, flipX: false, flipY: false }, this.dualTip, { hardness: 1 }, r, a2);
      for (let i = 0; i < n; i++) a[i] = a[i]! * a2[i]!;
    }
    if (this.texLum && this.texPat && this.texture) {
      const t = this.texture, pat = this.texPat, L = this.texLum, sc = Math.max(0.01, t.scale ?? 1);
      const depth = c01((t.depth ?? 1) * this.strokeTex), mode = t.mode, br = t.brightness ?? 0, ct = t.contrast ?? 0, inv = !!t.invert;
      for (let y = 0, i = 0; y < r.h; y++) {
        const py = ((Math.floor((r.y + y) / sc) % pat.height) + pat.height) % pat.height;
        for (let x = 0; x < r.w; x++, i++) {
          if (a[i]! <= 0) continue;
          const px = ((Math.floor((r.x + x) / sc) % pat.width) + pat.width) % pat.width;
          let tv = L[py * pat.width + px]!;
          if (inv) tv = 1 - tv;
          if (br || ct) tv = c01((tv - 0.5) * (1 + ct) + 0.5 + br);
          a[i] = textureAlpha(mode, a[i]!, tv, depth);
        }
      }
    }
    if (p.noise) {
      for (let y = 0, i = 0; y < r.h; y++) for (let x = 0; x < r.w; x++, i++) {
        const v = a[i]!;
        if (v > 0 && v < 1) a[i] = c01(v + (hash01(r.x + x, r.y + y, 11) - 0.5) * 4 * v * (1 - v));
      }
    }
    const info: DabInfo = { x: g.x, y: g.y, size: g.size, angle: g.angle, pressure: pen.pressure, index: this.index, dirX: this.dirX, dirY: this.dirY, color, copy };
    if (this.s.collect) this.s.collect(r, a.subarray(0, n));
    if (this.s.paint === false) { this.markDirty(r); return; }
    if (this.s.direct) {
      for (let i = 0; i < n; i++) a[i] = a[i]! * k * this.flow;
      this.directDab(r, a, info);
      return;
    }
    let src: Float32Array | null = null;
    if (this.s.source) {
      src = this.srcBuf;
      src.fill(0, 0, n * 4);
      this.s.source(r, src, info);
    }
    this.deposit(r, a, color, src, k * this.flow);
  }

  private markDirty(r: Rect): void {
    const tx0 = Math.floor(r.x / TILE), ty0 = Math.floor(r.y / TILE), tx1 = Math.floor((r.x + r.w - 1) / TILE), ty1 = Math.floor((r.y + r.h - 1) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const k = tileKey(tx, ty);
      const x0 = Math.max(r.x, tx * TILE), y0 = Math.max(r.y, ty * TILE), x1 = Math.min(r.x + r.w, (tx + 1) * TILE), y1 = Math.min(r.y + r.h, (ty + 1) * TILE);
      const d = this.dirty.get(k);
      if (!d) this.dirty.set(k, [x0, y0, x1, y1]);
      else { if (x0 < d[0]) d[0] = x0; if (y0 < d[1]) d[1] = y0; if (x1 > d[2]) d[2] = x1; if (y1 > d[3]) d[3] = y1; }
    }
  }

  /** Add a dab to the stroke buffer. */
  private deposit(r: Rect, a: Float32Array, color: RGBA, src: Float32Array | null, k: number): void {
    const buildUp = this.preset.buildUp ?? true;
    const cr = color[0]!, cg = color[1]!, cb = color[2]!, ca = color[3] ?? 1;
    const tx0 = Math.floor(r.x / TILE), ty0 = Math.floor(r.y / TILE), tx1 = Math.floor((r.x + r.w - 1) / TILE), ty1 = Math.floor((r.y + r.h - 1) / TILE);
    for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) {
      const key = tileKey(tx, ty);
      let T = this.tiles.get(key);
      if (!T) { T = takeTile(); this.tiles.set(key, T); }
      const x0 = Math.max(r.x, tx * TILE), y0 = Math.max(r.y, ty * TILE), x1 = Math.min(r.x + r.w, (tx + 1) * TILE), y1 = Math.min(r.y + r.h, (ty + 1) * TILE);
      for (let y = y0; y < y1; y++) {
        let i = (y - r.y) * r.w + (x0 - r.x);
        let j = ((y - ty * TILE) * TILE + (x0 - tx * TILE)) * 4;
        for (let x = x0; x < x1; x++, i++, j += 4) {
          let aa = a[i]! * k;
          if (aa <= 0) continue;
          let r_ = cr, g_ = cg, b_ = cb;
          if (src) { const si = i << 2; aa *= src[si + 3]!; r_ = src[si]!; g_ = src[si + 1]!; b_ = src[si + 2]!; } else aa *= ca;
          if (aa <= 0) continue;
          if (aa > 1) aa = 1;
          if (buildUp) {
            const ia = 1 - aa;
            T[j] = T[j]! * ia + r_ * aa; T[j + 1] = T[j + 1]! * ia + g_ * aa; T[j + 2] = T[j + 2]! * ia + b_ * aa; T[j + 3] = T[j + 3]! * ia + aa;
          } else if (aa > T[j + 3]!) {
            T[j] = r_ * aa; T[j + 1] = g_ * aa; T[j + 2] = b_ * aa; T[j + 3] = aa;
          }
        }
      }
    }
    this.markDirty(r);
  }

  private ensure(n: number): void {
    if (this.oBuf.length < n * 4) { this.oBuf = new Float32Array(n * 4); this.rBuf = new Float32Array(n * 4); this.sBuf = new Float32Array(n * 4); }
  }

  /** Composite the stroke buffer over the original pixels inside one tile's dirty rectangle. */
  private compositeTile(key: number, r: Rect): void {
    const T = this.tiles.get(key);
    if (!T) return;
    const n = r.w * r.h;
    this.ensure(n);
    const base = this.surface.readOriginal(r, this.oBuf.subarray(0, n * 4));
    const res = this.rBuf.subarray(0, n * 4), src = this.sBuf.subarray(0, n * 4);
    const tx = Math.floor(r.x / TILE) * TILE, ty = Math.floor(r.y / TILE) * TILE, op = this.opacity, mode = this.mode;
    for (let y = 0, i = 0; y < r.h; y++) {
      let j = ((r.y + y - ty) * TILE + (r.x - tx)) * 4;
      for (let x = 0; x < r.w; x++, i += 4, j += 4) {
        const sa = T[j + 3]!;
        if (sa > 0) { const k = 1 / sa; src[i] = T[j]! * k; src[i + 1] = T[j + 1]! * k; src[i + 2] = T[j + 2]! * k; src[i + 3] = sa; }
        else { src[i] = src[i + 1] = src[i + 2] = src[i + 3] = 0; }
      }
    }
    if (mode === "clear") {
      for (let i = 0; i < n * 4; i += 4) {
        res[i] = base[i]!; res[i + 1] = base[i + 1]!; res[i + 2] = base[i + 2]!;
        res[i + 3] = base[i + 3]! * (1 - op * src[i + 3]!);
      }
    } else if (mode === "behind") {
      for (let i = 0; i < n * 4; i += 4) {
        const ba = base[i + 3]!, sa = src[i + 3]! * op * (1 - ba), oa = ba + sa;
        if (oa <= 0) { res[i] = res[i + 1] = res[i + 2] = res[i + 3] = 0; continue; }
        const k = 1 / oa;
        res[i] = (base[i]! * ba + src[i]! * sa) * k; res[i + 1] = (base[i + 1]! * ba + src[i + 1]! * sa) * k; res[i + 2] = (base[i + 2]! * ba + src[i + 2]! * sa) * k; res[i + 3] = oa;
      }
    } else {
      for (let i = 0; i < n * 4; i += 4) { const ba = base[i + 3]!; res[i] = base[i]! * ba; res[i + 1] = base[i + 1]! * ba; res[i + 2] = base[i + 2]! * ba; res[i + 3] = ba; }
      compositeInto(res, src, { mode, opacity: op, x: r.x, y: r.y, w: r.w });
      for (let i = 0; i < n * 4; i += 4) {
        const a = res[i + 3]!;
        if (a > 0) { const k = 1 / a; res[i]! *= k; res[i + 1]! *= k; res[i + 2]! *= k; } else { res[i] = res[i + 1] = res[i + 2] = 0; }
      }
    }
    this.surface.commit(r, res, base);
  }

  /** A retouch dab: read the current pixels, let the tool change them, write back. */
  private directDab(r: Rect, a: Float32Array, info: DabInfo): void {
    const n = r.w * r.h;
    this.ensure(n);
    const px = this.surface.readCurrent(r, this.rBuf.subarray(0, n * 4));
    const base = this.oBuf.subarray(0, n * 4);
    base.set(px);
    this.s.direct!(r, px, a.subarray(0, n), info);
    this.surface.commit(r, px, base);
    this.markDirty(r);
  }

  /** The stroke's touched area so far (document pixels), or null. */
  bounds(): Rect | null {
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const k of this.tiles.keys()) {
      const tx = Math.floor(k / 65536) - 32768, ty = (k % 65536) - 32768;
      x0 = Math.min(x0, tx * TILE); y0 = Math.min(y0, ty * TILE); x1 = Math.max(x1, (tx + 1) * TILE); y1 = Math.max(y1, (ty + 1) * TILE);
    }
    return x1 > x0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : null;
  }

  /** The stroke buffer's coverage (0–1) at a document pixel (tests, previews). */
  coverageAt(x: number, y: number): number {
    const T = this.tiles.get(tileKey(Math.floor(x / TILE), Math.floor(y / TILE)));
    if (!T) return 0;
    return T[(((y % TILE) + TILE) % TILE * TILE + (((x % TILE) + TILE) % TILE)) * 4 + 3]!;
  }

  get active(): boolean { return this.alive; }
}
