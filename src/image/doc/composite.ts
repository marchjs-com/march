// The compositor: renders any region of a document by walking the layer tree bottom to top. Groups (pass-through or
// isolated), clipping masks, layer and vector masks (density, feather), fill / opacity, Blend If, knockout, layer
// styles (through the styles hook), adjustment layers and fill layers. Output: premultiplied float RGBA.
// It is plain code over typed arrays: it runs in workers and in Node (tests).

import { compositeInto, unpremultiply, type BlendMode } from "./blend.ts";
import { blurPlane, maskCoverage } from "./alpha.ts";
import { filterHalo, runFilter } from "./engine.ts";
import type { ImageDocument } from "./document.ts";
import { hasRaster, isContainer, type Layer, type ContainerLayer } from "./layers.ts";
import { pathToMask } from "./paths.ts";
import { renderPaint } from "./paint.ts";
import { activeEffects, styleHalo, type StylePass } from "./styles.ts";
import type { Mask, Rect } from "./tiles.ts";

/** Hooks filled by heavier modules (text layout, shapes, smart objects, layer styles) so the core stays small. */
export interface RenderHooks {
  /** Bring a text / shape / smart layer's cached raster up to date. */
  prepare?: (doc: ImageDocument, layer: Layer) => void;
  /** The passes of a layer's effects for a region; `px` is the layer's content over the region grown by the halo. */
  styles?: (doc: ImageDocument, layer: Layer, px: Float32Array, outer: Rect) => StylePass[];
}
export const renderHooks: RenderHooks = {};

export interface RenderOptions {
  /** Layers to leave out (e.g. the one being transformed is drawn live by the view). */
  exclude?: Set<string> | undefined;
  /** Only these layers (and their parents' settings). */
  solo?: string | null | undefined;
  /** Preview scale for filters (1 = full size). */
  scale?: number | undefined;
  /** Replace a layer's pixels for this render (live tool previews). */
  override?: Map<string, (r: Rect) => Float32Array>;
}

interface Ctx { doc: ImageDocument; opts: RenderOptions; scale: number }

/** Render a region of the document: premultiplied RGBA floats. */
export function renderRegion(doc: ImageDocument, r: Rect, opts: RenderOptions = {}, out = new Float32Array(r.w * r.h * 4)): Float32Array {
  out.fill(0);
  renderList(doc.layers, r, out, { doc, opts, scale: opts.scale ?? 1 }, out);
  return out;
}

/** Render a region as straight 8-bit RGBA (ImageData-ready), optionally over a matte color. */
export function renderRegionBytes(doc: ImageDocument, r: Rect, opts: RenderOptions & { matte?: [number, number, number] } = {}): Uint8ClampedArray {
  const f = renderRegion(doc, r, opts);
  const b = new Uint8ClampedArray(f.length);
  const m = opts.matte;
  for (let i = 0; i < f.length; i += 4) {
    const a = f[i + 3]!;
    if (m) {
      b[i] = (f[i]! + m[0]! * (1 - a)) * 255 + 0.5; b[i + 1] = (f[i + 1]! + m[1]! * (1 - a)) * 255 + 0.5; b[i + 2] = (f[i + 2]! + m[2]! * (1 - a)) * 255 + 0.5; b[i + 3] = 255;
    } else if (a > 0) {
      const k = 255 / a;
      b[i] = f[i]! * k + 0.5; b[i + 1] = f[i + 1]! * k + 0.5; b[i + 2] = f[i + 2]! * k + 0.5; b[i + 3] = a * 255 + 0.5;
    }
  }
  return b;
}

const grow = (r: Rect, h: number): Rect => ({ x: r.x - h, y: r.y - h, w: r.w + 2 * h, h: r.h + 2 * h });

function crop(src: Float32Array, outer: Rect, inner: Rect, ch = 4): Float32Array {
  const out = new Float32Array(inner.w * inner.h * ch);
  const ox = inner.x - outer.x, oy = inner.y - outer.y;
  for (let y = 0; y < inner.h; y++) out.set(src.subarray(((oy + y) * outer.w + ox) * ch, ((oy + y) * outer.w + ox + inner.w) * ch), y * inner.w * ch);
  return out;
}

function hidden(l: Layer, ctx: Ctx): boolean {
  return !l.visible || !!ctx.opts.exclude?.has(l.id);
}

/** Straight RGBA content of a non-container layer over a region (no masks, no styles). */
export function layerContent(doc: ImageDocument, l: Layer, r: Rect, opts: RenderOptions = {}): Float32Array | null {
  const ov = opts.override?.get(l.id);
  if (ov) return ov(r);
  if (l.kind === "fill") return renderPaint(l.paint, r, undefined, doc.bounds);
  if (hasRaster(l)) {
    renderHooks.prepare?.(doc, l);
    return l.raster.read(r.x, r.y, r.w, r.h);
  }
  return null;
}

// layer and vector masks, feathered copies cached per mask version
const featherCache = new WeakMap<object, { key: string; plane: Float32Array }>();

function featheredPlane(m: Mask, feather: number): Float32Array | null {
  if (feather <= 0) return null;
  const key = `${m.version}:${feather}`;
  const c = featherCache.get(m);
  if (c && c.key === key) return c.plane;
  const plane = new Float32Array(m.data.length);
  for (let i = 0; i < plane.length; i++) plane[i] = m.data[i]! / 255;
  blurPlane(plane, m.width, m.height, feather);
  featherCache.set(m, { key, plane });
  return plane;
}

const vectorCache = new WeakMap<object, { key: string; mask: Mask }>();

/** Coverage 0–1 of a layer's masks over a region (null = fully visible). */
export function layerCoverage(doc: ImageDocument, l: Layer, r: Rect): Float32Array | null {
  let cov: Float32Array | null = null;
  const apply = (m: Mask, density: number, feather: number, invert: boolean): void => {
    const plane = featheredPlane(m, feather);
    const c = new Float32Array(r.w * r.h);
    if (plane) {
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
        const sx = r.x + x, sy = r.y + y;
        c[y * r.w + x] = sx < 0 || sy < 0 || sx >= m.width || sy >= m.height ? m.outside / 255 : plane[sy * m.width + sx]!;
      }
    } else maskCoverage(m, r, c);
    for (let i = 0; i < c.length; i++) {
      let v = invert ? 1 - c[i]! : c[i]!;
      v = 1 - density * (1 - v);
      c[i] = v;
    }
    if (!cov) cov = c;
    else for (let i = 0; i < c.length; i++) cov[i]! *= c[i]!;
  };
  if (l.mask?.enabled) apply(l.mask.mask, l.mask.density, l.mask.feather, !!l.mask.invert);
  if (l.vectorMask?.enabled && l.vectorMask.path.subpaths.length) {
    const key = JSON.stringify(l.vectorMask.path) + doc.width + "x" + doc.height;
    let vc = vectorCache.get(l.vectorMask);
    if (!vc || vc.key !== key) { vc = { key, mask: pathToMask(l.vectorMask.path, doc.width, doc.height) }; vectorCache.set(l.vectorMask, vc); }
    apply(vc.mask, l.vectorMask.density, l.vectorMask.feather, false);
  }
  if (l.kind === "artboard") {
    const c = new Float32Array(r.w * r.h);
    const a = l.rect;
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const sx = r.x + x, sy = r.y + y;
      c[y * r.w + x] = sx >= a.x && sx < a.x + a.w && sy >= a.y && sy < a.y + a.h ? 1 : 0;
    }
    if (!cov) cov = c;
    else for (let i = 0; i < c.length; i++) (cov as Float32Array)[i]! *= c[i]!;
  }
  return cov;
}

const lumOf = (r: number, g: number, b: number): number => 0.299 * r + 0.587 * g + 0.114 * b;

/** Blend If: coverage from this layer's and the underlying pixels' values (split sliders give smooth ranges). */
function blendIfCoverage(l: Layer, src: Float32Array, dst: Float32Array, n: number): Float32Array | null {
  const bi = l.blendIf;
  if (!bi) return null;
  const pick = (px: Float32Array, i: number, premul: boolean): number => {
    const a = premul ? px[i + 3]! || 1 : 1;
    const r = px[i]! / a, g = px[i + 1]! / a, b = px[i + 2]! / a;
    return bi.channel === "red" ? r : bi.channel === "green" ? g : bi.channel === "blue" ? b : lumOf(r, g, b);
  };
  const ramp = (v: number, [a, b, c, d]: [number, number, number, number]): number => {
    v *= 255;
    if (v < a || v > d) return 0;
    if (v < b) return (v - a) / Math.max(1e-6, b - a);
    if (v > c) return (d - v) / Math.max(1e-6, d - c);
    return 1;
  };
  const cov = new Float32Array(n);
  for (let p = 0; p < n; p++) {
    const i = p << 2;
    cov[p] = ramp(pick(src, i, false), bi.thisLayer) * ramp(pick(dst, i, true), bi.underlying);
  }
  return cov;
}

/** Mix adjusted colors into a premultiplied buffer, alpha unchanged: dst.rgb = lerp(dst, B(dst, adj), k). */
function mixAdjusted(dst: Float32Array, adj: Float32Array, mode: BlendMode, k: number, cov: Float32Array | null): void {
  const tmp = new Float32Array(dst.length);
  for (let i = 0; i < dst.length; i += 4) { tmp[i] = adj[i]!; tmp[i + 1] = adj[i + 1]!; tmp[i + 2] = adj[i + 2]!; tmp[i + 3] = 1; }
  const n = dst.length >> 2;
  // composite at full alpha into a copy of the backdrop (opaque-per-pixel trick: blend on straight colors)
  const base = new Float32Array(dst.length);
  for (let i = 0; i < dst.length; i += 4) {
    const a = dst[i + 3]!;
    if (a > 0) { base[i] = dst[i]! / a; base[i + 1] = dst[i + 1]! / a; base[i + 2] = dst[i + 2]! / a; }
    base[i + 3] = 1;
  }
  const res = base.slice();
  compositeInto(res, tmp, { mode, opacity: 1 });
  for (let p = 0; p < n; p++) {
    const i = p << 2, a = dst[i + 3]!;
    if (a <= 0) continue;
    const t = k * (cov ? cov[p]! : 1);
    dst[i] = (base[i]! + (res[i]! - base[i]!) * t) * a;
    dst[i + 1] = (base[i + 1]! + (res[i + 1]! - base[i + 1]!) * t) * a;
    dst[i + 2] = (base[i + 2]! + (res[i + 2]! - base[i + 2]!) * t) * a;
  }
}

/** Run an adjustment layer's filter over a premultiplied buffer region; returns straight adjusted colors. */
function adjust(l: Layer & { kind: "adjustment" }, below: Float32Array, r: Rect, ctx: Ctx): Float32Array {
  const straight = unpremultiply(below.slice());
  const res = runFilter(l.adjust.id, { width: r.w, height: r.h, data: straight }, l.adjust.params, { rect: r, doc: { width: ctx.doc.width, height: ctx.doc.height, dpi: ctx.doc.dpi }, scale: ctx.scale });
  return res.data;
}

/**
 * Composite a list (bottom → top) onto `dst` (premultiplied, region r). `groupStart` is the backdrop the enclosing
 * group started from (shallow knockout).
 */
function renderList(list: Layer[], r: Rect, dst: Float32Array, ctx: Ctx, groupStart: Float32Array, start = 0, end = list.length): void {
  const n = r.w * r.h;
  for (let i = start; i < end; i++) {
    const l = list[i]!;
    // clipped layers follow their base; a clipped layer without a base (first in list) draws normally
    let j = i + 1;
    while (j < end && list[j]!.clip && !isContainer(list[j]!) ) j++;
    const clipped = list.slice(i + 1, j);
    if (hidden(l, ctx)) { i = j - 1; continue; }

    if (l.kind === "adjustment") {
      const halo = filterHalo(l.adjust.id, l.adjust.params, ctx.scale);
      let below = dst;
      let rr = r;
      if (halo > 0 && Number.isFinite(halo)) {
        rr = grow(r, Math.ceil(halo));
        below = new Float32Array(rr.w * rr.h * 4);
        renderList(list, rr, below, ctx, below, 0, i);
      } else if (halo === Infinity) {
        rr = ctx.doc.bounds;
        below = new Float32Array(rr.w * rr.h * 4);
        renderList(list, rr, below, ctx, below, 0, i);
      }
      let adjusted = adjust(l, below, rr, ctx);
      if (rr !== r) adjusted = cropRect(adjusted, rr, r);
      const cov = layerCoverage(ctx.doc, l, r);
      mixAdjusted(dst, adjusted, l.blend === "pass-through" ? "normal" : l.blend, l.opacity * l.fill, cov);
      i = j - 1;
      continue;
    }

    if (isContainer(l)) {
      renderContainer(l, r, dst, ctx, groupStart);
      continue;
    }

    // the layer's own content (with effects)
    let content = layerContent(ctx.doc, l, r, ctx.opts);
    if (!content) { i = j - 1; continue; }
    const passes = activeEffects(l.styles).length && renderHooks.styles ? stylePasses(l, r, ctx) : null;
    if (passes) {
      const c = passes.find((p) => p.place === "content");
      if (c) content = c.px;
    }
    const cov = layerCoverage(ctx.doc, l, r);

    // clipping group: clipped layers draw onto the base, inside the base's alpha
    if (clipped.length) {
      const base = new Float32Array(n * 4);
      compositeInto(base, content, { mode: "normal", opacity: 1, fill: l.fill });
      const baseA = new Float32Array(n);
      for (let p = 0; p < n; p++) baseA[p] = base[p * 4 + 3]!;
      for (const c of clipped) {
        if (hidden(c, ctx)) continue;
        if (c.kind === "adjustment") {
          const adj = adjust(c, base, r, ctx);
          mixAdjusted(base, adj, c.blend === "pass-through" ? "normal" : c.blend, c.opacity * c.fill, layerCoverage(ctx.doc, c, r));
          continue;
        }
        const cc = layerContent(ctx.doc, c, r, ctx.opts);
        if (!cc) continue;
        const cp = activeEffects(c.styles).length && renderHooks.styles ? stylePasses(c, r, ctx) : null;
        const ccov = layerCoverage(ctx.doc, c, r);
        drawPasses(base, cp, "under", r);
        compositeInto(base, cp?.find((p) => p.place === "content")?.px ?? cc, { mode: c.blend === "pass-through" ? "normal" : c.blend, opacity: c.opacity, fill: c.fill, mask: ccov, x: r.x, y: r.y, w: r.w, channels: c.channels });
        drawPasses(base, cp, "over", r);
      }
      // keep the base's coverage
      for (let p = 0; p < n; p++) {
        const k = p * 4, a = base[k + 3]!;
        if (a > 0) { const s = baseA[p]! / a; base[k]! *= s; base[k + 1]! *= s; base[k + 2]! *= s; }
        base[k + 3] = baseA[p]!;
      }
      content = unpremultiply(base);
      drawPasses(dst, passes, "under", r, l.opacity, cov);
      compositeInto(dst, content, { mode: l.blend === "pass-through" ? "normal" : l.blend, opacity: l.opacity, fill: 1, mask: cov, x: r.x, y: r.y, w: r.w, channels: l.channels });
      drawPasses(dst, passes, "over", r, l.opacity, cov);
      i = j - 1;
      continue;
    }

    let mask = cov;
    const bi = blendIfCoverage(l, content, dst, n);
    if (bi) { if (mask) for (let p = 0; p < n; p++) mask[p]! *= bi[p]!; else mask = bi; }
    if (l.knockout && l.knockout !== "none" && l.fill < 1) {
      // the layer's shape shows the group's backdrop (shallow) or transparency (deep)
      const kb = l.knockout === "shallow" ? groupStart : null;
      for (let p = 0; p < n; p++) {
        const k = p * 4, a = content[k + 3]! * (mask ? mask[p]! : 1);
        if (a <= 0) continue;
        for (let c = 0; c < 4; c++) dst[k + c] = dst[k + c]! * (1 - a) + (kb ? kb[k + c]! : 0) * a;
      }
    }
    drawPasses(dst, passes, "under", r, l.opacity, cov);
    compositeInto(dst, content, { mode: l.blend === "pass-through" ? "normal" : l.blend, opacity: l.opacity, fill: l.fill, mask, x: r.x, y: r.y, w: r.w, channels: l.channels });
    drawPasses(dst, passes, "over", r, l.opacity, cov);
  }
}

function cropRect(px: Float32Array, outer: Rect, inner: Rect): Float32Array { return crop(px, outer, inner); }

function stylePasses(l: Layer, r: Rect, ctx: Ctx): StylePass[] | null {
  const halo = styleHalo(l.styles);
  const outer = grow(r, halo);
  const px = layerContent(ctx.doc, l, outer, ctx.opts);
  if (!px || !renderHooks.styles) return null;
  const passes = renderHooks.styles(ctx.doc, l, px, outer);
  return passes.map((p) => ({ ...p, px: crop(p.px, outer, r) }));
}

function drawPasses(dst: Float32Array, passes: StylePass[] | null, place: "under" | "over", r: Rect, opacity = 1, mask: Float32Array | null = null): void {
  if (!passes) return;
  for (const p of passes) if (p.place === place) compositeInto(dst, p.px, { mode: p.blend, opacity: p.opacity * opacity, mask, x: r.x, y: r.y, w: r.w });
}

function renderContainer(g: ContainerLayer, r: Rect, dst: Float32Array, ctx: Ctx, _outerStart: Float32Array): void {
  const n = r.w * r.h;
  const cov = layerCoverage(ctx.doc, g, r);
  const passThrough = g.blend === "pass-through" && g.kind === "group";
  if (passThrough) {
    // children draw straight onto the backdrop; group opacity and mask mix the result with the backdrop before
    const before = dst.slice();
    renderList(g.children, r, dst, ctx, before);
    const k = g.opacity;
    if (k < 1 || cov) {
      for (let p = 0; p < n; p++) {
        const t = k * (cov ? cov[p]! : 1), i = p * 4;
        for (let c = 0; c < 4; c++) dst[i + c] = before[i + c]! + (dst[i + c]! - before[i + c]!) * t;
      }
    }
    return;
  }
  // isolated: children on a transparent buffer, then composited as one layer
  const buf = new Float32Array(n * 4);
  if (g.kind === "artboard" && g.background) {
    const bg = renderPaint({ type: "solid", color: g.background }, r);
    compositeInto(buf, bg, { mode: "normal", opacity: 1, mask: cov });
  }
  renderList(g.children, r, buf, ctx, buf);
  const straight = unpremultiply(buf);
  const passes = activeEffects(g.styles).length && renderHooks.styles ? (() => {
    const halo = styleHalo(g.styles);
    const outer = grow(r, halo);
    const ob = new Float32Array(outer.w * outer.h * 4);
    renderList(g.children, outer, ob, ctx, ob);
    const ps = renderHooks.styles!(ctx.doc, g, unpremultiply(ob), outer);
    return ps.map((p) => ({ ...p, px: crop(p.px, outer, r) }));
  })() : null;
  drawPasses(dst, passes, "under", r, g.opacity, cov);
  compositeInto(dst, passes?.find((p) => p.place === "content")?.px ?? straight, { mode: g.blend === "pass-through" ? "normal" : g.blend, opacity: g.opacity, fill: g.fill, mask: cov, x: r.x, y: r.y, w: r.w, channels: g.channels });
  drawPasses(dst, passes, "over", r, g.opacity, cov);
}

/** Render a single layer alone (thumbnails, Ctrl+click previews, export per layer), straight RGBA. */
export function renderLayer(doc: ImageDocument, l: Layer, r: Rect, withMasks = true): Float32Array {
  const dst = new Float32Array(r.w * r.h * 4);
  const ctx: Ctx = { doc, opts: {}, scale: 1 };
  if (isContainer(l)) renderContainer({ ...l, blend: l.blend === "pass-through" ? "normal" : l.blend, opacity: 1, visible: true } as ContainerLayer, r, dst, ctx, dst);
  else {
    const c = layerContent(doc, l, r);
    if (c) compositeInto(dst, c, { mode: "normal", opacity: 1, fill: l.fill, mask: withMasks ? layerCoverage(doc, l, r) : null });
  }
  return unpremultiply(dst);
}
