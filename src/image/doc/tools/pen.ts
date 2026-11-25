// Pen tools (P): pen (click corners, drag smooth handles, close on the first anchor, Alt breaks handles, Ctrl is the
// direct selection tool while held, rubber band preview), freeform pen (optionally magnetic: samples snap to the
// strongest edge nearby), curvature pen (points on the curve, handles computed), add / delete / convert anchor, and
// the path selection (A: whole subpaths, move, Alt-drag duplicates) and direct selection (anchors and handles, marquee)
// tools. Every press → release is one history step.

import type { ImageDocument } from "../document.ts";
import { anchor, clonePath, flatten, hitPath, splitSegment, type Anchor, type PathData, type SubPath } from "../paths.ts";
import { renderRegion } from "../composite.ts";
import { simplify } from "../selection.ts";
import type { Rect } from "../tiles.ts";
import { newShapeLayer } from "../shapes/render.ts";
import { docPathTarget, pathTarget, penPathTarget, shapePathTarget, targetKey, type PathTarget } from "./path-ops.ts";
import type { OverlayShape, PointerSample, Tool, ToolContext } from "./tool.ts";

type Pt = [number, number];

const tol = (ctx: ToolContext): number => 6 / Math.max(1e-3, ctx.zoom);
const dist = (ax: number, ay: number, bx: number, by: number): number => Math.hypot(ax - bx, ay - by);

function state<T extends object>(ctx: ToolContext, key: string, init: () => T): T {
  let s = ctx.shared[key] as T | undefined;
  if (!s) { s = init(); ctx.shared[key] = s; }
  return s;
}

/** Nearest anchor within a radius. */
export function nearestAnchor(p: PathData, x: number, y: number, r: number): { sub: number; idx: number } | null {
  let best: { sub: number; idx: number } | null = null, bd = r;
  p.subpaths.forEach((sp, si) => sp.anchors.forEach((a, ai) => { const d = dist(a.x, a.y, x, y); if (d <= bd) { bd = d; best = { sub: si, idx: ai }; } }));
  return best;
}

/** Nearest direction handle (not sitting on its anchor) of the given anchors. */
export function nearestHandle(p: PathData, x: number, y: number, r: number, among: { sub: number; idx: number }[]): { sub: number; idx: number; which: "in" | "out" } | null {
  let best: { sub: number; idx: number; which: "in" | "out" } | null = null, bd = r;
  for (const { sub, idx } of among) {
    const a = p.subpaths[sub]?.anchors[idx];
    if (!a) continue;
    if ((a.ix !== a.x || a.iy !== a.y) && dist(a.ix, a.iy, x, y) <= bd) { bd = dist(a.ix, a.iy, x, y); best = { sub, idx, which: "in" }; }
    if ((a.ox !== a.x || a.oy !== a.y) && dist(a.ox, a.oy, x, y) <= bd) { bd = dist(a.ox, a.oy, x, y); best = { sub, idx, which: "out" }; }
  }
  return best;
}

/** Point inside a closed subpath (nonzero winding of its flattened outline). */
export function insideSubpath(sp: SubPath, x: number, y: number): boolean {
  if (!sp.closed || sp.anchors.length < 3) return false;
  const pts = flatten(sp, 0.5);
  let w = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i]!, [x1, y1] = pts[(i + 1) % pts.length]!;
    if (y0 <= y) { if (y1 > y && (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0) > 0) w++; }
    else if (y1 <= y && (x1 - x0) * (y - y0) - (x - x0) * (y1 - y0) < 0) w--;
  }
  return w !== 0;
}

/** Set an anchor's outgoing handle; the incoming one mirrors it unless `breakHandles`. */
function dragHandles(a: Anchor, x: number, y: number, breakHandles: boolean): void {
  a.ox = x; a.oy = y;
  if (breakHandles) { a.type = "corner"; return; }
  a.ix = 2 * a.x - x; a.iy = 2 * a.y - y;
  a.type = "symmetric";
}

/** Catmull-Rom handles for points on a curve (corner points get none). */
export function smoothAnchors(pts: { x: number; y: number; corner?: boolean | undefined }[], closed: boolean, tension = 1 / 6): Anchor[] {
  const n = pts.length;
  return pts.map((p, i) => {
    const a = anchor(p.x, p.y, p.corner ? "corner" : "smooth");
    if (p.corner || n < 3 && !closed) return a;
    const prev = pts[closed ? (i - 1 + n) % n : Math.max(0, i - 1)]!, next = pts[closed ? (i + 1) % n : Math.min(n - 1, i + 1)]!;
    if (!closed && (i === 0 || i === n - 1)) {
      // ends: aim the single handle toward the neighbour's direction
      const o = i === 0 ? next : prev, k = tension * 2;
      const hx = (o.x - p.x) * k, hy = (o.y - p.y) * k;
      if (i === 0) { a.ox = p.x + hx; a.oy = p.y + hy; } else { a.ix = p.x + hx; a.iy = p.y + hy; }
      return a;
    }
    const tx = (next.x - prev.x) * tension, ty = (next.y - prev.y) * tension;
    a.ox = p.x + tx; a.oy = p.y + ty; a.ix = p.x - tx; a.iy = p.y - ty;
    return a;
  });
}

// ——— selection state shared by the selection tools ———

interface PathSel { key: string; subs: number[]; anchors: string[] }
function selOf(ctx: ToolContext, t: PathTarget): PathSel {
  const s = state<PathSel>(ctx, "pathSelection", () => ({ key: "", subs: [], anchors: [] }));
  if (s.key !== targetKey(t)) { s.key = targetKey(t); s.subs = []; s.anchors = []; }
  return s;
}
const akey = (sub: number, idx: number): string => `${sub}:${idx}`;
const parseKey = (k: string): { sub: number; idx: number } => { const [a, b] = k.split(":"); return { sub: Number(a), idx: Number(b) }; };

function pathOverlay(ctx: ToolContext, t: PathTarget | null): OverlayShape[] {
  if (!t) return [];
  const s = ctx.shared.pathSelection as PathSel | undefined;
  const selected = s && s.key === targetKey(t) ? s.anchors.map((k) => { const { sub, idx } = parseKey(k); let n = 0; t.get().subpaths.slice(0, sub).forEach((sp) => (n += sp.anchors.length)); return n + idx; }) : undefined;
  return [{ type: "path", path: t.get(), anchors: true, ...(selected ? { selected } : {}) }];
}

// ——— pen ———

interface PenState { building: { key: string; sub: number } | null; drag: { sub: number; idx: number; closing: boolean } | null; hover: Pt | null; delegated: boolean }
const penState = (ctx: ToolContext): PenState => state<PenState>(ctx, "pen", () => ({ building: null, drag: null, hover: null, delegated: false }));

function targetFromKey(ctx: ToolContext, key: string): PathTarget | null {
  const [kind, id] = [key.slice(0, key.indexOf(":")), key.slice(key.indexOf(":") + 1)];
  if (kind === "shape") return ctx.doc.find(id)?.kind === "shape" ? shapePathTarget(ctx.doc, id) : null;
  if (kind === "doc") return ctx.doc.paths.some((p) => p.id === id) ? docPathTarget(ctx.doc, id) : null;
  return null;
}

/** Start a new path target for the pen: the Work Path / selected path, or a new shape layer in Shape mode. */
function newPenTarget(ctx: ToolContext): PathTarget {
  if (ctx.options.mode === "shape") {
    const fill = (ctx.options.fill as [number, number, number, number] | null | undefined) ?? ctx.fg;
    const l = ctx.doc.add(newShapeLayer(ctx.doc, { subpaths: [] }, { type: "solid", color: [...fill] as [number, number, number, number] }, null, "Shape"));
    return shapePathTarget(ctx.doc, l.id);
  }
  return penPathTarget(ctx, true)!;
}

export const directSelectTool: Tool = makeDirectSelect();

export const penTool: Tool = {
  id: "pen", group: "pen", label: "Pen", icon: "pen", key: "p",
  options: [
    { key: "mode", label: "Mode", kind: "choice", default: "path", options: [{ value: "path", label: "Path" }, { value: "shape", label: "Shape" }] },
    { key: "pathOp", label: "Path operation", kind: "choice", default: "add", options: [{ value: "add", label: "Combine" }, { value: "subtract", label: "Subtract" }, { value: "intersect", label: "Intersect" }, { value: "exclude", label: "Exclude" }] },
    { key: "rubberBand", label: "Rubber band", kind: "boolean", default: true },
  ],
  cursor: (ctx, p) => {
    const s = penState(ctx);
    if (p?.ctrl) return "pointer";
    if (s.building && p) {
      const t = targetFromKey(ctx, s.building.key), sp = t?.get().subpaths[s.building.sub];
      const f = sp?.anchors[0];
      if (f && sp && sp.anchors.length > 1 && dist(f.x, f.y, p.x, p.y) <= tol(ctx)) return "pen-convert";
    }
    return "pen";
  },
  down(ctx, p) {
    const s = penState(ctx);
    if (p.ctrl) { s.delegated = true; directSelectTool.down?.(ctx, p); return; }
    s.delegated = false;
    ctx.doc.begin("Pen", "pen");
    let t = s.building ? targetFromKey(ctx, s.building.key) : null;
    const sp0 = t && s.building ? t.get().subpaths[s.building.sub] : undefined;
    if (t && s.building && sp0 && !sp0.closed) {
      const path = clonePath(t.get()), sp = path.subpaths[s.building.sub]!;
      const first = sp.anchors[0]!, last = sp.anchors[sp.anchors.length - 1]!;
      if (p.alt && dist(last.x, last.y, p.x, p.y) <= tol(ctx)) {
        // Alt-click the last anchor: drop its outgoing handle (a corner for the next segment)
        last.ox = last.x; last.oy = last.y; last.type = "corner";
        s.drag = { sub: s.building.sub, idx: sp.anchors.length - 1, closing: false };
      } else if (sp.anchors.length > 1 && dist(first.x, first.y, p.x, p.y) <= tol(ctx)) {
        sp.closed = true;
        s.drag = { sub: s.building.sub, idx: 0, closing: true };
      } else {
        sp.anchors.push(anchor(p.x, p.y));
        s.drag = { sub: s.building.sub, idx: sp.anchors.length - 1, closing: false };
      }
      t.set(path);
    } else {
      t = newPenTarget(ctx);
      const path = clonePath(t.get());
      const sub: SubPath = { closed: false, anchors: [anchor(p.x, p.y)] };
      const op = ctx.options.pathOp as SubPath["op"] | undefined;
      if (path.subpaths.length && op && op !== "add") sub.op = op;
      path.subpaths.push(sub);
      t.set(path);
      s.building = { key: targetKey(t), sub: path.subpaths.length - 1 };
      s.drag = { sub: s.building.sub, idx: 0, closing: false };
    }
    ctx.invalidate(null);
  },
  move(ctx, p) {
    const s = penState(ctx);
    if (s.delegated) { directSelectTool.move?.(ctx, p); return; }
    s.hover = [p.x, p.y];
    if (!s.drag || !s.building) return;
    const t = targetFromKey(ctx, s.building.key);
    if (!t) return;
    const path = clonePath(t.get()), a = path.subpaths[s.drag.sub]?.anchors[s.drag.idx];
    if (!a || dist(a.x, a.y, p.x, p.y) < 1) return;
    dragHandles(a, p.x, p.y, p.alt);
    t.set(path);
    ctx.invalidate(null);
  },
  up(ctx, p) {
    const s = penState(ctx);
    if (s.delegated) { directSelectTool.up?.(ctx, p); s.delegated = false; return; }
    if (s.drag?.closing) s.building = null;
    s.drag = null;
    ctx.doc.commit();
  },
  hover(ctx, p) { penState(ctx).hover = [p.x, p.y]; ctx.invalidate(null); },
  commit(ctx) { const s = penState(ctx); s.building = null; s.drag = null; },
  cancel(ctx) { const s = penState(ctx); s.building = null; s.drag = null; },
  pending: (ctx) => !!penState(ctx).building,
  deactivate(ctx) { const s = penState(ctx); s.building = null; },
  key_(ctx, e) {
    if (e.type !== "down") return false;
    if (e.key === "Enter" || e.key === "Escape") { penState(ctx).building = null; ctx.invalidate(null); return true; }
    return false;
  },
  overlay(ctx) {
    const s = penState(ctx);
    const t = s.building ? targetFromKey(ctx, s.building.key) : penPathTarget(ctx, false);
    const out = pathOverlay(ctx, t);
    if (t && s.building && s.hover && !s.drag && ctx.options.rubberBand !== false) {
      const sp = t.get().subpaths[s.building.sub];
      const last = sp?.anchors[sp.anchors.length - 1];
      if (last && !sp!.closed) {
        const band: SubPath = { closed: false, anchors: [{ ...last }, anchor(s.hover[0], s.hover[1])] };
        out.push({ type: "polyline", points: flatten(band, 0.5), dash: true });
      }
    }
    return out;
  },
};

// ——— freeform pen ———

/** The strongest edge (luminance gradient) within `radius` of a point, if above `contrast` (0–1). */
export function snapToEdge(doc: ImageDocument, x: number, y: number, radius: number, contrast: number): Pt {
  const r = Math.max(1, Math.round(radius));
  const rect: Rect = { x: Math.round(x) - r - 1, y: Math.round(y) - r - 1, w: 2 * r + 3, h: 2 * r + 3 };
  const px = renderRegion(doc, rect), w = rect.w, h = rect.h;
  const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) lum[i] = 0.299 * px[i * 4]! + 0.587 * px[i * 4 + 1]! + 0.114 * px[i * 4 + 2]!;
  let best: Pt = [x, y], bm = contrast * 4;
  for (let yy = 1; yy < h - 1; yy++) for (let xx = 1; xx < w - 1; xx++) {
    const dx = rect.x + xx - x, dy = rect.y + yy - y;
    if (dx * dx + dy * dy > r * r) continue;
    const L = (a: number, b: number): number => lum[(yy + b) * w + xx + a]!;
    const gx = L(1, -1) + 2 * L(1, 0) + L(1, 1) - L(-1, -1) - 2 * L(-1, 0) - L(-1, 1);
    const gy = L(-1, 1) + 2 * L(0, 1) + L(1, 1) - L(-1, -1) - 2 * L(0, -1) - L(1, -1);
    const m = Math.hypot(gx, gy) - Math.hypot(dx, dy) * 0.01;
    if (m > bm) { bm = m; best = [rect.x + xx + 0.5, rect.y + yy + 0.5]; }
  }
  return best;
}

interface FreeState { pts: Pt[] }
export const freeformPenTool: Tool = {
  id: "freeform-pen", group: "pen", label: "Freeform Pen", icon: "pen", key: "p",
  options: [
    { key: "mode", label: "Mode", kind: "choice", default: "path", options: [{ value: "path", label: "Path" }, { value: "shape", label: "Shape" }] },
    { key: "curveFit", label: "Curve fit", kind: "number", min: 0.5, max: 10, step: 0.5, unit: "px", default: 2 },
    { key: "magnetic", label: "Magnetic", kind: "boolean", default: false },
    { key: "width", label: "Width", kind: "number", min: 1, max: 256, unit: "px", default: 10, visible: (o) => !!o.magnetic },
    { key: "contrast", label: "Contrast", kind: "percent", min: 1, max: 100, default: 10, visible: (o) => !!o.magnetic },
  ],
  cursor: () => "pen",
  down(ctx, p) {
    const s = state<FreeState>(ctx, "freeform", () => ({ pts: [] }));
    s.pts = [snap(ctx, p)];
  },
  move(ctx, p) {
    const s = state<FreeState>(ctx, "freeform", () => ({ pts: [] }));
    if (!s.pts.length) return;
    const q = snap(ctx, p), l = s.pts[s.pts.length - 1]!;
    if (dist(q[0], q[1], l[0], l[1]) >= 1) s.pts.push(q);
    ctx.invalidate(null);
  },
  up(ctx) {
    const s = state<FreeState>(ctx, "freeform", () => ({ pts: [] }));
    const pts = s.pts;
    s.pts = [];
    if (pts.length < 2) return;
    const f = pts[0]!, l = pts[pts.length - 1]!;
    const closed = pts.length > 3 && dist(f[0], f[1], l[0], l[1]) <= tol(ctx) * 2;
    const simple = simplify(closed ? pts.slice(0, -1) : pts, Number(ctx.options.curveFit ?? 2));
    ctx.doc.change("Freeform Pen", () => {
      const t = newPenTarget(ctx), path = clonePath(t.get());
      path.subpaths.push({ closed, anchors: smoothAnchors(simple.map(([x, y]) => ({ x, y })), closed) });
      t.set(path);
    }, "pen");
  },
  overlay(ctx) {
    const s = ctx.shared.freeform as FreeState | undefined;
    const out = pathOverlay(ctx, penPathTarget(ctx, false));
    if (s?.pts.length) out.push({ type: "polyline", points: s.pts });
    return out;
  },
};

function snap(ctx: ToolContext, p: PointerSample): Pt {
  if (!ctx.options.magnetic) return [p.x, p.y];
  return snapToEdge(ctx.doc, p.x, p.y, Number(ctx.options.width ?? 10), Number(ctx.options.contrast ?? 10) / 100);
}

// ——— curvature pen ———

interface CurveState { key: string | null; sub: number; pts: { x: number; y: number; corner: boolean }[] }
const curveState = (ctx: ToolContext): CurveState => state<CurveState>(ctx, "curvature", () => ({ key: null, sub: -1, pts: [] }));

export const curvaturePenTool: Tool = {
  id: "curvature-pen", group: "pen", label: "Curvature Pen", icon: "pen", key: "p",
  options: [{ key: "mode", label: "Mode", kind: "choice", default: "path", options: [{ value: "path", label: "Path" }, { value: "shape", label: "Shape" }] }],
  cursor: () => "pen",
  down(ctx, p) {
    const s = curveState(ctx);
    ctx.doc.change("Curvature Pen", () => {
      let t = s.key ? targetFromKey(ctx, s.key) : null;
      if (!t || !t.get().subpaths[s.sub]) { t = newPenTarget(ctx); s.key = targetKey(t); s.pts = []; s.sub = t.get().subpaths.length; }
      const f = s.pts[0];
      let closed = false;
      if (f && s.pts.length > 2 && dist(f.x, f.y, p.x, p.y) <= tol(ctx)) closed = true;
      else s.pts.push({ x: p.x, y: p.y, corner: p.alt });
      const path = clonePath(t.get());
      const sp: SubPath = { closed, anchors: smoothAnchors(s.pts, closed) };
      if (s.sub < path.subpaths.length) path.subpaths[s.sub] = sp; else path.subpaths.push(sp);
      t.set(path);
      if (closed) { s.key = null; s.pts = []; }
    }, "pen");
    ctx.invalidate(null);
  },
  dbl(ctx, p) {
    // double click a point: corner ↔ smooth
    const s = curveState(ctx);
    const t = s.key ? targetFromKey(ctx, s.key) : null;
    const k = s.pts.findIndex((q) => dist(q.x, q.y, p.x, p.y) <= tol(ctx));
    if (!t || k < 0) return;
    ctx.doc.change("Curvature Pen", () => {
      s.pts[k]!.corner = !s.pts[k]!.corner;
      const path = clonePath(t.get());
      path.subpaths[s.sub] = { closed: false, anchors: smoothAnchors(s.pts, false) };
      t.set(path);
    }, "pen");
  },
  commit(ctx) { const s = curveState(ctx); s.key = null; s.pts = []; },
  cancel(ctx) { const s = curveState(ctx); s.key = null; s.pts = []; },
  pending: (ctx) => !!curveState(ctx).key,
  overlay(ctx) { const s = curveState(ctx); return pathOverlay(ctx, s.key ? targetFromKey(ctx, s.key) : penPathTarget(ctx, false)); },
};

// ——— anchor tools ———

export const addAnchorTool: Tool = {
  id: "add-anchor", group: "pen", label: "Add Anchor Point", icon: "pen-add", cursor: () => "pen-add",
  down(ctx, p) {
    const t = pathTarget(ctx, false);
    if (!t) return;
    const h = hitPath(t.get(), p.x, p.y);
    if (!h || h.dist > tol(ctx)) return;
    ctx.doc.change("Add Anchor Point", () => t.set(splitSegment(t.get(), h.sub, h.seg, h.t)), "pen");
  },
  overlay: (ctx) => pathOverlay(ctx, pathTarget(ctx, false)),
};

export const deleteAnchorTool: Tool = {
  id: "delete-anchor", group: "pen", label: "Delete Anchor Point", icon: "pen-remove", cursor: () => "pen-remove",
  down(ctx, p) {
    const t = pathTarget(ctx, false);
    if (!t) return;
    const a = nearestAnchor(t.get(), p.x, p.y, tol(ctx));
    if (!a) return;
    ctx.doc.change("Delete Anchor Point", () => {
      const path = clonePath(t.get()), sp = path.subpaths[a.sub]!;
      sp.anchors.splice(a.idx, 1);
      if (sp.anchors.length < 2) path.subpaths.splice(a.sub, 1);
      t.set(path);
    }, "pen");
  },
  overlay: (ctx) => pathOverlay(ctx, pathTarget(ctx, false)),
};

interface ConvertState { sub: number; idx: number; moved: boolean; key: string }
export const convertAnchorTool: Tool = {
  id: "convert-anchor", group: "pen", label: "Convert Point", icon: "pen-convert", cursor: () => "pen-convert",
  down(ctx, p) {
    const t = pathTarget(ctx, false);
    if (!t) return;
    const a = nearestAnchor(t.get(), p.x, p.y, tol(ctx));
    if (!a) return;
    ctx.shared.convert = { ...a, moved: false, key: targetKey(t) } satisfies ConvertState;
    ctx.doc.begin("Convert Point", "pen");
  },
  move(ctx, p) {
    const s = ctx.shared.convert as ConvertState | undefined, t = pathTarget(ctx, false);
    if (!s || !t) return;
    const path = clonePath(t.get()), a = path.subpaths[s.sub]?.anchors[s.idx];
    if (!a || dist(a.x, a.y, p.x, p.y) < 1) return;
    dragHandles(a, p.x, p.y, false);
    s.moved = true;
    t.set(path);
    ctx.invalidate(null);
  },
  up(ctx) {
    const s = ctx.shared.convert as ConvertState | undefined, t = pathTarget(ctx, false);
    if (!s) return;
    if (!s.moved && t) {
      const path = clonePath(t.get()), a = path.subpaths[s.sub]?.anchors[s.idx];
      if (a) { a.ix = a.x; a.iy = a.y; a.ox = a.x; a.oy = a.y; a.type = "corner"; t.set(path); }
    }
    ctx.shared.convert = undefined;
    ctx.doc.commit();
  },
  overlay: (ctx) => pathOverlay(ctx, pathTarget(ctx, false)),
};

// ——— path selection ———

interface MoveState { last: Pt; moved: boolean }

function subAt(p: PathData, x: number, y: number, r: number): number {
  const h = hitPath(p, x, y);
  if (h && h.dist <= r) return h.sub;
  for (let i = p.subpaths.length - 1; i >= 0; i--) if (insideSubpath(p.subpaths[i]!, x, y)) return i;
  return -1;
}

function translateSub(sp: SubPath, dx: number, dy: number): void {
  for (const a of sp.anchors) { a.x += dx; a.y += dy; a.ix += dx; a.iy += dy; a.ox += dx; a.oy += dy; }
}

export const pathSelectTool: Tool = {
  id: "path-select", group: "path-select", label: "Path Selection", icon: "pointer", key: "a",
  cursor: () => "pointer",
  down(ctx, p) {
    const t = pathTarget(ctx, false);
    if (!t) return;
    const sel = selOf(ctx, t), path = t.get();
    const hit = subAt(path, p.x, p.y, tol(ctx));
    if (hit < 0) { if (!p.shift) { sel.subs = []; sel.anchors = []; } ctx.invalidate(null); return; }
    if (p.shift) sel.subs = sel.subs.includes(hit) ? sel.subs.filter((s) => s !== hit) : [...sel.subs, hit];
    else if (!sel.subs.includes(hit)) sel.subs = [hit];
    sel.anchors = sel.subs.flatMap((s) => path.subpaths[s]!.anchors.map((_, i) => akey(s, i)));
    ctx.doc.begin(p.alt ? "Duplicate Path" : "Move Path", "path");
    if (p.alt) {
      const q = clonePath(path), copies = sel.subs.map((s) => clonePath({ subpaths: [path.subpaths[s]!] }).subpaths[0]!);
      const start = q.subpaths.length;
      q.subpaths.push(...copies);
      t.set(q);
      sel.subs = copies.map((_, i) => start + i);
      sel.anchors = sel.subs.flatMap((s) => q.subpaths[s]!.anchors.map((_, i) => akey(s, i)));
    }
    ctx.shared.pathMove = { last: [p.x, p.y], moved: false } satisfies MoveState;
  },
  move(ctx, p) {
    const m = ctx.shared.pathMove as MoveState | undefined, t = pathTarget(ctx, false);
    if (!m || !t) return;
    const sel = selOf(ctx, t), dx = p.x - m.last[0], dy = p.y - m.last[1];
    if (!dx && !dy) return;
    const path = clonePath(t.get());
    for (const s of sel.subs) if (path.subpaths[s]) translateSub(path.subpaths[s]!, dx, dy);
    t.set(path);
    m.last = [p.x, p.y]; m.moved = true;
    ctx.invalidate(null);
  },
  up(ctx) {
    if (!ctx.shared.pathMove) return;
    ctx.shared.pathMove = undefined;
    ctx.doc.commit();
  },
  key_(ctx, e) {
    if (e.type !== "down" || (e.key !== "Delete" && e.key !== "Backspace")) return false;
    const t = pathTarget(ctx, false);
    if (!t) return false;
    const sel = selOf(ctx, t);
    if (!sel.subs.length) return false;
    ctx.doc.change("Delete Path", () => { const q = clonePath(t.get()); q.subpaths = q.subpaths.filter((_, i) => !sel.subs.includes(i)); t.set(q); }, "path");
    sel.subs = []; sel.anchors = [];
    return true;
  },
  overlay: (ctx) => pathOverlay(ctx, pathTarget(ctx, false)),
};

// ——— direct selection ———

interface DirectState { mode: "anchors" | "handle" | "marquee"; start: Pt; last: Pt; handle?: { sub: number; idx: number; which: "in" | "out" } | undefined; rect?: Rect | undefined }

function makeDirectSelect(): Tool {
  return {
    id: "direct-select", group: "path-select", label: "Direct Selection", icon: "pointer", key: "a",
    cursor: () => "pointer",
    down(ctx, p) {
      const t = pathTarget(ctx, false);
      if (!t) { ctx.shared.direct = { mode: "marquee", start: [p.x, p.y], last: [p.x, p.y] } satisfies DirectState; return; }
      const sel = selOf(ctx, t), path = t.get(), r = tol(ctx);
      const selected = sel.anchors.map(parseKey);
      const h = nearestHandle(path, p.x, p.y, r, selected);
      if (h) {
        ctx.doc.begin("Direct Selection", "path");
        ctx.shared.direct = { mode: "handle", start: [p.x, p.y], last: [p.x, p.y], handle: h } satisfies DirectState;
        return;
      }
      const a = nearestAnchor(path, p.x, p.y, r);
      if (a) {
        const k = akey(a.sub, a.idx);
        if (p.shift) sel.anchors = sel.anchors.includes(k) ? sel.anchors.filter((x) => x !== k) : [...sel.anchors, k];
        else if (!sel.anchors.includes(k)) sel.anchors = [k];
        sel.subs = [...new Set(sel.anchors.map((x) => parseKey(x).sub))];
      } else {
        const seg = hitPath(path, p.x, p.y);
        if (seg && seg.dist <= r) {
          const sp = path.subpaths[seg.sub]!, k1 = akey(seg.sub, seg.seg), k2 = akey(seg.sub, (seg.seg + 1) % sp.anchors.length);
          sel.anchors = p.shift ? [...new Set([...sel.anchors, k1, k2])] : [k1, k2];
          sel.subs = [seg.sub];
        } else {
          if (!p.shift) { sel.anchors = []; sel.subs = []; }
          ctx.shared.direct = { mode: "marquee", start: [p.x, p.y], last: [p.x, p.y], rect: { x: p.x, y: p.y, w: 0, h: 0 } } satisfies DirectState;
          ctx.invalidate(null);
          return;
        }
      }
      ctx.doc.begin("Direct Selection", "path");
      ctx.shared.direct = { mode: "anchors", start: [p.x, p.y], last: [p.x, p.y] } satisfies DirectState;
      ctx.invalidate(null);
    },
    move(ctx, p) {
      const s = ctx.shared.direct as DirectState | undefined;
      if (!s) return;
      if (s.mode === "marquee") {
        s.rect = { x: Math.min(s.start[0], p.x), y: Math.min(s.start[1], p.y), w: Math.abs(p.x - s.start[0]), h: Math.abs(p.y - s.start[1]) };
        ctx.invalidate(null);
        return;
      }
      const t = pathTarget(ctx, false);
      if (!t) return;
      const sel = selOf(ctx, t), path = clonePath(t.get());
      if (s.mode === "handle" && s.handle) {
        const a = path.subpaths[s.handle.sub]?.anchors[s.handle.idx];
        if (!a) return;
        const out = s.handle.which === "out";
        if (out) { a.ox = p.x; a.oy = p.y; } else { a.ix = p.x; a.iy = p.y; }
        if (p.alt) a.type = "corner";
        else if (a.type !== "corner") {
          // keep the other handle in line (same length too when symmetric)
          const hx = p.x - a.x, hy = p.y - a.y, len = Math.hypot(hx, hy) || 1;
          const other = a.type === "symmetric" ? len : Math.hypot(out ? a.ix - a.x : a.ox - a.x, out ? a.iy - a.y : a.oy - a.y);
          const ox = a.x - (hx / len) * other, oy = a.y - (hy / len) * other;
          if (out) { a.ix = ox; a.iy = oy; } else { a.ox = ox; a.oy = oy; }
        }
      } else {
        const dx = p.x - s.last[0], dy = p.y - s.last[1];
        for (const k of sel.anchors) {
          const { sub, idx } = parseKey(k), a = path.subpaths[sub]?.anchors[idx];
          if (a) { a.x += dx; a.y += dy; a.ix += dx; a.iy += dy; a.ox += dx; a.oy += dy; }
        }
      }
      s.last = [p.x, p.y];
      t.set(path);
      ctx.invalidate(null);
    },
    up(ctx) {
      const s = ctx.shared.direct as DirectState | undefined;
      ctx.shared.direct = undefined;
      if (!s) return;
      if (s.mode === "marquee") {
        const t = pathTarget(ctx, false), r = s.rect;
        if (t && r && (r.w > 1 || r.h > 1)) {
          const sel = selOf(ctx, t), keys = new Set(sel.anchors);
          t.get().subpaths.forEach((sp, si) => sp.anchors.forEach((a, ai) => { if (a.x >= r.x && a.x <= r.x + r.w && a.y >= r.y && a.y <= r.y + r.h) keys.add(akey(si, ai)); }));
          sel.anchors = [...keys];
          sel.subs = [...new Set(sel.anchors.map((x) => parseKey(x).sub))];
        }
        ctx.invalidate(null);
        return;
      }
      ctx.doc.commit();
    },
    key_(ctx, e) {
      if (e.type !== "down" || (e.key !== "Delete" && e.key !== "Backspace")) return false;
      const t = pathTarget(ctx, false);
      if (!t) return false;
      const sel = selOf(ctx, t);
      if (!sel.anchors.length) return false;
      ctx.doc.change("Delete Anchor Point", () => {
        const q = clonePath(t.get()), drop = new Set(sel.anchors);
        q.subpaths = q.subpaths.map((sp, si) => ({ ...sp, anchors: sp.anchors.filter((_, ai) => !drop.has(akey(si, ai))) })).filter((sp) => sp.anchors.length > 1);
        t.set(q);
      }, "path");
      sel.anchors = []; sel.subs = [];
      return true;
    },
    overlay(ctx) {
      const out = pathOverlay(ctx, pathTarget(ctx, false));
      const s = ctx.shared.direct as DirectState | undefined;
      if (s?.mode === "marquee" && s.rect) out.push({ type: "rect", rect: s.rect, dash: true });
      return out;
    },
  };
}
