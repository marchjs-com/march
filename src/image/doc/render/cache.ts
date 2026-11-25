// The render cache: composited 256² tiles (premultiplied float RGBA, display bytes on demand), invalidated by the
// document's "change" events down to the tiles a step touched; a mip pyramid (1/2 … 1/32) for zoomed-out views,
// rebuilt lazily per dirty tile; and a "focus layer" mode for painting: the composite below the active root-level
// layer is cached, and when every layer above is plain normal blending (no adjustments, effects, Blend If, knockout,
// clipping onto it) the layers above are flattened into one cached "above" tile, so a dirty tile while painting costs
// two composites (focus onto below, above over that) instead of N.

import type { DocChange, ImageDocument } from "../document.ts";
import { layerContent, layerCoverage, renderRegion, type RenderOptions } from "../composite.ts";
import { compositeInto } from "../blend.ts";
import { sameState, type Step } from "../history.ts";
import { activeEffects } from "../styles.ts";
import { baseLayer, hasRaster, isContainer, walk, type Layer, type PixelLayer } from "../layers.ts";
import { TILE, TiledRaster, keyTx, keyTy, rectIntersect, tileKey, tilesOf, type Rect } from "../tiles.ts";

export const MIP_LEVELS = 5;

export interface CacheStats { renders: number; hits: number; focusRenders: number; invalidated: number }

interface Entry { px: Float32Array; r: Rect; bytes?: Uint8ClampedArray | undefined; used: number }

export interface TileCacheOptions {
  /** Most composited tiles kept (LRU beyond it). Default: unlimited. */
  maxTiles?: number | undefined;
  /** Matte color for display bytes (null = straight alpha bytes). */
  matte?: [number, number, number] | null | undefined;
  /** Render options passed to every composite (exclude, solo…). */
  render?: RenderOptions | undefined;
}

/** Plain "over" of premultiplied `top` onto premultiplied `dst` (in place). */
export function overPremul(dst: Float32Array, top: Float32Array): void {
  for (let i = 0; i < dst.length; i += 4) {
    const a = top[i + 3]!;
    if (a <= 0) continue;
    const k = 1 - a;
    dst[i] = top[i]! + dst[i]! * k; dst[i + 1] = top[i + 1]! + dst[i + 1]! * k; dst[i + 2] = top[i + 2]! + dst[i + 2]! * k; dst[i + 3] = a + dst[i + 3]! * k;
  }
}

/**
 * below (premultiplied) + a normal-blended pixel layer (alpha × k × mask) + a premultiplied flattened top, in one pass
 * into a new buffer. Reads the layer's tile array directly when its offset is tile-aligned.
 */
function fusedFocus(below: Float32Array, l: PixelLayer, r: Rect, k: number, mask: Float32Array | null, above: Float32Array | null, cache: TileCache, reuse: Float32Array | null): Float32Array {
  const out = reuse && reuse.length === below.length ? reuse : new Float32Array(below.length), ras = l.raster;
  let src: ArrayLike<number> | null, stride: number, scale: number;
  if (ras.ox % TILE === 0 && ras.oy % TILE === 0 && r.x % TILE === 0 && r.y % TILE === 0) {
    src = ras.tiles.get(tileKey((r.x - ras.ox) / TILE, (r.y - ras.oy) / TILE)) ?? null;
    stride = TILE; scale = 1 / ras.max;
  } else { src = ras.read(r.x, r.y, r.w, r.h, cache.scratchFor(r)); stride = r.w; scale = 1; }
  const ka = k * scale;
  for (let y = 0; y < r.h; y++) {
    let i = y * r.w * 4, si = y * stride * 4, p = y * r.w;
    for (let x = 0; x < r.w; x++, i += 4, si += 4, p++) {
      let cr = below[i]!, cg = below[i + 1]!, cb = below[i + 2]!, ca = below[i + 3]!;
      if (src) {
        let a = src[si + 3]! * ka;
        if (mask) a *= mask[p]!;
        if (a > 0) {
          const t = 1 - a, f = a * scale;
          cr = src[si]! * f + cr * t; cg = src[si + 1]! * f + cg * t; cb = src[si + 2]! * f + cb * t; ca = a + ca * t;
        }
      }
      if (above) {
        const a = above[i + 3]!;
        if (a > 0) { const t = 1 - a; cr = above[i]! + cr * t; cg = above[i + 1]! + cg * t; cb = above[i + 2]! + cb * t; ca = a + ca * t; }
      }
      out[i] = cr; out[i + 1] = cg; out[i + 2] = cb; out[i + 3] = ca;
    }
  }
  return out;
}

/** Normal blending of a straight source (alpha × k × mask) onto a premultiplied backdrop, in place. */
export function overStraight(dst: Float32Array, src: Float32Array, k: number, mask: Float32Array | null): void {
  for (let p = 0, i = 0; i < dst.length; p++, i += 4) {
    let a = src[i + 3]! * k;
    if (mask) a *= mask[p]!;
    if (a <= 0) continue;
    const t = 1 - a;
    dst[i] = src[i]! * a + dst[i]! * t; dst[i + 1] = src[i + 1]! * a + dst[i + 1]! * t; dst[i + 2] = src[i + 2]! * a + dst[i + 2]! * t; dst[i + 3] = a + dst[i + 3]! * t;
  }
}

/** True when a layer (and its subtree) composites as plain Porter–Duff "over": the layers above can be flattened. */
export function plainOver(l: Layer): boolean {
  if (!l.visible) return true;
  if (l.kind === "adjustment" || l.blendIf || (l.knockout && l.knockout !== "none") || activeEffects(l.styles).length || l.channels?.some((c) => !c)) return false;
  if (l.blend === "pass-through") return isContainer(l) && l.children.every(plainOver);
  if (l.blend !== "normal") return false;
  // an isolated normal group is one "over" whatever is inside
  return true;
}

const FAKE_ID = "__march_cache_backdrop__";

/** A pixel layer whose content is a premultiplied backdrop buffer (rendered through RenderOptions.override). */
function backdropLayer(): PixelLayer {
  return { ...baseLayer("pixel", "backdrop"), id: FAKE_ID, raster: new TiledRaster(32) };
}

export class TileCache {
  readonly doc: ImageDocument;
  readonly stats: CacheStats = { renders: 0, hits: 0, focusRenders: 0, invalidated: 0 };
  /** Tile keys dropped by the last invalidation (tests, debugging). */
  lastInvalidated: number[] = [];
  private tiles = new Map<number, Entry>();
  private mips: Map<number, Entry>[] = [];
  private opts: TileCacheOptions;
  private off: () => void;
  private clock = 0;
  // focus mode
  private focusId: string | null = null;
  private focusRoot: Layer | null = null;
  private focusIndex = -1;
  private focusEnd = -1;
  private flatAbove = false;
  /** The focus is one plain raster layer: composited straight onto the cached backdrop (no backdrop layer). */
  private simple = false;
  private scratch: Float32Array | null = null;
  /** Arrays of tiles dropped by a focus-scope invalidation, rewritten in place by the next repaint (no allocation). */
  private recycle = new Map<number, Float32Array>();
  private below = new Map<number, Float32Array>();
  private above = new Map<number, Float32Array>();
  private rasterOwner = new WeakMap<TiledRaster, boolean>();

  constructor(doc: ImageDocument, opts: TileCacheOptions = {}) {
    this.doc = doc;
    this.opts = opts;
    for (let i = 0; i < MIP_LEVELS; i++) this.mips.push(new Map());
    this.off = doc.on((c) => this.onChange(c));
  }

  dispose(): void { this.off(); this.clear(); }

  /** Drop everything. */
  clear(): void {
    this.lastInvalidated = [...this.tiles.keys()];
    this.tiles.clear(); this.below.clear(); this.above.clear(); this.recycle.clear();
    for (const m of this.mips) m.clear();
  }

  /** The document rectangle of a tile (clipped to the document). */
  tileRect(tx: number, ty: number): Rect | null {
    return rectIntersect({ x: tx * TILE, y: ty * TILE, w: TILE, h: TILE }, this.doc.bounds);
  }

  // ——— focus mode ———

  /**
   * Paint with a cached backdrop: `layerId` (or its root-level ancestor) is the focus. Pass null to leave focus mode.
   * Returns false when the layer cannot be a focus (clipped onto a layer below, an adjustment with a halo…).
   */
  focus(layerId: string | null): boolean {
    this.below.clear(); this.above.clear(); this.focusRoot = null; this.focusId = null;
    if (!layerId) return true;
    let loc = this.doc.locate(layerId);
    while (loc?.parent) loc = this.doc.locate(loc.parent.id);
    if (!loc || loc.list !== this.doc.layers) return false;
    const root = loc.list[loc.index]!;
    if (root.clip || root.kind === "adjustment") return false;
    let end = loc.index + 1;
    while (end < loc.list.length && loc.list[end]!.clip && !isContainer(loc.list[end]!)) end++;
    this.focusId = layerId; this.focusRoot = root; this.focusIndex = loc.index; this.focusEnd = end;
    const above = this.doc.layers.slice(end);
    this.flatAbove = above.every(plainOver) && !(above[0]?.clip ?? false);
    this.simple = end === loc.index + 1 && hasRaster(root) && !root.blendIf && (!root.knockout || root.knockout === "none") && !activeEffects(root.styles).length;
    this.rasterOwner = new WeakMap();
    for (let i = loc.index; i < end; i++) for (const [l] of walk([this.doc.layers[i]!])) if ("raster" in l) this.rasterOwner.set(l.raster, true);
    return true;
  }
  get focused(): string | null { return this.focusId; }
  /** True while the layers above the focus are flattened into one cached tile. */
  get flattenedAbove(): boolean { return !!this.focusRoot && this.flatAbove; }

  /** A reusable read buffer for a tile rect. */
  scratchFor(r: Rect): Float32Array {
    const n = r.w * r.h * 4;
    if (!this.scratch || this.scratch.length !== n) this.scratch = new Float32Array(n);
    return this.scratch;
  }

  private proxy(layers: Layer[]): ImageDocument {
    const p = Object.create(this.doc) as ImageDocument;
    Object.defineProperty(p, "layers", { value: layers, enumerable: true });
    return p;
  }

  private renderFocusTile(r: Rect, key: number): Float32Array {
    const L = this.doc.layers, ropts = this.opts.render ?? {};
    let below = this.below.get(key);
    if (!below) { below = renderRegion(this.proxy(L.slice(0, this.focusIndex)), r, ropts); this.below.set(key, below); this.stats.renders++; }
    const fake = backdropLayer(), b = below;
    const withBackdrop = (layers: Layer[], src: Float32Array): Float32Array => {
      const ov = new Map(ropts.override ?? []);
      ov.set(FAKE_ID, () => { const s = src.slice(); for (let i = 0; i < s.length; i += 4) { const a = s[i + 3]!; if (a > 0) { s[i]! /= a; s[i + 1]! /= a; s[i + 2]! /= a; } } return s; });
      return renderRegion(this.proxy([fake, ...layers]), r, { ...ropts, override: ov });
    };
    let mid: Float32Array;
    const root = this.focusRoot!;
    const aboveLayers = L.slice(this.focusEnd);
    if (this.simple && root.visible && !ropts.exclude?.has(root.id) && !ropts.solo) {
      let above: Float32Array | null = null;
      if (aboveLayers.length && this.flatAbove) {
        above = this.above.get(key) ?? null;
        if (!above) { above = renderRegion(this.proxy(aboveLayers), r, ropts); this.above.set(key, above); this.stats.renders++; }
      }
      const mask = layerCoverage(this.doc, root, r), mode = root.blend === "pass-through" ? "normal" : root.blend;
      const plain = mode === "normal" && !root.channels && root.kind === "pixel" && !ropts.override?.has(root.id);
      if (plain && (above || !aboveLayers.length)) {
        // one fused pass: backdrop, the focus layer's stored pixels (no copy when its grid lines up), the flattened top
        this.stats.focusRenders++;
        const reuse = this.recycle.get(key) ?? null;
        this.recycle.delete(key);
        return fusedFocus(b, root as PixelLayer, r, root.opacity * root.fill, mask, above, this, reuse);
      }
      mid = b.slice();
      let content: Float32Array | null;
      if (hasRaster(root) && root.kind === "pixel" && !ropts.override?.has(root.id)) content = root.raster.read(r.x, r.y, r.w, r.h, this.scratchFor(r));
      else content = layerContent(this.doc, root, r, ropts);
      if (content) {
        if (mode === "normal" && !root.channels) overStraight(mid, content, root.opacity * root.fill, mask);
        else compositeInto(mid, content, { mode, opacity: root.opacity, fill: root.fill, mask, x: r.x, y: r.y, w: r.w, channels: root.channels });
      }
    } else if (this.simple) mid = b.slice();
    else mid = withBackdrop(L.slice(this.focusIndex, this.focusEnd), b);
    this.stats.focusRenders++;
    if (!aboveLayers.length) return mid;
    if (this.flatAbove) {
      let a = this.above.get(key);
      if (!a) { a = renderRegion(this.proxy(aboveLayers), r, ropts); this.above.set(key, a); this.stats.renders++; }
      overPremul(mid, a);
      return mid;
    }
    return withBackdrop(aboveLayers, mid);
  }

  // ——— tiles ———

  /** The composited tile (premultiplied RGBA, tileRect size), rendered when missing. In focus mode the array of a
   * dropped tile is reused by its repaint: copy it if you keep it past an invalidation. */
  tile(tx: number, ty: number): Float32Array | null {
    const key = tileKey(tx, ty);
    const e = this.tiles.get(key);
    if (e) { e.used = ++this.clock; this.stats.hits++; return e.px; }
    const r = this.tileRect(tx, ty);
    if (!r) return null;
    let px: Float32Array;
    if (this.focusRoot) px = this.renderFocusTile(r, key);
    else { px = renderRegion(this.doc, r, this.opts.render ?? {}); this.stats.renders++; }
    this.tiles.set(key, { px, r, used: ++this.clock });
    this.evict();
    return px;
  }

  /** The tile as display bytes (straight RGBA, or over the matte). */
  bytes(tx: number, ty: number): Uint8ClampedArray | null {
    const px = this.tile(tx, ty);
    if (!px) return null;
    const e = this.tiles.get(tileKey(tx, ty))!;
    if (!e.bytes) e.bytes = tileBytes(px, this.opts.matte ?? null);
    return e.bytes;
  }

  /** Is a tile cached? */
  has(tx: number, ty: number): boolean { return this.tiles.has(tileKey(tx, ty)); }

  /** Any document region assembled from cached tiles (premultiplied). */
  region(r: Rect): Float32Array {
    const out = new Float32Array(r.w * r.h * 4);
    for (const k of tilesOf(r)) {
      const tx = keyTx(k), ty = keyTy(k), px = this.tile(tx, ty), tr = this.tileRect(tx, ty);
      if (!px || !tr) continue;
      const ir = rectIntersect(tr, r);
      if (!ir) continue;
      for (let y = ir.y; y < ir.y + ir.h; y++) {
        const s = ((y - tr.y) * tr.w + (ir.x - tr.x)) * 4, d = ((y - r.y) * r.w + (ir.x - r.x)) * 4;
        out.set(px.subarray(s, s + ir.w * 4), d);
      }
    }
    return out;
  }

  private evict(): void {
    const max = this.opts.maxTiles;
    if (!max || this.tiles.size <= max) return;
    const order = [...this.tiles.entries()].sort((a, b) => a[1].used - b[1].used);
    for (let i = 0; i < order.length - max; i++) this.tiles.delete(order[i]![0]);
  }

  // ——— mip pyramid ———

  /**
   * A tile of mip level `level` (1 = 1/2 … 5 = 1/32): TILE² covering (TILE << level)² document pixels, premultiplied,
   * box-filtered from the level below; built lazily and dropped with the dirty tiles under it. Level 0 = tile().
   */
  mip(level: number, tx: number, ty: number): { px: Float32Array; w: number; h: number } | null {
    if (level <= 0) { const px = this.tile(tx, ty), r = this.tileRect(tx, ty); return px && r ? { px, w: r.w, h: r.h } : null; }
    const map = this.mips[level - 1]!, key = tileKey(tx, ty), hit = map.get(key);
    if (hit) { hit.used = ++this.clock; return { px: hit.px, w: hit.r.w, h: hit.r.h }; }
    const span = TILE << level, dw = Math.ceil(this.doc.width / (1 << level)), dh = Math.ceil(this.doc.height / (1 << level));
    if (tx * TILE >= dw || ty * TILE >= dh || tx < 0 || ty < 0) return null;
    const w = Math.min(TILE, dw - tx * TILE), h = Math.min(TILE, dh - ty * TILE), out = new Float32Array(w * h * 4);
    void span;
    for (let q = 0; q < 4; q++) {
      const cx = tx * 2 + (q & 1), cy = ty * 2 + (q >> 1);
      const c = this.mip(level - 1, cx, cy);
      if (!c) continue;
      const ox = (q & 1) * (TILE / 2), oy = (q >> 1) * (TILE / 2);
      for (let y = 0; y < Math.ceil(c.h / 2); y++) for (let x = 0; x < Math.ceil(c.w / 2); x++) {
        const X = ox + x, Y = oy + y;
        if (X >= w || Y >= h) continue;
        let n = 0;
        const d = (Y * w + X) * 4;
        for (let sy = 0; sy < 2; sy++) for (let sx = 0; sx < 2; sx++) {
          const px = 2 * x + sx, py = 2 * y + sy;
          if (px >= c.w || py >= c.h) continue;
          const s = (py * c.w + px) * 4;
          out[d]! += c.px[s]!; out[d + 1]! += c.px[s + 1]!; out[d + 2]! += c.px[s + 2]!; out[d + 3]! += c.px[s + 3]!;
          n++;
        }
        if (n) { const k = 1 / n; out[d]! *= k; out[d + 1]! *= k; out[d + 2]! *= k; out[d + 3]! *= k; }
      }
    }
    map.set(key, { px: out, r: { x: tx * span, y: ty * span, w, h }, used: ++this.clock });
    return { px: out, w, h };
  }

  /** The mip level for a view zoom (the largest level whose scale is still ≥ zoom). */
  static levelFor(zoom: number): number {
    let l = 0;
    while (l < MIP_LEVELS && 1 / (1 << (l + 1)) >= zoom) l++;
    return l;
  }

  // ——— invalidation ———

  /**
   * Drop the cached tiles over a rectangle (null = all). `scope` "focus": only the focus unit changed (below / above
   * caches stay).
   */
  invalidate(rect: Rect | null, scope: "all" | "focus" = "all"): void {
    if (!rect) {
      this.clear();
      if (this.focusId) this.focus(this.focusId);
      this.stats.invalidated += this.lastInvalidated.length;
      return;
    }
    const keys = tilesOf(rectIntersect(rect, this.doc.bounds) ?? { x: 0, y: 0, w: 0, h: 0 });
    this.lastInvalidated = keys.filter((k) => this.tiles.has(k));
    for (const k of keys) {
      const old = this.tiles.get(k);
      if (old && scope === "focus" && this.recycle.size < 64) this.recycle.set(k, old.px);
      this.tiles.delete(k);
      if (scope === "all") { this.below.delete(k); this.above.delete(k); }
    }
    this.stats.invalidated += this.lastInvalidated.length;
    // mip tiles over the rect, every level
    for (let l = 1; l <= MIP_LEVELS; l++) {
      const s = TILE << l, x0 = Math.floor(rect.x / s), y0 = Math.floor(rect.y / s), x1 = Math.floor((rect.x + rect.w - 1) / s), y1 = Math.floor((rect.y + rect.h - 1) / s);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.mips[l - 1]!.delete(tileKey(x, y));
    }
  }

  /** What a step changed: null = everything, else the dirty rect and whether only the focus unit's rasters changed. */
  private stepDirty(step: Step): { rect: Rect | null; focusOnly: boolean } | null {
    const b = step.before, a = step.after;
    if (!sameState(b.layers, a.layers) || !sameState(b.rasterPos, a.rasterPos) || b.width !== a.width || b.height !== a.height) return null;
    // masks: only layer masks matter (selection, channels and quick mask do not render)
    const layerMasks = new Set<unknown>();
    for (const [l] of walk(this.doc.layers)) if (l.mask) layerMasks.add(l.mask.mask);
    if (step.masks.some((m) => layerMasks.has(m.mask))) return null;
    let rect: Rect | null = null, focusOnly = !!this.focusRoot;
    for (const t of step.tiles) {
      const r = { x: keyTx(t.key) * TILE + t.raster.ox, y: keyTy(t.key) * TILE + t.raster.oy, w: TILE, h: TILE };
      rect = rect ? { x: Math.min(rect.x, r.x), y: Math.min(rect.y, r.y), w: Math.max(rect.x + rect.w, r.x + r.w) - Math.min(rect.x, r.x), h: Math.max(rect.y + rect.h, r.y + r.h) - Math.min(rect.y, r.y) } : r;
      if (!this.rasterOwner.get(t.raster)) focusOnly = false;
    }
    return { rect: rect ?? { x: 0, y: 0, w: 0, h: 0 }, focusOnly };
  }

  private onChange(c: DocChange): void {
    if (c.how === "live") {
      // a stroke or drag in progress: in focus mode it is the focus layer
      if (c.structure) this.invalidate(null);
      else this.invalidate(c.dirty, this.focusRoot ? "focus" : "all");
      return;
    }
    if (c.step && (c.how === "do" || c.how === "undo" || c.how === "redo")) {
      const d = this.stepDirty(c.step);
      if (!d) { this.invalidate(null); return; }
      if (d.rect && d.rect.w > 0) this.invalidate(d.rect, d.focusOnly ? "focus" : "all");
      else this.lastInvalidated = [];
      return;
    }
    if (c.step === null && c.how === "do") { this.lastInvalidated = []; return; }
    this.invalidate(c.dirty);
  }
}

/** Premultiplied float → display bytes (straight alpha, or over a matte). */
export function tileBytes(f: Float32Array, matte: [number, number, number] | null = null): Uint8ClampedArray {
  const b = new Uint8ClampedArray(f.length);
  for (let i = 0; i < f.length; i += 4) {
    const a = f[i + 3]!;
    if (matte) { b[i] = (f[i]! + matte[0] * (1 - a)) * 255 + 0.5; b[i + 1] = (f[i + 1]! + matte[1] * (1 - a)) * 255 + 0.5; b[i + 2] = (f[i + 2]! + matte[2] * (1 - a)) * 255 + 0.5; b[i + 3] = 255; }
    else if (a > 0) { const k = 255 / a; b[i] = f[i]! * k + 0.5; b[i + 1] = f[i + 1]! * k + 0.5; b[i + 2] = f[i + 2]! * k + 0.5; b[i + 3] = a * 255 + 0.5; }
  }
  return b;
}
