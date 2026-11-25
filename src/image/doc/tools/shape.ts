// Shape tools (U): rectangle, rounded rectangle, ellipse, polygon, line, custom shape. Modes: a new shape layer (live
// shape), a path (added to the Work Path / selected path with the path operation), or pixels (filled into the active
// pixel layer). Shift constrains (square, circle, 45° lines), Alt draws from the center; fill, stroke and stroke width,
// align, radius, sides / star / smooth corners, line weight and arrow heads come from the options. A click without a
// drag makes a 100 × 100 shape at the point.

import type { LiveShape, Paint, RGBA, StrokeStyle } from "../layers.ts";
import { clonePath, type PathData, type SubPath } from "../paths.ts";
import { liveShapePath, newShapeLayer } from "../shapes/render.ts";
import { customShapes } from "../shapes/custom.ts";
import { fillPath, penPathTarget } from "./path-ops.ts";
import type { PointerSample, Tool, ToolContext, ToolOption } from "./tool.ts";

export type ShapeKind = "rect" | "rounded" | "ellipse" | "polygon" | "line" | "custom";

interface DragState { start: [number, number]; end: [number, number]; shift: boolean; alt: boolean }

/** The live shape for a drag from `a` to `b` (Shift constrains, Alt from the center). */
export function shapeFromDrag(kind: ShapeKind, a: [number, number], b: [number, number], o: Record<string, unknown>, shift: boolean, alt: boolean): LiveShape {
  let [x0, y0] = a, [x1, y1] = b;
  if (kind === "line") {
    if (shift) {
      const ang = Math.round(Math.atan2(y1 - y0, x1 - x0) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(x1 - x0, y1 - y0);
      x1 = x0 + Math.cos(ang) * len; y1 = y0 + Math.sin(ang) * len;
    }
    if (alt) { x0 = 2 * a[0] - x1; y0 = 2 * a[1] - y1; }
    return { type: "line", x1: x0, y1: y0, x2: x1, y2: y1, width: Number(o.lineWidth ?? 2), arrows: [!!o.arrowStart, !!o.arrowEnd] };
  }
  let w = x1 - x0, h = y1 - y0;
  if (shift) { const m = Math.max(Math.abs(w), Math.abs(h)); w = Math.sign(w || 1) * m; h = Math.sign(h || 1) * m; }
  if (alt) { x0 -= w; y0 -= h; w *= 2; h *= 2; }
  const x = Math.min(x0, x0 + w), y = Math.min(y0, y0 + h), W = Math.abs(w), H = Math.abs(h);
  switch (kind) {
    case "rect": return { type: "rect", x, y, w: W, h: H, radius: [0, 0, 0, 0] };
    case "rounded": { const r = Number(o.radius ?? 10); return { type: "rect", x, y, w: W, h: H, radius: [r, r, r, r] }; }
    case "ellipse": return { type: "ellipse", cx: x + W / 2, cy: y + H / 2, rx: W / 2, ry: H / 2 };
    case "polygon": {
      // the polygon fits its circle in the dragged box (Shift keeps it regular)
      const star = o.star ? Number(o.starRatio ?? 50) / 100 : 0;
      return { type: "polygon", cx: x + W / 2, cy: y + H / 2, r: Math.min(W, H) / 2, sides: Number(o.sides ?? 5), star, angle: 0, smooth: Number(o.smooth ?? 0) / 100 };
    }
    case "custom": return { type: "custom", id: String(o.customShape ?? "heart"), x, y, w: W, h: H };
  }
  return { type: "rect", x, y, w: W, h: H, radius: [0, 0, 0, 0] };
}

const color = (v: unknown, fallback: RGBA): RGBA => (Array.isArray(v) && v.length === 4 ? (v as RGBA) : fallback);

function paints(ctx: ToolContext): { fill: Paint | null; stroke: StrokeStyle | null } {
  const o = ctx.options;
  const fill: Paint | null = o.fill === null || o.noFill ? null : { type: "solid", color: [...color(o.fill, ctx.fg)] as RGBA };
  const sw = Number(o.strokeWidth ?? 0);
  const stroke: StrokeStyle | null = sw > 0 && o.stroke !== null ? {
    paint: { type: "solid", color: [...color(o.stroke, ctx.bg)] as RGBA }, width: sw,
    align: (o.strokeAlign as StrokeStyle["align"] | undefined) ?? "inside", cap: (o.strokeCap as StrokeStyle["cap"] | undefined) ?? "butt",
    join: (o.strokeJoin as StrokeStyle["join"] | undefined) ?? "miter", ...(Array.isArray(o.dash) && o.dash.length ? { dash: o.dash as number[] } : {}),
  } : null;
  return { fill, stroke };
}

/** Commit a live shape in the tool's mode. */
export function commitShape(ctx: ToolContext, shape: LiveShape): void {
  const mode = (ctx.options.mode as string | undefined) ?? "shape";
  const doc = ctx.doc;
  if (mode === "path") {
    doc.change("Shape Path", () => {
      const t = penPathTarget(ctx, true)!, path = clonePath(t.get());
      const op = ctx.options.pathOp as SubPath["op"] | undefined;
      const add = liveShapePath(shape).subpaths.map((s, i) => (i === 0 && path.subpaths.length && op && op !== "add" ? { ...s, op } : s));
      path.subpaths.push(...add);
      t.set(path);
    }, "shape");
  } else if (mode === "pixels") {
    fillPath(doc, liveShapePath(shape), { color: color(ctx.options.fill, ctx.fg), antialias: ctx.options.antialias !== false });
  } else {
    const { fill, stroke } = paints(ctx);
    doc.change("New Shape Layer", () => doc.add(newShapeLayer(doc, shape, fill, stroke)), "shape");
  }
  ctx.invalidate(null);
}

const MODE: ToolOption = { key: "mode", label: "Mode", kind: "choice", default: "shape", options: [{ value: "shape", label: "Shape" }, { value: "path", label: "Path" }, { value: "pixels", label: "Pixels" }] };
const COMMON: ToolOption[] = [
  MODE,
  { key: "fill", label: "Fill", kind: "color", default: null, visible: (o) => o.mode !== "path" },
  { key: "stroke", label: "Stroke", kind: "color", default: null, visible: (o) => o.mode === "shape" || o.mode === undefined },
  { key: "strokeWidth", label: "Stroke width", kind: "number", min: 0, max: 288, unit: "px", default: 0, visible: (o) => o.mode === "shape" || o.mode === undefined },
  { key: "strokeAlign", label: "Align", kind: "choice", default: "inside", options: [{ value: "inside", label: "Inside" }, { value: "center", label: "Center" }, { value: "outside", label: "Outside" }], visible: (o) => o.mode !== "path" && o.mode !== "pixels" },
  { key: "pathOp", label: "Path operation", kind: "choice", default: "add", options: [{ value: "add", label: "Combine" }, { value: "subtract", label: "Subtract" }, { value: "intersect", label: "Intersect" }, { value: "exclude", label: "Exclude" }], visible: (o) => o.mode === "path" },
  { key: "antialias", label: "Anti-alias", kind: "boolean", default: true, visible: (o) => o.mode === "pixels" },
];
const EXTRA: Partial<Record<ShapeKind, ToolOption[]>> = {
  rounded: [{ key: "radius", label: "Radius", kind: "number", min: 0, max: 1000, unit: "px", default: 10 }],
  polygon: [
    { key: "sides", label: "Sides", kind: "number", min: 3, max: 100, default: 5 },
    { key: "star", label: "Star", kind: "boolean", default: false },
    { key: "starRatio", label: "Indent sides by", kind: "percent", min: 1, max: 99, default: 50, visible: (o) => !!o.star },
    { key: "smooth", label: "Smooth corners", kind: "percent", min: 0, max: 100, default: 0 },
  ],
  line: [
    { key: "lineWidth", label: "Weight", kind: "number", min: 1, max: 1000, unit: "px", default: 2 },
    { key: "arrowStart", label: "Arrow at start", kind: "boolean", default: false },
    { key: "arrowEnd", label: "Arrow at end", kind: "boolean", default: false },
  ],
  custom: [{ key: "customShape", label: "Shape", kind: "choice", default: "heart", options: customShapes().map((c) => ({ value: c.id, label: c.name })) }],
};

/** One shape tool. */
export function makeShapeTool(kind: ShapeKind, id: string, label: string): Tool {
  const key = `shapeDrag:${id}`;
  const preview = (ctx: ToolContext): PathData | null => {
    const s = ctx.shared[key] as DragState | undefined;
    return s ? liveShapePath(shapeFromDrag(kind, s.start, s.end, ctx.options, s.shift, s.alt)) : null;
  };
  const track = (ctx: ToolContext, p: PointerSample): void => {
    const s = ctx.shared[key] as DragState | undefined;
    if (!s) return;
    s.end = [p.x, p.y]; s.shift = p.shift; s.alt = p.alt;
    ctx.invalidate(null);
  };
  return {
    id, group: "shape", label, icon: `shape-${kind}`, key: "u",
    options: [...COMMON, ...(EXTRA[kind] ?? [])],
    cursor: () => "crosshair",
    down(ctx, p) { ctx.shared[key] = { start: [p.x, p.y], end: [p.x, p.y], shift: p.shift, alt: p.alt } satisfies DragState; },
    move: track,
    up(ctx, p) {
      track(ctx, p);
      const s = ctx.shared[key] as DragState | undefined;
      ctx.shared[key] = undefined;
      if (!s) return;
      let end = s.end;
      if (Math.hypot(end[0] - s.start[0], end[1] - s.start[1]) < 2) end = kind === "line" ? [s.start[0] + 100, s.start[1]] : [s.start[0] + 100, s.start[1] + 100];
      commitShape(ctx, shapeFromDrag(kind, s.start, end, ctx.options, s.shift, s.alt));
    },
    cancel(ctx) { ctx.shared[key] = undefined; },
    overlay(ctx) { const p = preview(ctx); return p ? [{ type: "path", path: p }] : []; },
  };
}

export const rectangleTool = makeShapeTool("rect", "rectangle", "Rectangle");
export const roundedRectangleTool = makeShapeTool("rounded", "rounded-rectangle", "Rounded Rectangle");
export const ellipseTool = makeShapeTool("ellipse", "ellipse", "Ellipse");
export const polygonTool = makeShapeTool("polygon", "polygon", "Polygon");
export const lineTool = makeShapeTool("line", "line", "Line");
export const customShapeTool = makeShapeTool("custom", "custom-shape", "Custom Shape");
export const shapeTools: Tool[] = [rectangleTool, roundedRectangleTool, ellipseTool, polygonTool, lineTool, customShapeTool];
