// Path targets and path operations for the pen / selection / shape tools and the Paths panel: which path a tool
// edits (the selected path in the Paths panel, the active shape layer, the active layer's vector mask, or the Work
// Path, created on demand), and Fill Path, Stroke Path (through the brush engine when the app provides one), Make
// Selection, Make Vector Mask, Make Work Path from the selection, Save Path.

import { blurPlane } from "../alpha.ts";
import type { ImageDocument, PathItem } from "../document.ts";
import { newId, type Layer, type Paint, type RGBA } from "../layers.ts";
import { clonePath, fillPolygons, flatten, pathBounds, type PathData } from "../paths.ts";
import { renderPaint } from "../paint.ts";
import * as select from "../selection.ts";
import { Mask, rectIntersect, type Rect } from "../tiles.ts";
import { pathCoverage, setShapePath, strokePathPolygons } from "../shapes/render.ts";
import type { ToolContext } from "./tool.ts";

export interface PathTarget {
  kind: "doc" | "shape" | "vector-mask";
  /** Path item id or layer id. */
  id: string;
  get(): PathData;
  /** Replace the path (call inside a change). */
  set(p: PathData): void;
}

/** A key that identifies a target across events (selection state is kept per target). */
export const targetKey = (t: PathTarget): string => `${t.kind}:${t.id}`;

function docTarget(doc: ImageDocument, id: string): PathTarget {
  return {
    kind: "doc", id,
    get: () => doc.paths.find((p) => p.id === id)?.path ?? { subpaths: [] },
    set: (p) => { doc.paths = doc.paths.map((x) => (x.id === id ? { ...x, path: p } : x)); },
  };
}

function shapeTarget(doc: ImageDocument, id: string): PathTarget {
  return {
    kind: "shape", id,
    get: () => { const l = doc.find(id); if (!l || l.kind !== "shape") return { subpaths: [] }; return l.raster.ox || l.raster.oy ? { ...clonePath(l.path), subpaths: clonePath(l.path).subpaths.map((s) => ({ ...s, anchors: s.anchors.map((a) => ({ ...a, x: a.x + l.raster.ox, y: a.y + l.raster.oy, ix: a.ix + l.raster.ox, iy: a.iy + l.raster.oy, ox: a.ox + l.raster.ox, oy: a.oy + l.raster.oy })) })) } : l.path; },
    set: (p) => { const l = doc.find(id); if (l && l.kind === "shape") setShapePath(l, p); },
  };
}

function maskTarget(doc: ImageDocument, id: string): PathTarget {
  return {
    kind: "vector-mask", id,
    get: () => doc.find(id)?.vectorMask?.path ?? { subpaths: [] },
    set: (p) => { const l = doc.find(id); if (l?.vectorMask) l.vectorMask = { ...l.vectorMask, path: p }; },
  };
}

/** The Work Path item, created when missing (call inside a change when `create`). */
export function workPath(doc: ImageDocument, create: boolean): PathItem | null {
  const w = doc.paths.find((p) => p.work);
  if (w || !create) return w ?? null;
  const item: PathItem = { id: newId("p"), name: "Work Path", path: { subpaths: [] }, work: true };
  doc.paths = [...doc.paths, item];
  return item;
}

/**
 * The path the selection / anchor tools edit: the path selected in the Paths panel (ctx.shared.activePathId), else
 * the active shape layer, else the active layer's vector mask, else the Work Path (created when `create`, inside a
 * change).
 */
export function pathTarget(ctx: ToolContext, create = false): PathTarget | null {
  const doc = ctx.doc, pid = ctx.shared.activePathId as string | undefined;
  if (pid && doc.paths.some((p) => p.id === pid)) return docTarget(doc, pid);
  const a = doc.active;
  if (a?.kind === "shape") return shapeTarget(doc, a.id);
  if (a?.vectorMask) return maskTarget(doc, a.id);
  const w = workPath(doc, create);
  return w ? docTarget(doc, w.id) : null;
}

/** The path the pen edits in Path mode (the selected path item or the Work Path). */
export function penPathTarget(ctx: ToolContext, create: boolean): PathTarget | null {
  const doc = ctx.doc, pid = ctx.shared.activePathId as string | undefined;
  if (pid && doc.paths.some((p) => p.id === pid)) return docTarget(doc, pid);
  const w = workPath(doc, create);
  return w ? docTarget(doc, w.id) : null;
}

export const shapePathTarget = shapeTarget;
export const docPathTarget = docTarget;

// ——— operations ———

function writableLayer(doc: ImageDocument, id?: string): (Layer & { kind: "pixel" }) | null {
  const l = id ? doc.find(id) : doc.active;
  return l && l.kind === "pixel" && !l.locks.pixels ? l : null;
}

/** Composite a paint through a coverage buffer into a pixel layer over r (straight over, selection respected). */
function paintInto(doc: ImageDocument, layer: Layer & { kind: "pixel" }, r: Rect, cov: Float32Array, paint: Paint, opacity = 1): void {
  const px = layer.raster.read(r.x, r.y, r.w, r.h), src = renderPaint(paint, r), sel = doc.selection;
  const keepAlpha = layer.locks.transparency;
  for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
    const i = y * r.w + x;
    let c = cov[i]! * opacity;
    if (sel) c *= sel.get(r.x + x, r.y + y) / 255;
    if (c <= 0) continue;
    const k = i * 4, sa = src[k + 3]! * c, da = px[k + 3]!, oa = keepAlpha ? da : sa + da * (1 - sa);
    if (oa <= 0) continue;
    for (let ch = 0; ch < 3; ch++) px[k + ch] = keepAlpha ? px[k + ch]! + (src[k + ch]! - px[k + ch]!) * sa : (src[k + ch]! * sa + px[k + ch]! * da * (1 - sa)) / oa;
    px[k + 3] = oa;
  }
  layer.raster.write(r.x, r.y, r.w, r.h, px);
}

const clipToDoc = (doc: ImageDocument, b: Rect | null, grow = 2): Rect | null => b ? rectIntersect({ x: Math.floor(b.x) - grow, y: Math.floor(b.y) - grow, w: Math.ceil(b.w) + grow * 2 + 1, h: Math.ceil(b.h) + grow * 2 + 1 }, doc.bounds) : null;

/** Paths panel › Fill Path: into the active (or given) pixel layer. One history step. */
export function fillPath(doc: ImageDocument, path: PathData, o: { paint?: Paint; color?: RGBA; opacity?: number; feather?: number; antialias?: boolean; layerId?: string } = {}): boolean {
  const layer = writableLayer(doc, o.layerId);
  const feather = o.feather ?? 0;
  const r = clipToDoc(doc, pathBounds(path), Math.ceil(feather * 2) + 2);
  if (!layer || !r) return false;
  doc.change("Fill Path", () => {
    let cov = pathCoverage(path, r, o.antialias ?? true);
    if (feather > 0) cov = blurPlane(cov.slice(), r.w, r.h, feather);
    paintInto(doc, layer, r, cov, o.paint ?? { type: "solid", color: o.color ?? [0, 0, 0, 1] }, o.opacity ?? 1);
  }, "path");
  return true;
}

/** Flattened points of a path's subpaths (for the brush engine). */
export function pathPoints(path: PathData, tol = 0.5): [number, number][][] {
  return path.subpaths.filter((s) => s.anchors.length).map((s) => { const p = flatten(s, tol); if (s.closed && p.length) p.push(p[0]!); return p; });
}

/**
 * Paths panel › Stroke Path. With `ctx.shared.strokeWithBrush` (the brush engine) each subpath's points go to it
 * (pressure simulated when `simulatePressure`); otherwise a plain round stroke of `width` in the foreground color.
 * One history step.
 */
export function strokePath(ctx: ToolContext, path: PathData, o: { width?: number; color?: RGBA; simulatePressure?: boolean; layerId?: string } = {}): boolean {
  const doc = ctx.doc;
  const brush = ctx.shared.strokeWithBrush as ((points: { x: number; y: number; pressure: number }[]) => void) | undefined;
  const polys = pathPoints(path);
  if (!polys.length) return false;
  if (brush) {
    doc.change("Stroke Path", () => {
      for (const pts of polys) {
        const n = pts.length;
        brush(pts.map(([x, y], i) => ({ x, y, pressure: o.simulatePressure ? Math.sin((Math.PI * i) / Math.max(1, n - 1)) * 0.9 + 0.1 : 1 })));
      }
    }, "path");
    return true;
  }
  const layer = writableLayer(doc, o.layerId);
  const width = o.width ?? (ctx.options.strokeWidth as number | undefined) ?? 3;
  const r = clipToDoc(doc, pathBounds(path), Math.ceil(width) + 2);
  if (!layer || !r) return false;
  doc.change("Stroke Path", () => {
    const cov = new Float32Array(r.w * r.h);
    fillPolygons(strokePathPolygons(path, width, { cap: "round", join: "round" }), "nonzero", r, (x, y, c) => { cov[(y - r.y) * r.w + (x - r.x)] = c; });
    paintInto(doc, layer, r, cov, { type: "solid", color: o.color ?? ctx.fg });
  }, "path");
  return true;
}

/** A path as a document-size mask (subpath ops respected), feathered. */
export function pathSelectionMask(doc: ImageDocument, path: PathData, antialias = true, feather = 0): Mask {
  const m = new Mask(doc.width, doc.height);
  let cov = pathCoverage(path, doc.bounds, antialias);
  if (feather > 0) cov = blurPlane(cov.slice(), doc.width, doc.height, feather);
  const d = m.data;
  for (let i = 0; i < d.length; i++) d[i] = Math.round(Math.max(0, Math.min(1, cov[i]!)) * 255);
  return m;
}

/** Paths panel › Make Selection (feather radius, anti-alias, new / add / subtract / intersect). One history step. */
export function pathToSelection(doc: ImageDocument, path: PathData, o: { feather?: number; antialias?: boolean; op?: select.SelectOp } = {}): void {
  doc.change("Make Selection", () => select.combine(doc, pathSelectionMask(doc, path, o.antialias ?? true, o.feather ?? 0), o.op ?? "new"), "select");
}

/** Layer › Vector Mask › Current Path. One history step. */
export function makeVectorMask(doc: ImageDocument, layerId: string, path: PathData): void {
  const l = doc.find(layerId);
  if (!l) return;
  doc.change("Add Vector Mask", () => { l.vectorMask = { path: clonePath(path), enabled: true, linked: true, density: 1, feather: 0 }; }, "mask");
}

/**
 * The selection's outline as closed polygons, simplified (Douglas–Peucker per half, so closed rings keep their
 * corners — selection.ts selectionToPath drops rings whose first and last points coincide: reported to the core).
 */
export function selectionOutlinePath(m: Mask, tolerance = 2): PathData {
  const segs = select.outline(m);
  const key = (x: number, y: number): string => `${x},${y}`;
  const at = new Map<string, number[][]>();
  for (const sg of segs) for (const [a, b] of [[0, 1], [2, 3]] as const) { const k = key(sg[a]!, sg[b]!); if (!at.has(k)) at.set(k, []); at.get(k)!.push(sg); }
  const used = new Set<number[]>(), subs: PathData["subpaths"] = [];
  for (const sg of segs) {
    if (used.has(sg)) continue;
    used.add(sg);
    const ring: [number, number][] = [[sg[0]!, sg[1]!], [sg[2]!, sg[3]!]];
    for (;;) {
      const [lx, ly] = ring[ring.length - 1]!;
      const next = (at.get(key(lx, ly)) ?? []).find((t) => !used.has(t));
      if (!next) break;
      used.add(next);
      ring.push(next[0]! === lx && next[1]! === ly ? [next[2]!, next[3]!] : [next[0]!, next[1]!]);
    }
    if (ring.length > 2 && ring[0]![0] === ring[ring.length - 1]![0] && ring[0]![1] === ring[ring.length - 1]![1]) ring.pop();
    if (ring.length < 3) continue;
    // split at the point farthest from the start, simplify both halves
    let far = 0, fd = -1;
    ring.forEach(([x, y], i) => { const d = Math.hypot(x - ring[0]![0], y - ring[0]![1]); if (d > fd) { fd = d; far = i; } });
    const a = select.simplify(ring.slice(0, far + 1), tolerance), b = select.simplify([...ring.slice(far), ring[0]!], tolerance);
    const pts = [...a, ...b.slice(1, -1)];
    if (pts.length > 2) subs.push({ closed: true, anchors: pts.map(([x, y]) => ({ x, y, ix: x, iy: y, ox: x, oy: y, type: "corner" as const })) });
  }
  return { fillRule: "evenodd", subpaths: subs };
}

/** Paths panel › Make Work Path from the selection (tolerance in pixels). One history step. */
export function pathFromSelection(doc: ImageDocument, tolerance = 2): PathItem | null {
  if (!doc.selection) return null;
  const path = selectionOutlinePath(doc.selection, tolerance);
  return doc.change("Make Work Path", () => {
    const item: PathItem = { id: newId("p"), name: "Work Path", path, work: true };
    doc.paths = [...doc.paths.filter((p) => !p.work), item];
    return item;
  }, "path");
}

/** Save the Work Path under a name (Paths panel › Save Path). One history step. */
export function savePath(doc: ImageDocument, name: string): PathItem | null {
  const w = doc.paths.find((p) => p.work);
  if (!w) return null;
  return doc.change("Save Path", () => {
    const saved: PathItem = { id: w.id, name, path: w.path };
    doc.paths = doc.paths.map((p) => (p.id === w.id ? saved : p));
    return saved;
  }, "path");
}

