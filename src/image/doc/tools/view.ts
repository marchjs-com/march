// View transforms (UI state, never in the document or its history) and the view tools: hand (H, Space held), rotate
// view (R) and zoom (Z). ViewState maps document pixels to screen pixels:
//   screen = rotate(angle) · (doc · zoom) + (panX, panY)
// Tools get document coordinates from the UI, which converts with the current view; the view tools rebuild the screen
// position from that (docToScreen with the live view), so a drag that moves the view itself stays stable.

import type { ImageDocument } from "../document.ts";
import type { Rect } from "../tiles.ts";
import type { OverlayShape, PointerSample, Tool, ToolContext } from "./tool.ts";

/** @tr Görünüm durumu (yakınlaştırma, kaydırma, döndürme). */
export interface ViewState { zoom: number; panX: number; panY: number; angle: number }

export const MIN_ZOOM = 1 / 100, MAX_ZOOM = 128;
/** Zoom steps of Ctrl+= / Ctrl+− and the zoom tool's clicks. */
export const ZOOM_STEPS = [1 / 100, 1 / 64, 1 / 48, 1 / 32, 1 / 24, 1 / 16, 1 / 12, 1 / 8, 1 / 6, 1 / 4, 1 / 3, 1 / 2, 2 / 3, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 24, 32, 64, 128];

export const defaultView = (): ViewState => ({ zoom: 1, panX: 0, panY: 0, angle: 0 });

/** Document point → screen point. */
export function docToScreen(v: ViewState, x: number, y: number): [number, number] {
  const a = (v.angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), X = x * v.zoom, Y = y * v.zoom;
  return [X * c - Y * s + v.panX, X * s + Y * c + v.panY];
}
/** Screen point → document point. */
export function screenToDoc(v: ViewState, sx: number, sy: number): [number, number] {
  const a = (v.angle * Math.PI) / 180, c = Math.cos(a), s = Math.sin(a), X = sx - v.panX, Y = sy - v.panY;
  return [(X * c + Y * s) / v.zoom, (-X * s + Y * c) / v.zoom];
}
/** The 2D matrix [a, b, c, d, e, f] (canvas setTransform order) of the view. */
export function viewMatrix(v: ViewState): [number, number, number, number, number, number] {
  const a = (v.angle * Math.PI) / 180, c = Math.cos(a) * v.zoom, s = Math.sin(a) * v.zoom;
  return [c, s, -s, c, v.panX, v.panY];
}
/** The document rectangle visible in a viewport (axis-aligned bounds of the rotated screen). */
export function visibleDocRect(v: ViewState, viewW: number, viewH: number): Rect {
  const pts = [screenToDoc(v, 0, 0), screenToDoc(v, viewW, 0), screenToDoc(v, 0, viewH), screenToDoc(v, viewW, viewH)];
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  // tolerate float noise of the rotation (cos 90° ≠ 0 exactly)
  const x = Math.floor(Math.min(...xs) + 1e-9), y = Math.floor(Math.min(...ys) + 1e-9);
  return { x, y, w: Math.ceil(Math.max(...xs) - 1e-9) - x, h: Math.ceil(Math.max(...ys) - 1e-9) - y };
}

const clampZoom = (z: number): number => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z));

/** Zoom to `zoom` keeping the document point under screen (sx, sy) fixed. */
export function zoomAt(v: ViewState, zoom: number, sx: number, sy: number): ViewState {
  const [dx, dy] = screenToDoc(v, sx, sy);
  const next = { ...v, zoom: clampZoom(zoom) };
  const [nx, ny] = docToScreen(next, dx, dy);
  next.panX += sx - nx; next.panY += sy - ny;
  return next;
}
/** The next zoom step in (dir 1) or out (dir −1). */
export function stepZoom(zoom: number, dir: 1 | -1): number {
  if (dir > 0) return ZOOM_STEPS.find((z) => z > zoom * 1.0001) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((z) => z < zoom / 1.0001) ?? MIN_ZOOM;
}
/** Rotate the view to `angle` (degrees) about screen point (sx, sy). */
export function rotateAt(v: ViewState, angle: number, sx: number, sy: number): ViewState {
  const [dx, dy] = screenToDoc(v, sx, sy);
  const next = { ...v, angle: ((angle % 360) + 540) % 360 - 180 };
  const [nx, ny] = docToScreen(next, dx, dy);
  next.panX += sx - nx; next.panY += sy - ny;
  return next;
}
/** Fit a document rectangle into the viewport (View › Fit on Screen when rect = the document), keeping the angle. */
export function fitRect(v: ViewState, r: Rect, viewW: number, viewH: number, margin = 0.95): ViewState {
  const a = (v.angle * Math.PI) / 180, c = Math.abs(Math.cos(a)), s = Math.abs(Math.sin(a));
  const bw = r.w * c + r.h * s, bh = r.w * s + r.h * c;
  const zoom = clampZoom(Math.min((viewW * margin) / Math.max(1, bw), (viewH * margin) / Math.max(1, bh)));
  const next = { ...v, zoom, panX: 0, panY: 0 };
  const [cx, cy] = docToScreen(next, r.x + r.w / 2, r.y + r.h / 2);
  next.panX = viewW / 2 - cx; next.panY = viewH / 2 - cy;
  return next;
}
export const fitDocument = (v: ViewState, doc: ImageDocument, viewW: number, viewH: number): ViewState => fitRect(v, doc.bounds, viewW, viewH);
/** 100 % centered. */
export const actualPixels = (v: ViewState, doc: ImageDocument, viewW: number, viewH: number): ViewState => centerOn({ ...v, zoom: 1 }, doc.width / 2, doc.height / 2, viewW, viewH);
/** Pan so a document point is at the viewport center. */
export function centerOn(v: ViewState, x: number, y: number, viewW: number, viewH: number): ViewState {
  const next = { ...v, panX: 0, panY: 0 };
  const [cx, cy] = docToScreen(next, x, y);
  next.panX = viewW / 2 - cx; next.panY = viewH / 2 - cy;
  return next;
}

// ——— shared view state for tools ———

/** The live view in ctx.shared.view (created on first use) and the viewport size in ctx.shared.viewport. */
export function viewOf(ctx: ToolContext): ViewState {
  let v = ctx.shared.view as ViewState | undefined;
  if (!v) ctx.shared.view = v = { ...defaultView(), zoom: ctx.zoom };
  return v;
}
export function setView(ctx: ToolContext, v: ViewState): void {
  ctx.shared.view = v;
  ctx.invalidate(null);
}
const viewport = (ctx: ToolContext): { w: number; h: number } => (ctx.shared.viewport as { w: number; h: number } | undefined) ?? { w: ctx.doc.width * viewOf(ctx).zoom, h: ctx.doc.height * viewOf(ctx).zoom };
/** The screen position of a pointer sample (the UI converted it with the current view). */
const screenOf = (ctx: ToolContext, p: PointerSample): [number, number] => docToScreen(viewOf(ctx), p.x, p.y);

/** Keys that switch to a view tool while held (the UI handles the switch and the return). */
export const SPRING_KEYS: Record<string, string> = { " ": "hand", "ctrl+ ": "zoom", "alt+ ": "zoom-out", "r": "rotate-view" };

// ——— hand ———

export function handTool(): Tool {
  let start: { s: [number, number]; pan: [number, number] } | null = null;
  return {
    id: "hand", group: "view", label: "Hand Tool", icon: "hand", key: "H",
    options: [{ key: "scrollAll", label: "Scroll All Windows", kind: "boolean", default: false }],
    cursor: () => (start ? "grabbing" : "grab"),
    down(ctx, p) { const v = viewOf(ctx); start = { s: screenOf(ctx, p), pan: [v.panX, v.panY] }; },
    move(ctx, p) {
      if (!start) return;
      const [sx, sy] = screenOf(ctx, p);
      setView(ctx, { ...viewOf(ctx), panX: start.pan[0] + sx - start.s[0], panY: start.pan[1] + sy - start.s[1] });
    },
    up() { start = null; },
    dbl(ctx) { const vp = viewport(ctx); setView(ctx, fitDocument(viewOf(ctx), ctx.doc, vp.w, vp.h)); },
  };
}

// ——— rotate view ———

export function rotateViewTool(): Tool {
  let start: { a0: number; ang: number; c: [number, number] } | null = null;
  const reset = (ctx: ToolContext): void => { const vp = viewport(ctx); setView(ctx, rotateAt(viewOf(ctx), 0, vp.w / 2, vp.h / 2)); };
  return {
    id: "rotate-view", group: "view", label: "Rotate View Tool", icon: "rotate-cw", key: "R",
    options: [{ key: "rotateAll", label: "Rotate All Windows", kind: "boolean", default: false }],
    cursor: () => "rotate",
    down(ctx, p) {
      const vp = viewport(ctx), c: [number, number] = [vp.w / 2, vp.h / 2], s = screenOf(ctx, p);
      start = { a0: Math.atan2(s[1] - c[1], s[0] - c[0]), ang: viewOf(ctx).angle, c };
    },
    move(ctx, p) {
      if (!start) return;
      const s = screenOf(ctx, p);
      let ang = start.ang + ((Math.atan2(s[1] - start.c[1], s[0] - start.c[0]) - start.a0) * 180) / Math.PI;
      if (p.shift) ang = Math.round(ang / 15) * 15;
      setView(ctx, rotateAt(viewOf(ctx), ang, start.c[0], start.c[1]));
    },
    up() { start = null; },
    dbl: reset,
    key_(ctx, e) { if (e.type === "down" && e.key === "Escape") { reset(ctx); return true; } return false; },
    overlay(ctx) {
      // a compass needle pointing to the document's top, at the viewport center (screen-space shapes are left to the UI)
      const v = viewOf(ctx), vp = viewport(ctx), [cx, cy] = screenToDoc(v, vp.w / 2, vp.h / 2);
      const len = 60 / v.zoom;
      return [{ type: "line", x1: cx, y1: cy, x2: cx, y2: cy - len, color: "#e5484d", width: 2 }, { type: "label", x: cx, y: cy - len, text: `${Math.round(v.angle)}°` }];
    },
  };
}

// ——— zoom ———

export function zoomTool(): Tool {
  let start: { s: [number, number]; d: [number, number]; zoom: number; moved: boolean; out: boolean } | null = null;
  let marquee: Rect | null = null;
  return {
    id: "zoom", group: "view", label: "Zoom Tool", icon: "zoom-in", key: "Z",
    options: [
      { key: "scrubby", label: "Scrubby Zoom", kind: "boolean", default: true },
      { key: "resizeWindows", label: "Resize Windows to Fit", kind: "boolean", default: false },
    ],
    cursor: (_c, p) => (p?.alt ? "zoom-out" : "zoom-in"),
    down(ctx, p) { const s = screenOf(ctx, p); start = { s, d: [p.x, p.y], zoom: viewOf(ctx).zoom, moved: false, out: p.alt }; marquee = null; },
    move(ctx, p) {
      if (!start) return;
      const s = screenOf(ctx, p), dx = s[0] - start.s[0];
      if (!start.moved && Math.hypot(dx, s[1] - start.s[1]) < 3) return;
      start.moved = true;
      if (ctx.options.scrubby !== false) {
        // scrubby: 100 screen pixels to the right doubles the zoom, about the press point
        setView(ctx, zoomAt(viewOf(ctx), start.zoom * Math.pow(2, dx / 100), start.s[0], start.s[1]));
      } else {
        marquee = { x: Math.min(start.d[0], p.x), y: Math.min(start.d[1], p.y), w: Math.abs(p.x - start.d[0]), h: Math.abs(p.y - start.d[1]) };
        ctx.invalidate(null);
      }
    },
    up(ctx, p) {
      if (!start) return;
      const v = viewOf(ctx);
      if (!start.moved) setView(ctx, zoomAt(v, stepZoom(v.zoom, p.alt || start.out ? -1 : 1), start.s[0], start.s[1]));
      else if (marquee && marquee.w > 1 && marquee.h > 1) { const vp = viewport(ctx); setView(ctx, fitRect(v, marquee, vp.w, vp.h, 1)); }
      start = null; marquee = null;
    },
    dbl(ctx) { const vp = viewport(ctx); setView(ctx, centerOn({ ...viewOf(ctx), zoom: 1 }, ctx.doc.width / 2, ctx.doc.height / 2, vp.w, vp.h)); },
    overlay: (): OverlayShape[] => (marquee ? [{ type: "rect", rect: marquee, dash: true }] : []),
  };
}
