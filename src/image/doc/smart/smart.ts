// Smart objects. The source is kept as a plain snapshot of a child document — its size, depth, dpi, text styles and
// layer tree, with pixel data held by reference (copy-on-write clones) — not as bytes: rendering stays synchronous,
// undo / redo copy only the structure (cloneState shares rasters), and the .march-image writer serializes the nested
// rasters like any others (no extra format). saveDocument / loadDocument are used for Export Contents and for bytes
// handed to Replace Contents / linked files.
//
// Render: the source is composited at its native size (cached), placed through `matrix` (projective, source pixels →
// document pixels; or a warp mesh, then the matrix) with smart/sample.ts, then the smart filters run in order
// (engine.ts runFilter: { id, params, enabled, blend, opacity }), and the filter mask blends filtered and unfiltered.
// Every placement re-renders from the source, so scaling down and back up is lossless.

import { layerBounds } from "../bounds.ts";
import { compositeInto } from "../blend.ts";
import { renderHooks, renderRegion } from "../composite.ts";
import { ImageDocument, deepCopyLayer } from "../document.ts";
import { runFilter } from "../engine.ts";
import { loadDocument, saveDocument } from "../format.ts";
import { hasRaster, isContainer, walk, type Layer, type PixelLayer, type SmartFilter, type SmartLayer } from "../layers.ts";
import { pathBounds, transformPath } from "../paths.ts";
import { Mask, TiledRaster, rectIntersect, rectUnion, type Rect } from "../tiles.ts";
import { addPrepare, markShown, replaceRaster, stableKey, upToDate } from "../shapes/prepare.ts";
import { applyMat, IDENTITY, meshMap, mul3, placedBounds, premul, sampleProjective, scale3, translate3, unpremul, type Mat3 } from "./sample.ts";

/** The embedded source of a smart object (stored in layer.source.doc). */
export interface SmartSource {
  v: 1;
  width: number;
  height: number;
  depth: ImageDocument["depth"];
  dpi: number;
  layers: Layer[];
  textStyles?: unknown;
}

// ——— snapshots ———

/** Deep copy of plain layer data with rasters and masks cloned copy-on-write (ids kept). */
export function cloneLayersCow(layers: Layer[]): Layer[] {
  const copy = (v: unknown): unknown => {
    if (v instanceof TiledRaster) return v.clone();
    if (v instanceof Mask) return v.clone();
    if (ArrayBuffer.isView(v)) return v;
    if (Array.isArray(v)) return v.map(copy);
    if (v && typeof v === "object") { const o: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v)) o[k] = copy(x); return o; }
    return v;
  };
  return copy(layers) as Layer[];
}

/** A smart source from a document (its current state; pixels shared copy-on-write). */
export function snapshotOf(doc: ImageDocument): SmartSource {
  const s: SmartSource = { v: 1, width: doc.width, height: doc.height, depth: doc.depth, dpi: doc.dpi, layers: cloneLayersCow(doc.layers) };
  if (doc.meta.textStyles) s.textStyles = structuredClone(doc.meta.textStyles);
  return s;
}

/** A live, editable document from a smart source (Edit Contents opens this). */
export function childDocument(src: SmartSource, name = "Smart Object"): ImageDocument {
  const d = new ImageDocument({ width: src.width, height: src.height, depth: src.depth, dpi: src.dpi, background: "transparent", name });
  d.layers = cloneLayersCow(src.layers);
  if (src.textStyles) d.meta = { ...d.meta, textStyles: structuredClone(src.textStyles) };
  d.activeId = d.layers[d.layers.length - 1]?.id ?? null;
  d.selected = d.activeId ? [d.activeId] : [];
  d.history.clear();
  return d;
}

const sourceOf = (l: SmartLayer): SmartSource => l.source.doc as SmartSource;

// ——— rendering ———

const renderDocs = new WeakMap<object, ImageDocument>();
const sourceCache = new Map<string, Float32Array>();

/** The source composited at native size, premultiplied (cached by content). */
export function renderSource(src: SmartSource): Float32Array {
  const key = stableKey(src);
  const hit = sourceCache.get(key);
  if (hit) return hit;
  let d = renderDocs.get(src);
  if (!d) {
    d = new ImageDocument({ width: src.width, height: src.height, depth: src.depth, dpi: src.dpi, background: "transparent" });
    if (src.textStyles) d.meta = { textStyles: src.textStyles };
    renderDocs.set(src, d);
  }
  d.layers = src.layers;
  const px = renderRegion(d, { x: 0, y: 0, w: src.width, h: src.height });
  sourceCache.set(key, px);
  while (sourceCache.size > 3) sourceCache.delete(sourceCache.keys().next().value!);
  return px;
}

const toMat = (m: number[]): Mat3 => (m.length >= 9 ? m.slice(0, 9) : m.length === 6 ? [m[0]!, m[2]!, m[4]!, m[1]!, m[3]!, m[5]!, 0, 0, 1] : IDENTITY.slice());

/** Where a smart object's pixels land (geometry space, before the raster offset). */
export function smartBounds(l: SmartLayer): Rect {
  const M = toMat(l.matrix);
  if (l.warp) {
    const p = l.warp.points;
    let r: Rect | null = null;
    for (let k = 0; k + 1 < p.length; k += 2) { const [x, y] = applyMat(M, p[k]!, p[k + 1]!); r = rectUnion(r, { x: Math.floor(x), y: Math.floor(y), w: 1, h: 1 }); }
    return r ?? { x: 0, y: 0, w: 0, h: 0 };
  }
  return placedBounds(M, l.source.width, l.source.height);
}

/** Render a smart object's placed, filtered pixels (straight RGBA) over a geometry-space rect. */
export function renderSmartPixels(doc: ImageDocument, l: SmartLayer, r: Rect): Float32Array {
  const src = renderSource(sourceOf(l));
  const sw = l.source.width, sh = l.source.height, M = toMat(l.matrix);
  let px: Float32Array;
  if (l.warp && l.warp.points.length >= (l.warp.cols + 1) * (l.warp.rows + 1) * 2) {
    const { cols, rows, points } = l.warp;
    const m = meshMap(src, { x: 0, y: 0, w: sw, h: sh }, cols, rows, (i, j) => { const k = (j * (cols + 1) + i) * 2; return applyMat(M, points[k]!, points[k + 1]!); }, r);
    px = new Float32Array(r.w * r.h * 4);
    for (let y = 0; y < m.rect.h; y++) px.set(m.px.subarray(y * m.rect.w * 4, (y + 1) * m.rect.w * 4), ((m.rect.y - r.y + y) * r.w + (m.rect.x - r.x)) * 4);
  } else px = sampleProjective(src, sw, sh, M, r);
  unpremul(px);
  const active = l.filtersEnabled ? l.filters.filter((f) => f.enabled) : [];
  if (!active.length) return px;
  const base = px.slice();
  let cur = px;
  for (const f of active) {
    const res = runFilter(f.id, { width: r.w, height: r.h, data: cur.slice() }, f.params, { rect: { x: r.x + l.raster.ox, y: r.y + l.raster.oy, w: r.w, h: r.h }, doc: { width: doc.width, height: doc.height, dpi: doc.dpi }, scale: 1 });
    const mode = f.blend ?? "normal", op = f.opacity ?? 1;
    if (mode === "normal" && op >= 1) cur = res.data;
    else { const dst = premul(cur.slice()); compositeInto(dst, res.data, { mode, opacity: op }); cur = unpremul(dst); }
  }
  // the filter mask (document space) blends filtered over unfiltered
  const fm = l.filterMask;
  if (fm) {
    const a = premul(base.slice()), b = premul(cur.slice());
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const t = fm.get(r.x + x + l.raster.ox, r.y + y + l.raster.oy) / 255, k = (y * r.w + x) * 4;
      for (let c = 0; c < 4; c++) a[k + c] = a[k + c]! + (b[k + c]! - a[k + c]!) * t;
    }
    return unpremul(a);
  }
  return cur;
}

/** Bring a smart object's raster up to date (the prepare hook). */
export function prepareSmart(doc: ImageDocument, l: SmartLayer): void {
  const key = stableKey([sourceOf(l), l.matrix, l.warp ?? null, l.filters, l.filtersEnabled, l.filterMask ?? null, doc.width, doc.height]);
  if (upToDate(l.raster, key)) return;
  const full = smartBounds(l);
  const view = { x: -l.raster.ox - 64, y: -l.raster.oy - 64, w: doc.width + 128, h: doc.height + 128 };
  const r = rectIntersect(full, view);
  replaceRaster(l.raster, r, r ? renderSmartPixels(doc, l, r) : null);
  markShown(l.raster, key);
}

/** Register the smart object renderer (renderHooks.prepare for kind "smart"). */
export function installSmartRenderer(): () => void {
  return addPrepare("smart", (doc, l) => { if (l.kind === "smart") prepareSmart(doc, l); });
}

// ——— layer helpers ———


/** Translate a copy of a layer tree (for moving it into another space). Masks are re-cut to w × h. */
function translateLayer(l: Layer, dx: number, dy: number, w: number, h: number): void {
  for (const [x] of walk([l])) {
    if (hasRaster(x)) { x.raster.ox += dx; x.raster.oy += dy; }
    if (x.kind === "artboard") x.rect = { ...x.rect, x: x.rect.x + dx, y: x.rect.y + dy };
    if (x.kind === "fill" && x.paint.type === "gradient" && !x.paint.gradient.relative) {
      const g = x.paint.gradient;
      x.paint = { ...x.paint, gradient: { ...g, from: [g.from[0] + dx, g.from[1] + dy], to: [g.to[0] + dx, g.to[1] + dy] } };
    }
    if (x.vectorMask) x.vectorMask = { ...x.vectorMask, path: transformPath(x.vectorMask.path, [1, 0, 0, 1, dx, dy]) };
    if (x.mask) {
      const src = x.mask.mask, m = new Mask(w, h, src.outside);
      m.outside = src.outside;
      for (let y = 0; y < h; y++) for (let xx = 0; xx < w; xx++) m.data[y * w + xx] = src.get(xx - dx, y - dy);
      x.mask = { ...x.mask, mask: m };
    }
  }
}

// ——— commands ———

/** Layer › Smart Objects › Convert to Smart Object: the layers become one smart object cropped to their bounds. */
export function convertToSmart(doc: ImageDocument, ids: string[] = doc.selected): SmartLayer | null {
  const order = doc.all().map((l) => l.id);
  const picked = ids.map((id) => doc.find(id)).filter((l): l is Layer => !!l);
  // drop layers inside another picked container
  const inside = new Set<string>();
  for (const l of picked) if (isContainer(l)) for (const [c] of walk(l.children)) inside.add(c.id);
  const layers = picked.filter((l) => !inside.has(l.id)).sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
  if (!layers.length) return null;
  let b: Rect | null = null;
  for (const l of layers) b = rectUnion(b, layerBounds(doc, l));
  b = b ? rectIntersect(b, { x: b.x, y: b.y, w: Math.max(1, b.w), h: Math.max(1, b.h) }) : null;
  const box = b ?? doc.bounds;
  const bx = Math.floor(box.x), by = Math.floor(box.y), bw = Math.max(1, Math.ceil(box.x + box.w) - bx), bh = Math.max(1, Math.ceil(box.y + box.h) - by);
  return doc.change("Convert to Smart Object", () => {
    const children = cloneLayersCow(layers);
    for (const c of children) translateLayer(c, -bx, -by, bw, bh);
    const src: SmartSource = { v: 1, width: bw, height: bh, depth: doc.depth, dpi: doc.dpi, layers: children };
    if (doc.meta.textStyles) src.textStyles = structuredClone(doc.meta.textStyles);
    const name = layers.length === 1 ? layers[0]!.name : "Smart Object";
    const smart = doc.newSmart({ doc: src, width: bw, height: bh, name }, [1, 0, bx, 0, 1, by, 0, 0, 1], name);
    const top = layers[layers.length - 1]!;
    doc.add(smart, { above: top.id });
    doc.remove(layers.map((l) => l.id));
    doc.setActive(smart.id);
    return smart;
  }, "smart");
}

/** File › Place Embedded: a document as a new smart object (centered at native size unless a matrix is given). */
export function placeEmbedded(doc: ImageDocument, child: ImageDocument, matrix?: number[], name = child.name): SmartLayer {
  const m = matrix ?? [1, 0, Math.round((doc.width - child.width) / 2), 0, 1, Math.round((doc.height - child.height) / 2), 0, 0, 1];
  return doc.change("Place Embedded", () => doc.add(doc.newSmart({ doc: snapshotOf(child), width: child.width, height: child.height, name }, m, name)), "smart");
}

/** Edit Contents: a live document of the source. Save it back with commitContents(). */
export function editContents(doc: ImageDocument, id: string): ImageDocument | null {
  const l = doc.find(id);
  return l && l.kind === "smart" ? childDocument(sourceOf(l), l.source.name ?? l.name) : null;
}

/** Put an edited child document back into the smart object (one history step). */
export function commitContents(doc: ImageDocument, id: string, child: ImageDocument): void {
  const l = doc.find(id);
  if (!l || l.kind !== "smart") return;
  doc.change("Update Smart Object", () => {
    l.source = { ...l.source, doc: snapshotOf(child), width: child.width, height: child.height };
  }, "smart");
}

/** Replace Contents (a document or .march-image bytes); the placement matrix stays. */
export async function replaceContents(doc: ImageDocument, id: string, with_: ImageDocument | Uint8Array, name?: string): Promise<void> {
  const child = with_ instanceof ImageDocument ? with_ : await loadDocument(with_);
  const l = doc.find(id);
  if (!l || l.kind !== "smart") return;
  doc.change("Replace Contents", () => {
    l.source = { ...l.source, doc: snapshotOf(child), width: child.width, height: child.height, name: name ?? child.name };
  }, "smart");
}

/** Export Contents as .march-image bytes. */
export function exportContents(l: SmartLayer): Promise<Uint8Array> {
  return saveDocument(childDocument(sourceOf(l), l.source.name ?? l.name));
}

/** Rasterize a smart object (→ pixel layer, filters baked). One history step. */
export function rasterizeSmart(doc: ImageDocument, id: string): PixelLayer | null {
  const l = doc.find(id);
  if (!l || l.kind !== "smart") return null;
  prepareSmart(doc, l);
  return doc.change("Rasterize Smart Object", () => {
    const loc = doc.locate(id)!;
    const { source: _s, matrix: _m, warp: _w, filters: _f, filtersEnabled: _e, filterMask: _fm, raster, kind: _k, ...rest } = l;
    const px: PixelLayer = { ...rest, kind: "pixel", raster: raster.clone() };
    loc.list.splice(loc.index, 1, px);
    doc.activeId = px.id;
    return px;
  }, "rasterize");
}

/** New Smart Object via Copy: an independent copy (its own source) above the original. */
export function newSmartViaCopy(doc: ImageDocument, id: string): SmartLayer | null {
  const l = doc.find(id);
  if (!l || l.kind !== "smart") return null;
  return doc.change("New Smart Object via Copy", () => {
    const copy = deepCopyLayer(l);
    copy.source = { ...copy.source, doc: { ...sourceOf(l), layers: cloneLayersCow(sourceOf(l).layers) } };
    copy.name = `${l.name} copy`;
    const loc = doc.locate(id)!;
    loc.list.splice(loc.index + 1, 0, copy);
    doc.setActive(copy.id);
    return copy;
  }, "smart");
}

/** Set the placement matrix (3×3 row-major, or affine [a b c d e f]). One history step. */
export function setSmartMatrix(doc: ImageDocument, id: string, m: number[]): void {
  const l = doc.find(id);
  if (!l || l.kind !== "smart") return;
  doc.change("Transform", () => { bakeSmartOffset(l); l.matrix = toMat(m); }, "transform");
}

/** Scale about a point (Free Transform shortcut for scripts / tests). */
export function scaleSmart(doc: ImageDocument, id: string, sx: number, sy = sx, cx = 0, cy = 0): void {
  const l = doc.find(id);
  if (!l || l.kind !== "smart") return;
  setSmartMatrix(doc, id, mul3(translate3(cx, cy), mul3(scale3(sx, sy), mul3(translate3(-cx, -cy), toMat(l.matrix)))));
}

/** Fold the raster offset (Move tool) into the matrix. Call inside a change. */
export function bakeSmartOffset(l: SmartLayer): void {
  const ox = l.raster.ox, oy = l.raster.oy;
  if (!ox && !oy) return;
  l.matrix = mul3(translate3(ox, oy), toMat(l.matrix));
  l.raster.ox = 0; l.raster.oy = 0;
}

// smart filters

export function addSmartFilter(doc: ImageDocument, id: string, f: Omit<SmartFilter, "enabled"> & { enabled?: boolean }): void {
  const l = doc.find(id);
  if (!l || l.kind !== "smart") return;
  doc.change("Smart Filter", () => {
    l.filters = [...l.filters, { ...f, enabled: f.enabled ?? true }];
    if (!l.filterMask) { l.filterMask = new Mask(doc.width, doc.height, 255); l.filterMask.outside = 255; }
  }, "filter");
}

export function setSmartFilter(doc: ImageDocument, id: string, index: number, patch: Partial<SmartFilter>): void {
  const l = doc.find(id);
  if (!l || l.kind !== "smart" || !l.filters[index]) return;
  doc.change(patch.enabled === false ? "Hide Smart Filter" : patch.enabled === true ? "Show Smart Filter" : "Smart Filter Options", () => {
    l.filters = l.filters.map((f, i) => (i === index ? { ...f, ...patch } : f));
  }, "filter");
}

export function removeSmartFilter(doc: ImageDocument, id: string, index: number): void {
  const l = doc.find(id);
  if (!l || l.kind !== "smart") return;
  doc.change("Delete Smart Filter", () => { l.filters = l.filters.filter((_, i) => i !== index); if (!l.filters.length) l.filterMask = undefined; }, "filter");
}

export function setSmartFiltersEnabled(doc: ImageDocument, id: string, on: boolean): void {
  const l = doc.find(id);
  if (!l || l.kind !== "smart") return;
  doc.change(on ? "Show Smart Filters" : "Hide Smart Filters", () => { l.filtersEnabled = on; }, "filter");
}

// linked smart objects

/** How linked files are read (the app sets it: file picker handles, cloud storage…). */
export const smartLoader: { load?: ((path: string) => Promise<ImageDocument | Uint8Array>) | undefined } = {};

/** File › Place Linked: a smart object whose source is read from `path` (and refreshed by refreshLinked). */
export async function placeLinked(doc: ImageDocument, path: string, matrix?: number[]): Promise<SmartLayer | null> {
  if (!smartLoader.load) return null;
  const got = await smartLoader.load(path);
  const child = got instanceof ImageDocument ? got : await loadDocument(got);
  const name = path.split(/[\\/]/).pop() ?? path;
  const l = placeEmbedded(doc, child, matrix, name);
  doc.change("Place Linked", () => { const x = doc.find(l.id); if (x && x.kind === "smart") x.source = { ...x.source, linked: path }; }, "smart");
  return doc.find(l.id) as SmartLayer;
}

/** Update Modified Content: reload every linked smart object (one history step). Returns how many changed. */
export async function refreshLinked(doc: ImageDocument): Promise<number> {
  if (!smartLoader.load) return 0;
  const linked = doc.all().filter((l): l is SmartLayer => l.kind === "smart" && !!l.source.linked);
  const loaded: [string, ImageDocument][] = [];
  for (const l of linked) {
    try {
      const got = await smartLoader.load(l.source.linked!);
      loaded.push([l.id, got instanceof ImageDocument ? got : await loadDocument(got)]);
    } catch { /* missing file: keep the embedded copy */ }
  }
  if (!loaded.length) return 0;
  doc.change("Update Modified Content", () => {
    for (const [id, child] of loaded) {
      const l = doc.find(id);
      if (l && l.kind === "smart") l.source = { ...l.source, doc: snapshotOf(child), width: child.width, height: child.height };
    }
  }, "smart");
  return loaded.length;
}

/** Convert an embedded smart object to linked (the app saved the contents to `path`). */
export function setLinked(doc: ImageDocument, id: string, path: string | null): void {
  const l = doc.find(id);
  if (!l || l.kind !== "smart") return;
  doc.change(path ? "Convert to Linked" : "Embed Linked", () => {
    const s = { ...l.source };
    if (path) s.linked = path; else delete s.linked;
    l.source = s;
  }, "smart");
}

