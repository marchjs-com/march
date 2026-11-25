// Shape layers: live shapes (rectangle with four radii, ellipse, polygon / star with smooth corners, line with arrow
// heads, custom shapes) that regenerate their path, boolean path operations between subpaths (combine / subtract /
// intersect / exclude, evaluated as coverage so the subpaths keep their `op`), and rendering into the layer's raster:
// fill paint, stroke aligned inside / center / outside with caps, joins, miter limit and dashes, all anti-aliased.

import type { ImageDocument } from "../document.ts";
import { baseLayer, type LiveShape, type Paint, type PixelLayer, type ShapeLayer, type StrokeStyle } from "../layers.ts";
import { anchor, clonePath, ellipsePath, fillPolygons, flatten, pathBounds, rectPath, signedArea, transformPath, type Anchor, type PathData, type SubPath } from "../paths.ts";
import { renderPaint } from "../paint.ts";
import { rectIntersect, TiledRaster, type Rect } from "../tiles.ts";
import { addPrepare, markShown, replaceRaster, stableKey, upToDate } from "./prepare.ts";
import { customShapePath } from "./custom.ts";

type Pt = [number, number];
type Poly = Pt[];

// ——— live shapes ———

const K = 0.5522847498;

/** Polygon or star with optionally rounded ("smooth") corners: smooth 0–1 of half the shorter edge. */
export function smoothPolygonPath(cx: number, cy: number, r: number, sides: number, star = 0, angle = 0, smooth = 0): PathData {
  const n = Math.max(3, Math.round(sides)), count = n * (star > 0 ? 2 : 1), pts: Pt[] = [];
  for (let i = 0; i < count; i++) {
    const rad = star > 0 && i % 2 === 1 ? r * (1 - Math.min(0.99, star)) : r;
    const t = angle - Math.PI / 2 + (i * Math.PI * 2) / count;
    pts.push([cx + Math.cos(t) * rad, cy + Math.sin(t) * rad]);
  }
  if (smooth <= 0) return { subpaths: [{ closed: true, anchors: pts.map(([x, y]) => anchor(x, y)) }] };
  const a: Anchor[] = [];
  for (let i = 0; i < count; i++) {
    const p = pts[i]!, prev = pts[(i + count - 1) % count]!, next = pts[(i + 1) % count]!;
    const lp = Math.hypot(prev[0] - p[0], prev[1] - p[1]), ln = Math.hypot(next[0] - p[0], next[1] - p[1]);
    const t = (Math.min(lp, ln) / 2) * Math.min(1, smooth);
    const ax = p[0] + ((prev[0] - p[0]) / lp) * t, ay = p[1] + ((prev[1] - p[1]) / lp) * t;
    const bx = p[0] + ((next[0] - p[0]) / ln) * t, by = p[1] + ((next[1] - p[1]) / ln) * t;
    a.push({ x: ax, y: ay, ix: ax, iy: ay, ox: ax + (p[0] - ax) * K, oy: ay + (p[1] - ay) * K, type: "corner" });
    a.push({ x: bx, y: by, ix: bx + (p[0] - bx) * K, iy: by + (p[1] - by) * K, ox: bx, oy: by, type: "corner" });
  }
  return { subpaths: [{ closed: true, anchors: a }] };
}

/** A line of `width` with optional arrow heads (width 500 %, length 1000 % of the line weight). */
export function linePath(x1: number, y1: number, x2: number, y2: number, width: number, arrows: [boolean, boolean] = [false, false]): PathData {
  const len = Math.hypot(x2 - x1, y2 - y1) || 1e-6, ux = (x2 - x1) / len, uy = (y2 - y1) / len;
  const w = Math.max(1, width), nx = -uy * w / 2, ny = ux * w / 2;
  const al = Math.min(len / 2, w * 10), aw = w * 5;
  const s = arrows[0] ? al : 0, e = arrows[1] ? al : 0;
  const sx = x1 + ux * s, sy = y1 + uy * s, ex = x2 - ux * e, ey = y2 - uy * e;
  const subs: SubPath[] = [{ closed: true, anchors: [anchor(sx + nx, sy + ny), anchor(ex + nx, ey + ny), anchor(ex - nx, ey - ny), anchor(sx - nx, sy - ny)] }];
  const head = (tx: number, ty: number, dx: number, dy: number): SubPath => {
    const bx = tx - dx * al, by = ty - dy * al, hx = -dy * aw / 2, hy = dx * aw / 2;
    return { closed: true, anchors: [anchor(tx, ty), anchor(bx + hx, by + hy), anchor(bx - hx, by - hy)] };
  };
  if (arrows[0]) subs.push(head(x1, y1, -ux, -uy));
  if (arrows[1]) subs.push(head(x2, y2, ux, uy));
  // one winding for every piece, so nonzero merges them
  const p: PathData = { subpaths: subs };
  for (const sp of p.subpaths) if (signedArea(sp.anchors.map((q) => [q.x, q.y])) < 0) sp.anchors.reverse();
  return p;
}

/** The path of a live shape. */
export function liveShapePath(s: LiveShape): PathData {
  switch (s.type) {
    case "rect": {
      const x = Math.min(s.x, s.x + s.w), y = Math.min(s.y, s.y + s.h);
      return rectPath(x, y, Math.abs(s.w), Math.abs(s.h), s.radius);
    }
    case "ellipse": return ellipsePath(s.cx, s.cy, Math.abs(s.rx), Math.abs(s.ry));
    case "polygon": return smoothPolygonPath(s.cx, s.cy, s.r, s.sides, s.star ?? 0, s.angle, s.smooth ?? 0);
    case "line": return linePath(s.x1, s.y1, s.x2, s.y2, s.width, s.arrows ?? [false, false]);
    case "custom": return customShapePath(s.id, s.x, s.y, s.w, s.h) ?? rectPath(s.x, s.y, s.w, s.h);
  }
}

// ——— stroking ———

/** Split a polyline into dashes; `pattern` lengths are in pixels (dash, gap, dash, gap…). */
export function dashPolyline(pts: Pt[], closed: boolean, pattern: number[], offset = 0): Pt[][] {
  const pat = pattern.filter((v) => v >= 0);
  const total = pat.reduce((a, b) => a + b, 0);
  if (!pat.length || total <= 0) return [closed && pts.length ? [...pts, pts[0]!] : pts];
  const src = closed && pts.length ? [...pts, pts[0]!] : pts;
  const out: Pt[][] = [];
  let idx = 0, left = pat[0]!, on = true, cur: Pt[] = [];
  // skip the offset
  let off = ((offset % total) + total) % total;
  while (off > 0) { if (off >= left) { off -= left; idx = (idx + 1) % pat.length; left = pat[idx]!; on = !on; } else { left -= off; off = 0; } }
  if (on && src.length) cur.push(src[0]!);
  for (let i = 0; i + 1 < src.length; i++) {
    let [x0, y0] = src[i]!;
    const [x1, y1] = src[i + 1]!;
    let seg = Math.hypot(x1 - x0, y1 - y0);
    while (seg > 0) {
      if (left >= seg) {
        left -= seg;
        if (on) cur.push([x1, y1]);
        seg = 0;
      } else {
        const t = left / seg, mx = x0 + (x1 - x0) * t, my = y0 + (y1 - y0) * t;
        if (on) { cur.push([mx, my]); out.push(cur); cur = []; } else cur = [[mx, my]];
        on = !on;
        idx = (idx + 1) % pat.length;
        seg -= left;
        left = pat[idx]!;
        x0 = mx; y0 = my;
      }
    }
  }
  if (on && cur.length > 1) out.push(cur);
  return out.filter((d) => d.length > 1);
}

function disc(x: number, y: number, r: number): Poly {
  const k = Math.max(8, Math.min(96, Math.ceil(r * 2))), c: Poly = [];
  for (let i = 0; i < k; i++) c.push([x + Math.cos((i / k) * Math.PI * 2) * r, y + Math.sin((i / k) * Math.PI * 2) * r]);
  return c;
}

/**
 * Outline polygons of a stroked polyline (fill them with nonzero): one quad per segment, joins (miter with limit,
 * round, bevel) at every vertex, caps (butt, round, square) at open ends. Pieces share one winding direction.
 */
export function strokeOutline(pts0: Pt[], closed: boolean, width: number, cap: StrokeStyle["cap"] = "butt", join: StrokeStyle["join"] = "miter", miterLimit = 4): Poly[] {
  // drop repeated points
  const pts: Pt[] = [];
  for (const p of pts0) { const q = pts[pts.length - 1]; if (!q || Math.hypot(q[0] - p[0], q[1] - p[1]) > 1e-6) pts.push(p); }
  if (closed && pts.length > 2) { const a = pts[0]!, b = pts[pts.length - 1]!; if (Math.hypot(a[0] - b[0], a[1] - b[1]) <= 1e-6) pts.pop(); }
  const r = width / 2, out: Poly[] = [], n = pts.length;
  if (r <= 0 || !n) return out;
  if (n === 1) { if (cap === "round") out.push(disc(pts[0]![0], pts[0]![1], r)); else if (cap === "square") { const [x, y] = pts[0]!; out.push([[x - r, y - r], [x + r, y - r], [x + r, y + r], [x - r, y + r]]); } return out; }
  const segs = closed ? n : n - 1;
  const dir = (i: number): [number, number] => { const a = pts[i % n]!, b = pts[(i + 1) % n]!, l = Math.hypot(b[0] - a[0], b[1] - a[1]); return [(b[0] - a[0]) / l, (b[1] - a[1]) / l]; };
  for (let i = 0; i < segs; i++) {
    const [x0, y0] = pts[i]!, [x1, y1] = pts[(i + 1) % n]!, [dx, dy] = dir(i);
    const nx = -dy * r, ny = dx * r;
    let sx = 0, sy = 0, ex = 0, ey = 0;
    if (!closed && cap === "square") { if (i === 0) { sx = dx * r; sy = dy * r; } if (i === segs - 1) { ex = dx * r; ey = dy * r; } }
    out.push([[x0 + nx - sx, y0 + ny - sy], [x1 + nx + ex, y1 + ny + ey], [x1 - nx + ex, y1 - ny + ey], [x0 - nx - sx, y0 - ny - sy]]);
  }
  // joins
  const first = closed ? 0 : 1, last = closed ? n - 1 : n - 2;
  for (let i = first; i <= last; i++) {
    const p = pts[i]!, [ax, ay] = dir((i - 1 + n) % n), [bx, by] = dir(i);
    const n0: Pt = [-ay * r, ax * r], n1: Pt = [-by * r, bx * r];
    const s = n0[0] * bx + n0[1] * by < 0 ? 1 : -1; // the outer side
    const o0: Pt = [p[0] + s * n0[0], p[1] + s * n0[1]], o1: Pt = [p[0] + s * n1[0], p[1] + s * n1[1]];
    if (join === "round") { out.push(disc(p[0], p[1], r)); continue; }
    out.push([p, o0, o1]);
    if (join === "miter") {
      const mx = n0[0] + n1[0], my = n0[1] + n1[1], ml = Math.hypot(mx, my);
      if (ml < 1e-9) continue;
      const cosHalf = (mx * n0[0] + my * n0[1]) / (ml * r);
      if (cosHalf <= 1e-6 || 1 / cosHalf > miterLimit) continue;
      const len = r / cosHalf;
      out.push([p, o0, [p[0] + (s * mx / ml) * len, p[1] + (s * my / ml) * len], o1]);
    }
  }
  if (!closed && cap === "round") { out.push(disc(pts[0]![0], pts[0]![1], r)); out.push(disc(pts[n - 1]![0], pts[n - 1]![1], r)); }
  for (const poly of out) if (signedArea(poly) < 0) poly.reverse();
  return out;
}

/** The polygons of a path's stroke at `width` (dashes in multiples of the width, like the classic Stroke Options). */
export function strokePathPolygons(p: PathData, width: number, s: Pick<StrokeStyle, "cap" | "join" | "dash" | "miterLimit">, tol = 0.2): Poly[] {
  const out: Poly[] = [];
  for (const sp of p.subpaths) {
    if (!sp.anchors.length) continue;
    const pts = flatten(sp, tol);
    if (s.dash && s.dash.length && s.dash.some((d) => d > 0)) {
      for (const d of dashPolyline(pts, sp.closed, s.dash.map((v) => v * width))) out.push(...strokeOutline(d, false, width, s.cap, s.join, s.miterLimit ?? 4));
    } else out.push(...strokeOutline(pts, sp.closed, width, s.cap, s.join, s.miterLimit ?? 4));
  }
  return out;
}

// ——— coverage ———

function cover(polys: Poly[], rule: "nonzero" | "evenodd", r: Rect, out = new Float32Array(r.w * r.h)): Float32Array {
  fillPolygons(polys, rule, r, (x, y, c) => { out[(y - r.y) * r.w + (x - r.x)] = c; });
  return out;
}

/** True when a path combines subpaths with subtract / intersect / exclude. */
export const hasBooleans = (p: PathData): boolean => p.subpaths.some((s, i) => i > 0 && s.op && s.op !== "add");

/**
 * Fill coverage 0–1 of a path over a region. Subpaths combine in order with their `op` (add, subtract, intersect,
 * exclude), each anti-aliased; without booleans the whole path fills at once with its fill rule (holes by winding).
 */
export function pathCoverage(p: PathData, r: Rect, antialias = true): Float32Array {
  const subs = p.subpaths.filter((s) => s.anchors.length > 1);
  let out: Float32Array;
  if (!hasBooleans(p)) out = cover(subs.map((s) => flatten(s)), p.fillRule ?? "nonzero", r);
  else {
    out = new Float32Array(r.w * r.h);
    const tmp = new Float32Array(r.w * r.h);
    subs.forEach((s, i) => {
      tmp.fill(0);
      cover([flatten(s)], "nonzero", r, tmp);
      const op = i === 0 ? "add" : s.op ?? "add";
      for (let k = 0; k < out.length; k++) {
        const a = out[k]!, b = tmp[k]!;
        out[k] = op === "add" ? a + b - a * b : op === "subtract" ? a * (1 - b) : op === "intersect" ? a * b : a + b - 2 * a * b;
      }
    });
  }
  if (!antialias) for (let k = 0; k < out.length; k++) out[k] = out[k]! >= 0.5 ? 1 : 0;
  return out;
}

/** Stroke coverage 0–1 over a region, aligned inside / center / outside the shape (open paths: center). */
export function strokeCoverage(p: PathData, s: StrokeStyle, r: Rect, fillCov?: Float32Array): Float32Array {
  const closed = p.subpaths.some((sp) => sp.closed);
  const align = closed ? s.align : "center";
  const width = align === "center" ? s.width : s.width * 2;
  const out = cover(strokePathPolygons(p, width, s), "nonzero", r);
  if (align !== "center") {
    const f = fillCov ?? pathCoverage(p, r);
    for (let k = 0; k < out.length; k++) out[k] = align === "inside" ? out[k]! * f[k]! : out[k]! * (1 - f[k]!);
  }
  return out;
}

/** How far a shape's pixels reach past its path bounds. */
function reach(l: Pick<ShapeLayer, "stroke">): number {
  const s = l.stroke;
  if (!s || s.width <= 0) return 2;
  const w = s.align === "center" ? s.width / 2 : s.align === "outside" ? s.width : 0;
  return Math.ceil(w * (s.join === "miter" ? Math.max(1, s.miterLimit ?? 4) : 1.5)) + 2;
}

/** Geometry-space rectangle a shape's pixels cover (path bounds + stroke reach), or null when empty. */
export function shapeRect(l: Pick<ShapeLayer, "path" | "stroke">): Rect | null {
  const b = pathBounds(l.path);
  if (!b) return null;
  const g = reach(l);
  const x = Math.floor(b.x) - g, y = Math.floor(b.y) - g;
  return { x, y, w: Math.ceil(b.x + b.w) + g - x, h: Math.ceil(b.y + b.h) + g - y };
}

/** Render a shape's pixels (straight RGBA) over a geometry-space region: fill, then the stroke over it. */
export function renderShapePixels(l: Pick<ShapeLayer, "path" | "fillPaint" | "stroke">, r: Rect): Float32Array {
  const n = r.w * r.h, out = new Float32Array(n * 4);
  const box = pathBounds(l.path) ?? r;
  const needFill = !!l.fillPaint || (!!l.stroke && l.stroke.align !== "center");
  const fc = needFill ? pathCoverage(l.path, r) : null;
  if (l.fillPaint && fc) {
    const px = renderPaint(l.fillPaint, r, undefined, box);
    for (let i = 0; i < n; i++) {
      const c = fc[i]!;
      if (c <= 0) continue;
      const k = i * 4;
      out[k] = px[k]!; out[k + 1] = px[k + 1]!; out[k + 2] = px[k + 2]!; out[k + 3] = px[k + 3]! * c;
    }
  }
  if (l.stroke && l.stroke.width > 0) {
    const sc = strokeCoverage(l.path, l.stroke, r, fc ?? undefined);
    const px = renderPaint(l.stroke.paint, r, undefined, box);
    for (let i = 0; i < n; i++) {
      const c = sc[i]!;
      if (c <= 0) continue;
      const k = i * 4, sa = px[k + 3]! * c, da = out[k + 3]!, oa = sa + da * (1 - sa);
      if (oa <= 0) continue;
      for (let ch = 0; ch < 3; ch++) out[k + ch] = (px[k + ch]! * sa + out[k + ch]! * da * (1 - sa)) / oa;
      out[k + 3] = oa;
    }
  }
  return out;
}

/** Bring a shape layer's raster up to date (the prepare hook; cheap when nothing changed). */
export function prepareShape(doc: ImageDocument, l: ShapeLayer): void {
  const key = stableKey([l.path, l.fillPaint, l.stroke, doc.width, doc.height]);
  if (upToDate(l.raster, key)) return;
  const full = shapeRect(l);
  // only the part that can show on the canvas (the raster offset is an extra translation)
  const view = { x: -l.raster.ox, y: -l.raster.oy, w: doc.width, h: doc.height };
  const r = full ? rectIntersect(full, { x: view.x - 64, y: view.y - 64, w: view.w + 128, h: view.h + 128 }) : null;
  replaceRaster(l.raster, r, r ? renderShapePixels(l, r) : null);
  markShown(l.raster, key);
}

/** Register the shape renderer (renderHooks.prepare for kind "shape"). */
export function installShapeRenderer(): () => void {
  return addPrepare("shape", (doc, l) => { if (l.kind === "shape") prepareShape(doc, l); });
}

// ——— commands (call inside doc.change, or use the wrappers that open one) ———

/** A new shape layer from a live shape (or a plain path). */
export function newShapeLayer(doc: ImageDocument, shape: LiveShape | PathData, fill: Paint | null, stroke: StrokeStyle | null = null, name?: string): ShapeLayer {
  const live = "type" in shape ? shape : undefined;
  const path = live ? liveShapePath(live) : clonePath(shape as PathData);
  const label = name ?? (live ? { rect: "Rectangle", ellipse: "Ellipse", polygon: "Polygon", line: "Line", custom: "Shape" }[live.type] : "Shape");
  const l: ShapeLayer = { ...baseLayer("shape", doc.nextName(label)), path, fillPaint: fill, stroke, raster: new TiledRaster(doc.depth) };
  if (live) l.live = { ...live } as LiveShape;
  return l;
}

/** Add a shape layer (one history step). */
export function addShapeLayer(doc: ImageDocument, shape: LiveShape | PathData, fill: Paint | null, stroke: StrokeStyle | null = null, name?: string): ShapeLayer {
  return doc.change("New Shape Layer", () => doc.add(newShapeLayer(doc, shape, fill, stroke, name)), "shape");
}

/** Change a live shape's properties (radius, sides…): the path follows. One history step. */
export function setLiveShape(doc: ImageDocument, id: string, patch: Partial<Record<string, unknown>>): void {
  const l = doc.find(id);
  if (!l || l.kind !== "shape" || !l.live) return;
  doc.change("Live Shape Properties", () => {
    const live = { ...l.live, ...patch } as LiveShape;
    const [ox, oy] = [l.raster.ox, l.raster.oy];
    l.live = live;
    l.path = liveShapePath(live);
    if (ox || oy) bakeShapeOffset(l, ox, oy);
  }, "shape");
}

/** Fold the raster offset (a Move tool move) into the path and live shape. Call inside a change. */
export function bakeShapeOffset(l: ShapeLayer, ox = l.raster.ox, oy = l.raster.oy): void {
  if (!ox && !oy) return;
  l.path = transformPath(l.path, [1, 0, 0, 1, ox, oy]);
  if (l.live) {
    const s = { ...l.live } as LiveShape & Record<string, number>;
    if (s.type === "line") { s.x1 += ox; s.y1 += oy; s.x2 += ox; s.y2 += oy; }
    else if (s.type === "ellipse" || s.type === "polygon") { s.cx += ox; s.cy += oy; }
    else { s.x += ox; s.y += oy; }
    l.live = s;
  }
  l.raster.ox = 0; l.raster.oy = 0;
}

/** Replace a shape's path (editing anchors ends the live shape). Call inside a change. */
export function setShapePath(l: ShapeLayer, path: PathData): void {
  l.path = clonePath(path);
  l.live = undefined;
  delete l.live;
  l.raster.ox = 0; l.raster.oy = 0;
}

/** Shape → pixel layer (Rasterize Layer). One history step. */
export function rasterizeShape(doc: ImageDocument, id: string): PixelLayer | null {
  const l = doc.find(id);
  if (!l || l.kind !== "shape") return null;
  prepareShape(doc, l);
  return doc.change("Rasterize Layer", () => {
    const loc = doc.locate(id)!;
    const { path: _p, fillPaint: _f, stroke: _s, live: _l, raster, kind: _k, ...rest } = l;
    const px: PixelLayer = { ...rest, kind: "pixel", raster: raster.clone() };
    loc.list.splice(loc.index, 1, px);
    doc.activeId = px.id;
    return px;
  }, "rasterize");
}
