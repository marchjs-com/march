// Selection tools: rectangular / elliptical marquee, single row / column (M), lasso, polygonal lasso, magnetic lasso
// (L), magic wand, quick selection, object selection (W). Every finished shape is one undo step that combines with the
// selection: Shift add, Alt subtract, Shift+Alt intersect (or the options bar's operation). installSelectTools()
// registers them with the move, measure and view tools.

import type { ImageDocument } from "../document.ts";
import { blurPlane, maskToPlane, planeToMask } from "../alpha.ts";
import { renderRegion } from "../composite.ts";
import { hasRaster } from "../layers.ts";
import { combine, columnMask, deselect, ellipseMask, polygonMask, rectMask, rowMask, smooth, wandMask, feather as featherSel, type SelectOp } from "../selection.ts";
import { Mask, type Rect } from "../tiles.ts";
import { registerTool, type OverlayShape, type PointerSample, type Tool, type ToolContext, type ToolOption } from "./tool.ts";
import { moveTool } from "./move.ts";
import { colorSamplerTool, countTool, eyedropperTool, noteTool, rulerTool } from "./measure.ts";
import { handTool, rotateViewTool, zoomTool } from "./view.ts";

// ——— shared ———

const OP_OPTION: ToolOption = { key: "op", label: "Selection", kind: "select-op", default: "new", options: [
  { value: "new", label: "New Selection" }, { value: "add", label: "Add to Selection" },
  { value: "subtract", label: "Subtract from Selection" }, { value: "intersect", label: "Intersect with Selection" },
] };
const FEATHER: ToolOption = { key: "feather", label: "Feather", kind: "number", min: 0, max: 1000, step: 0.1, unit: "px", default: 0 };
const AA: ToolOption = { key: "antialias", label: "Anti-alias", kind: "boolean", default: true };

/** The combine operation of a press: modifiers win over the options bar (only when a selection exists). */
export function opOf(ctx: ToolContext, p: PointerSample): { op: SelectOp; shiftUsed: boolean; altUsed: boolean } {
  const opt = (ctx.options.op as SelectOp | undefined) ?? "new";
  if (!ctx.doc.selection) return { op: opt === "subtract" || opt === "intersect" ? "new" : opt, shiftUsed: false, altUsed: false };
  if (p.shift && p.alt) return { op: "intersect", shiftUsed: true, altUsed: true };
  if (p.shift) return { op: "add", shiftUsed: true, altUsed: false };
  if (p.alt) return { op: "subtract", shiftUsed: false, altUsed: true };
  return { op: opt, shiftUsed: false, altUsed: false };
}

/** Feather a shape mask in place (Gaussian radius in px). */
export function featherMask(m: Mask, radius: number): Mask {
  if (radius <= 0) return m;
  const p = maskToPlane(m);
  blurPlane(p, m.width, m.height, radius);
  planeToMask(p, m);
  return m;
}

/** Combine a finished shape as one step. */
export function applySelection(ctx: ToolContext, label: string, shape: Mask, op: SelectOp): void {
  const f = Number(ctx.options.feather ?? 0);
  ctx.doc.change(label, () => combine(ctx.doc, featherMask(shape, f), op));
}

// ——— marquees ———

/** The rectangle a marquee drag describes (style, Shift square, Alt from center). */
export function marqueeRect(o: Record<string, unknown>, ax: number, ay: number, x: number, y: number, square: boolean, center: boolean): Rect {
  const style = (o.style as string | undefined) ?? "normal";
  if (style === "fixed") {
    const w = Number(o.width ?? 64), h = Number(o.height ?? 64);
    return center ? { x: x - w / 2, y: y - h / 2, w, h } : { x, y, w, h };
  }
  let dx = x - ax, dy = y - ay;
  if (style === "ratio") {
    const rw = Number(o.ratioW ?? 1) || 1, rh = Number(o.ratioH ?? 1) || 1;
    const len = Math.max(Math.abs(dx) / rw, Math.abs(dy) / rh);
    dx = Math.sign(dx || 1) * len * rw; dy = Math.sign(dy || 1) * len * rh;
  } else if (square) {
    const s = Math.max(Math.abs(dx), Math.abs(dy));
    dx = Math.sign(dx || 1) * s; dy = Math.sign(dy || 1) * s;
  }
  if (center) return { x: ax - Math.abs(dx), y: ay - Math.abs(dy), w: Math.abs(dx) * 2, h: Math.abs(dy) * 2 };
  return { x: Math.min(ax, ax + dx), y: Math.min(ay, ay + dy), w: Math.abs(dx), h: Math.abs(dy) };
}

const MARQUEE_OPTIONS: ToolOption[] = [
  OP_OPTION, FEATHER, AA,
  { key: "style", label: "Style", kind: "choice", default: "normal", options: [{ value: "normal", label: "Normal" }, { value: "ratio", label: "Fixed Ratio" }, { value: "fixed", label: "Fixed Size" }] },
  { key: "ratioW", label: "Width", kind: "number", min: 0.001, default: 1, visible: (o) => o.style === "ratio" },
  { key: "ratioH", label: "Height", kind: "number", min: 0.001, default: 1, visible: (o) => o.style === "ratio" },
  { key: "width", label: "Width", kind: "number", min: 1, unit: "px", default: 64, visible: (o) => o.style === "fixed" },
  { key: "height", label: "Height", kind: "number", min: 1, unit: "px", default: 64, visible: (o) => o.style === "fixed" },
];

function marqueeTool(kind: "rect" | "ellipse"): Tool {
  let s: { a: [number, number]; cur: [number, number]; last: [number, number]; op: SelectOp; shiftUsed: boolean; altUsed: boolean; square: boolean; center: boolean; space: boolean } | null = null;
  const rect = (ctx: ToolContext): Rect => marqueeRect(ctx.options, s!.a[0], s!.a[1], s!.cur[0], s!.cur[1], s!.square, s!.center);
  return {
    id: kind === "rect" ? "marquee-rect" : "marquee-ellipse", group: "marquee", label: kind === "rect" ? "Rectangular Marquee Tool" : "Elliptical Marquee Tool",
    icon: kind === "rect" ? "square-dashed" : "circle-dashed", key: "M", options: MARQUEE_OPTIONS,
    cursor: () => "crosshair",
    down(ctx, p) {
      const o = opOf(ctx, p);
      s = { a: [p.x, p.y], cur: [p.x, p.y], last: [p.x, p.y], ...o, square: p.shift && !o.shiftUsed, center: p.alt && !o.altUsed, space: false };
    },
    move(ctx, p) {
      if (!s) return;
      if (s.space) { s.a[0] += p.x - s.last[0]; s.a[1] += p.y - s.last[1]; }
      s.cur = [p.x, p.y]; s.last = [p.x, p.y];
      // modifiers pressed after the start constrain / center (those used for the operation do not)
      s.square = p.shift && !s.shiftUsed; s.center = p.alt && !s.altUsed;
      ctx.invalidate(null);
    },
    up(ctx, p) {
      if (!s) return;
      s.cur = [p.x, p.y];
      const r = rect(ctx), aa = ctx.options.antialias !== false;
      const op = s.op;
      s = null;
      if (r.w < 1 || r.h < 1) {
        if (op === "new" && ctx.options.style !== "fixed" && ctx.doc.selection) ctx.doc.change("Deselect", () => deselect(ctx.doc));
        return;
      }
      applySelection(ctx, kind === "rect" ? "Rectangular Marquee" : "Elliptical Marquee", kind === "rect" ? rectMask(ctx.doc, r, aa) : ellipseMask(ctx.doc, r, aa), op);
    },
    key_(_ctx, e) { if (e.key === " " && s) { s.space = e.type === "down"; return true; } return false; },
    cancel() { s = null; },
    pending: () => !!s,
    overlay(ctx) {
      if (!s) return [];
      const r = rect(ctx);
      return [kind === "rect" ? { type: "rect", rect: r, dash: true } : { type: "ellipse", rect: r, dash: true }, { type: "label", x: r.x + r.w, y: r.y + r.h, text: `W: ${Math.round(r.w)} px  H: ${Math.round(r.h)} px` }];
    },
  };
}

function lineMarquee(axis: "row" | "column"): Tool {
  return {
    id: axis === "row" ? "marquee-row" : "marquee-column", group: "marquee", label: axis === "row" ? "Single Row Marquee Tool" : "Single Column Marquee Tool",
    icon: axis === "row" ? "rows-2" : "columns-2", options: [OP_OPTION],
    cursor: () => "crosshair",
    down(ctx, p) {
      const { op } = opOf(ctx, p);
      applySelection(ctx, axis === "row" ? "Single Row Marquee" : "Single Column Marquee", axis === "row" ? rowMask(ctx.doc, Math.floor(p.y)) : columnMask(ctx.doc, Math.floor(p.x)), op);
    },
  };
}

// ——— lassos ———

function lassoTool(): Tool {
  let s: { pts: [number, number][]; op: SelectOp } | null = null;
  return {
    id: "lasso", group: "lasso", label: "Lasso Tool", icon: "lasso", key: "L", options: [OP_OPTION, FEATHER, AA],
    cursor: () => "lasso",
    down(ctx, p) { s = { pts: [[p.x, p.y]], op: opOf(ctx, p).op }; },
    move(ctx, p) {
      if (!s) return;
      const l = s.pts[s.pts.length - 1]!;
      if (Math.hypot(p.x - l[0], p.y - l[1]) >= 0.5) { s.pts.push([p.x, p.y]); ctx.invalidate(null); }
    },
    up(ctx, p) {
      if (!s) return;
      s.pts.push([p.x, p.y]);
      const { pts, op } = s;
      s = null;
      if (pts.length < 3) { if (op === "new" && ctx.doc.selection) ctx.doc.change("Deselect", () => deselect(ctx.doc)); return; }
      applySelection(ctx, "Lasso", polygonMask(ctx.doc, pts, ctx.options.antialias !== false), op);
    },
    cancel() { s = null; },
    pending: () => !!s,
    overlay: () => (s ? [{ type: "polyline", points: s.pts, dash: true }] : []),
  };
}

/** Snap a point to 0 / 45 / 90° from another (Shift in the polygonal lasso). */
function snap45(from: [number, number], x: number, y: number): [number, number] {
  const dx = x - from[0], dy = y - from[1], a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(dx, dy);
  return [from[0] + Math.cos(a) * len, from[1] + Math.sin(a) * len];
}

function polygonalLassoTool(): Tool {
  let s: { pts: [number, number][]; op: SelectOp; hover: [number, number] | null } | null = null;
  const finish = (ctx: ToolContext): void => {
    if (!s) return;
    const pts = s.pts.filter((q, i, a) => i === 0 || q[0] !== a[i - 1]![0] || q[1] !== a[i - 1]![1]);
    const op = s.op;
    s = null;
    ctx.invalidate(null);
    if (pts.length >= 3) applySelection(ctx, "Polygonal Lasso", polygonMask(ctx.doc, pts, ctx.options.antialias !== false), op);
  };
  return {
    id: "lasso-polygon", group: "lasso", label: "Polygonal Lasso Tool", icon: "pentagon", options: [OP_OPTION, FEATHER, AA],
    cursor: () => "lasso",
    down(ctx, p) {
      if (!s) { s = { pts: [[p.x, p.y]], op: opOf(ctx, p).op, hover: null }; return; }
      const first = s.pts[0]!, last = s.pts[s.pts.length - 1]!;
      if (s.pts.length >= 3 && Math.hypot(p.x - first[0], p.y - first[1]) <= 6 / ctx.zoom) { finish(ctx); return; }
      s.pts.push(p.shift ? snap45(last, p.x, p.y) : [p.x, p.y]);
      ctx.invalidate(null);
    },
    hover(ctx, p) { if (s) { s.hover = p.shift ? snap45(s.pts[s.pts.length - 1]!, p.x, p.y) : [p.x, p.y]; ctx.invalidate(null); } },
    move(ctx, p) { this.hover!(ctx, p); },
    dbl: finish,
    commit: finish,
    key_(ctx, e) {
      if (!s || e.type !== "down") return false;
      if (e.key === "Enter") { finish(ctx); return true; }
      if (e.key === "Backspace" || e.key === "Delete") { s.pts.pop(); if (!s.pts.length) s = null; ctx.invalidate(null); return true; }
      if (e.key === "Escape") { s = null; ctx.invalidate(null); return true; }
      return false;
    },
    cancel() { s = null; },
    pending: () => !!s,
    overlay: () => (s ? [{ type: "polyline", points: s.hover ? [...s.pts, s.hover] : s.pts, dash: true }] : []),
  };
}

// ——— magnetic lasso: intelligent scissors ———

/** Luminance of the sampled pixels (straight), doc-size. */
export function sampleLuminance(doc: ImageDocument, sampleAll: boolean): Float32Array {
  const px = samplePixels(doc, sampleAll), n = doc.width * doc.height, out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = 0.299 * px[i * 4]! + 0.587 * px[i * 4 + 1]! + 0.114 * px[i * 4 + 2]!;
  return out;
}

/** Straight RGBA of the active layer or the merged image (doc-size). */
export function samplePixels(doc: ImageDocument, sampleAll: boolean): Float32Array {
  const l = doc.active;
  if (!sampleAll && l && hasRaster(l)) return l.raster.read(0, 0, doc.width, doc.height);
  const px = renderRegion(doc, doc.bounds);
  for (let i = 0; i < px.length; i += 4) { const a = px[i + 3]!; if (a > 0) { px[i]! /= a; px[i + 1]! /= a; px[i + 2]! /= a; } }
  return px;
}

/** Sobel gradient of a plane: magnitude (0–1 for a 0→1 step) and the gradient direction (unit vectors). */
export function gradient(lum: Float32Array, w: number, h: number): { mag: Float32Array; gx: Float32Array; gy: Float32Array } {
  const mag = new Float32Array(w * h), gx = new Float32Array(w * h), gy = new Float32Array(w * h);
  const at = (x: number, y: number): number => lum[(y < 0 ? 0 : y >= h ? h - 1 : y) * w + (x < 0 ? 0 : x >= w ? w - 1 : x)]!;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const a = at(x - 1, y - 1), b = at(x, y - 1), c = at(x + 1, y - 1), d = at(x - 1, y), f = at(x + 1, y), g = at(x - 1, y + 1), hh = at(x, y + 1), k = at(x + 1, y + 1);
    const sx = (c + 2 * f + k - a - 2 * d - g) / 4, sy = (g + 2 * hh + k - a - 2 * b - c) / 4, m = Math.hypot(sx, sy), i = y * w + x;
    mag[i] = m;
    if (m > 1e-9) { gx[i] = sx / m; gy[i] = sy / m; }
  }
  return { mag, gx, gy };
}

/**
 * Live wire (intelligent scissors): local costs from gradient magnitude (with a contrast floor) and gradient direction;
 * Dijkstra from a seed over a window, then the cheapest path to any point in it.
 */
export class LiveWire {
  readonly w: number;
  readonly h: number;
  /** 0 (strong edge) – 1 (flat) per pixel. */
  readonly cost: Float32Array;
  readonly mag: Float32Array;
  private gx: Float32Array;
  private gy: Float32Array;
  private win: Rect | null = null;
  private seedPt: [number, number] = [0, 0];
  private prev: Int32Array = new Int32Array(0);
  private dist: Float32Array = new Float32Array(0);

  constructor(lum: Float32Array, w: number, h: number, contrast = 0.1) {
    this.w = w; this.h = h;
    const g = gradient(lum, w, h);
    this.mag = g.mag; this.gx = g.gx; this.gy = g.gy;
    let max = 1e-6;
    for (let i = 0; i < g.mag.length; i++) if (g.mag[i]! > max) max = g.mag[i]!;
    this.cost = new Float32Array(w * h);
    const c = Math.min(0.95, Math.max(0, contrast));
    for (let i = 0; i < g.mag.length; i++) {
      const m = g.mag[i]! / max, e = m <= c ? 0 : (m - c) / (1 - c);
      this.cost[i] = 1 - e;
    }
  }

  /** The strongest edge pixel within `radius` of (x, y) (the magnetic lasso's width). */
  snap(x: number, y: number, radius: number): [number, number] {
    const xi = Math.round(x), yi = Math.round(y), r = Math.max(0, Math.round(radius));
    let best: [number, number] = [Math.max(0, Math.min(this.w - 1, xi)), Math.max(0, Math.min(this.h - 1, yi))], bc = Infinity;
    for (let yy = yi - r; yy <= yi + r; yy++) for (let xx = xi - r; xx <= xi + r; xx++) {
      if (xx < 0 || yy < 0 || xx >= this.w || yy >= this.h || (xx - xi) ** 2 + (yy - yi) ** 2 > r * r) continue;
      // prefer strong edges, then closeness to the pointer
      const c = this.cost[yy * this.w + xx]! + 0.002 * Math.hypot(xx - xi, yy - yi);
      if (c < bc) { bc = c; best = [xx, yy]; }
    }
    return best;
  }

  /** Start paths at a seed; the search covers `win` (document rect, clipped). */
  seed(x: number, y: number, win?: Rect): void {
    const sx = Math.round(x), sy = Math.round(y);
    const r = win ?? { x: sx - 96, y: sy - 96, w: 193, h: 193 };
    const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
    const x1 = Math.min(this.w, Math.ceil(r.x + r.w)), y1 = Math.min(this.h, Math.ceil(r.y + r.h));
    const W = x1 - x0, H = y1 - y0, N = W * H;
    this.win = { x: x0, y: y0, w: W, h: H };
    this.seedPt = [sx, sy];
    const dist = new Float32Array(N).fill(Infinity), prev = new Int32Array(N).fill(-1), done = new Uint8Array(N);
    // binary heap of (cost, index)
    let hk = new Float32Array(1024), hv = new Int32Array(1024), hn = 0;
    const push = (k: number, v: number): void => {
      if (hn === hk.length) { const nk = new Float32Array(hn * 2); nk.set(hk); hk = nk; const nv = new Int32Array(hn * 2); nv.set(hv); hv = nv; }
      let i = hn++;
      while (i > 0) { const p = (i - 1) >> 1; if (hk[p]! <= k) break; hk[i] = hk[p]!; hv[i] = hv[p]!; i = p; }
      hk[i] = k; hv[i] = v;
    };
    const pop = (): number => {
      const top = hv[0]!, k = hk[--hn]!, v = hv[hn]!;
      let i = 0;
      for (;;) {
        let c = 2 * i + 1;
        if (c >= hn) break;
        if (c + 1 < hn && hk[c + 1]! < hk[c]!) c++;
        if (hk[c]! >= k) break;
        hk[i] = hk[c]!; hv[i] = hv[c]!; i = c;
      }
      hk[i] = k; hv[i] = v;
      return top;
    };
    const s0 = (sy - y0) * W + (sx - x0);
    if (s0 < 0 || s0 >= N) { this.dist = dist; this.prev = prev; return; }
    dist[s0] = 0; push(0, s0);
    const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1];
    const { cost, gx, gy } = this, w = this.w;
    while (hn) {
      const i = pop();
      if (done[i]) continue;
      done[i] = 1;
      const ix = i % W, iy = (i / W) | 0, gi = (iy + y0) * w + ix + x0, di = dist[i]!;
      // direction of the edge at p: perpendicular to the gradient
      const ex = -gy[gi]!, ey = gx[gi]!;
      for (let k = 0; k < 8; k++) {
        const nx = ix + DX[k]!, ny = iy + DY[k]!;
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const j = ny * W + nx;
        if (done[j]) continue;
        const gj = (ny + y0) * w + nx + x0, len = k < 4 ? 1 : Math.SQRT2;
        const lx = DX[k]! / len, ly = DY[k]! / len;
        // direction term: links running along the edge are cheap
        const fd = (1 - Math.abs(ex * lx + ey * ly)) * 0.5 + (1 - Math.abs(-gy[gj]! * lx + gx[gj]! * ly)) * 0.5;
        const c = di + (0.8 * cost[gj]! + 0.15 * fd + 0.05) * len;
        if (c < dist[j]!) { dist[j] = c; prev[j] = i; push(c, j); }
      }
    }
    this.dist = dist; this.prev = prev;
  }

  /** The cheapest path seed → (x, y) (seed first); reseeds with a bigger window when the point lies outside. */
  path(x: number, y: number): [number, number][] {
    const tx = Math.max(0, Math.min(this.w - 1, Math.round(x))), ty = Math.max(0, Math.min(this.h - 1, Math.round(y)));
    const W = this.win;
    if (!W || tx < W.x || ty < W.y || tx >= W.x + W.w || ty >= W.y + W.h) {
      const [sx, sy] = this.seedPt, m = 64;
      this.seed(sx, sy, { x: Math.min(sx, tx) - m, y: Math.min(sy, ty) - m, w: Math.abs(tx - sx) + 2 * m + 1, h: Math.abs(ty - sy) + 2 * m + 1 });
    }
    const w = this.win!, out: [number, number][] = [];
    let i = (ty - w.y) * w.w + (tx - w.x);
    if (this.dist[i] === Infinity) return [this.seedPt, [tx, ty]];
    while (i >= 0) { out.push([(i % w.w) + w.x, ((i / w.w) | 0) + w.y]); i = this.prev[i]!; }
    return out.reverse();
  }
}

function magneticLassoTool(): Tool {
  let s: { wire: LiveWire; start: [number, number]; segs: [number, number][][]; anchors: [number, number][]; live: [number, number][]; op: SelectOp } | null = null;
  const pts = (): [number, number][] => (s ? [...s.segs.flat(), ...s.live] : []);
  const addAnchor = (ctx: ToolContext, at: [number, number]): void => {
    if (!s) return;
    const path = s.wire.path(at[0], at[1]);
    s.segs.push(path.slice(0, -1));
    s.anchors.push(at);
    s.wire.seed(at[0], at[1]);
    s.live = [at];
    ctx.invalidate(null);
  };
  const finish = (ctx: ToolContext): void => {
    if (!s) return;
    const back = s.wire.path(s.start[0], s.start[1]);
    const all = [...s.segs.flat(), ...back];
    const op = s.op;
    s = null;
    ctx.invalidate(null);
    if (all.length >= 3) applySelection(ctx, "Magnetic Lasso", polygonMask(ctx.doc, all.map(([x, y]) => [x + 0.5, y + 0.5]), ctx.options.antialias !== false), op);
  };
  const track = (ctx: ToolContext, p: PointerSample): void => {
    if (!s) return;
    const width = Number(ctx.options.width ?? 10);
    const t = s.wire.snap(p.x, p.y, width);
    s.live = s.wire.path(t[0], t[1]);
    // frequency: a fixed point every so many pixels of live path
    const freq = Number(ctx.options.frequency ?? 57), every = 8 + (100 - freq) * 1.2;
    if (freq > 0 && s.live.length > every) { addAnchor(ctx, s.live[Math.floor(s.live.length * 0.66)]!); s.live = s.wire.path(t[0], t[1]); }
    ctx.invalidate(null);
  };
  return {
    id: "lasso-magnetic", group: "lasso", label: "Magnetic Lasso Tool", icon: "magnet",
    options: [
      OP_OPTION, FEATHER, AA,
      { key: "width", label: "Width", kind: "number", min: 1, max: 256, unit: "px", default: 10 },
      { key: "contrast", label: "Contrast", kind: "percent", min: 1, max: 100, default: 10 },
      { key: "frequency", label: "Frequency", kind: "number", min: 0, max: 100, default: 57 },
      { key: "sampleAll", label: "Sample All Layers", kind: "boolean", default: true },
    ],
    cursor: () => "lasso",
    down(ctx, p) {
      if (!s) {
        const doc = ctx.doc;
        const wire = new LiveWire(sampleLuminance(doc, ctx.options.sampleAll !== false), doc.width, doc.height, Number(ctx.options.contrast ?? 10) / 100);
        const at = wire.snap(p.x, p.y, Number(ctx.options.width ?? 10));
        wire.seed(at[0], at[1]);
        s = { wire, start: at, segs: [], anchors: [at], live: [at], op: opOf(ctx, p).op };
        return;
      }
      if (s.anchors.length > 1 && Math.hypot(p.x - s.start[0], p.y - s.start[1]) <= 6 / ctx.zoom) { finish(ctx); return; }
      addAnchor(ctx, s.wire.snap(p.x, p.y, Number(ctx.options.width ?? 10)));
    },
    move: track,
    hover: track,
    dbl: finish,
    commit: finish,
    key_(ctx, e) {
      if (!s || e.type !== "down") return false;
      if (e.key === "Enter") { finish(ctx); return true; }
      if (e.key === "Escape") { s = null; ctx.invalidate(null); return true; }
      if (e.key === "Backspace" || e.key === "Delete") {
        if (s.anchors.length <= 1) { s = null; ctx.invalidate(null); return true; }
        s.anchors.pop(); s.segs.pop();
        const a = s.anchors[s.anchors.length - 1]!;
        s.wire.seed(a[0], a[1]); s.live = [a];
        ctx.invalidate(null);
        return true;
      }
      if (e.key === "[" || e.key === "]") { ctx.setOption("width", Math.max(1, Number(ctx.options.width ?? 10) + (e.key === "]" ? 1 : -1))); return true; }
      return false;
    },
    cancel() { s = null; },
    pending: () => !!s,
    overlay: () => (s ? [{ type: "polyline", points: pts().map(([x, y]) => [x + 0.5, y + 0.5] as [number, number]) }, ...s.anchors.map((a, i) => ({ type: "handle" as const, x: a[0] + 0.5, y: a[1] + 0.5, id: `a${i}` }))] : []),
  };
}

// ——— magic wand ———

function magicWandTool(): Tool {
  return {
    id: "magic-wand", group: "wand", label: "Magic Wand Tool", icon: "wand", key: "W",
    options: [
      OP_OPTION, AA,
      { key: "tolerance", label: "Tolerance", kind: "number", min: 0, max: 255, default: 32 },
      { key: "contiguous", label: "Contiguous", kind: "boolean", default: true },
      { key: "sampleAll", label: "Sample All Layers", kind: "boolean", default: false },
      { key: "sampleSize", label: "Sample Size", kind: "choice", default: "1", options: [{ value: "1", label: "Point Sample" }, { value: "3", label: "3 by 3 Average" }, { value: "5", label: "5 by 5 Average" }] },
    ],
    cursor: () => "wand",
    down(ctx, p) {
      const { op } = opOf(ctx, p), o = ctx.options;
      const m = wandMask(ctx.doc, Math.floor(p.x), Math.floor(p.y), {
        tolerance: Number(o.tolerance ?? 32), contiguous: o.contiguous !== false, sampleAll: !!o.sampleAll, antialias: o.antialias !== false,
        sampleSize: (Number(o.sampleSize ?? 1) as 1 | 3 | 5),
      });
      ctx.doc.change("Magic Wand", () => combine(ctx.doc, m, op));
    },
  };
}

// ——— quick selection: edge-aware region growing ———

/** Edge-aware region growing from seeds with a color model (mean ± spread per channel). Marks grown pixels in `out`. */
export function growRegion(px: Float32Array, edge: Float32Array, w: number, h: number, seeds: number[], model: { mean: number[]; spread: number[] }, out: Uint8Array, o: { edge: number; limit?: Rect | undefined; mark?: number }): number {
  const lim = o.limit ?? { x: 0, y: 0, w, h };
  const x0 = Math.max(0, lim.x), y0 = Math.max(0, lim.y), x1 = Math.min(w, lim.x + lim.w), y1 = Math.min(h, lim.y + lim.h);
  const mark = o.mark ?? 1, [mr, mg, mb] = model.mean as [number, number, number], [sr, sg, sb] = model.spread as [number, number, number];
  const stack = seeds.slice();
  let n = 0;
  for (const i of seeds) if (out[i] !== mark) { out[i] = mark; n++; }
  while (stack.length) {
    const i = stack.pop()!, x = i % w, y = (i / w) | 0;
    for (let k = 0; k < 4; k++) {
      const nx = k === 0 ? x + 1 : k === 1 ? x - 1 : x, ny = k === 2 ? y + 1 : k === 3 ? y - 1 : y;
      if (nx < x0 || ny < y0 || nx >= x1 || ny >= y1) continue;
      const j = ny * w + nx;
      if (out[j] === mark || edge[j]! > o.edge) continue;
      const q = j * 4;
      if (Math.abs(px[q]! - mr) > sr || Math.abs(px[q + 1]! - mg) > sg || Math.abs(px[q + 2]! - mb) > sb) continue;
      out[j] = mark; n++;
      stack.push(j);
    }
  }
  return n;
}

const edgeCache = new WeakMap<ImageDocument, { key: string; px: Float32Array; edge: Float32Array }>();
/** Sampled pixels and their gradient magnitude, cached while the pixels do not change. */
export function edgeData(doc: ImageDocument, sampleAll: boolean): { px: Float32Array; edge: Float32Array } {
  const versions: number[] = [];
  for (const l of doc.all()) if (hasRaster(l)) versions.push(l.raster.version, l.raster.ox, l.raster.oy, l.visible ? 1 : 0);
  const key = `${sampleAll}:${doc.activeId}:${versions.join(",")}`;
  const c = edgeCache.get(doc);
  if (c && c.key === key) return c;
  const px = samplePixels(doc, sampleAll), n = doc.width * doc.height, lum = new Float32Array(n);
  for (let i = 0; i < n; i++) lum[i] = 0.299 * px[i * 4]! + 0.587 * px[i * 4 + 1]! + 0.114 * px[i * 4 + 2]!;
  const e = { key, px, edge: gradient(lum, doc.width, doc.height).mag };
  edgeCache.set(doc, e);
  return e;
}

function disk(w: number, h: number, cx: number, cy: number, r: number): number[] {
  const out: number[] = [], ri = Math.ceil(r);
  for (let y = Math.max(0, Math.floor(cy - ri)); y <= Math.min(h - 1, Math.ceil(cy + ri)); y++)
    for (let x = Math.max(0, Math.floor(cx - ri)); x <= Math.min(w - 1, Math.ceil(cx + ri)); x++)
      if ((x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r) out.push(y * w + x);
  return out;
}

function quickSelectionTool(): Tool {
  let s: { sub: boolean; out: Mask; data: Uint8Array; region: Uint8Array; px: Float32Array; edge: Float32Array; sum: number[]; sq: number[]; n: number; last: [number, number] | null } | null = null;
  const dab = (ctx: ToolContext, x: number, y: number): void => {
    if (!s) return;
    const doc = ctx.doc, w = doc.width, h = doc.height, r = Math.max(1, Number(ctx.options.size ?? 30) / 2);
    const seeds = disk(w, h, x, y, r);
    for (const i of seeds) {
      if (s.px[i * 4 + 3]! <= 0 && ctx.options.sampleAll) continue;
      for (let c = 0; c < 3; c++) { const v = s.px[i * 4 + c]!; s.sum[c]! += v; s.sq[c]! += v * v; }
      s.n++;
    }
    const mean = s.sum.map((v) => v / Math.max(1, s!.n)), spread = s.sq.map((v, c) => Math.max(0.06, 2.5 * Math.sqrt(Math.max(0, v / Math.max(1, s!.n) - mean[c]! ** 2))));
    const reach = r * 8 + 32;
    const limit: Rect = { x: Math.floor(x - reach), y: Math.floor(y - reach), w: Math.ceil(reach * 2), h: Math.ceil(reach * 2) };
    // seeds on a strong edge still count (the brush covers them), growth stops at edges
    const tmp = s.region;
    growRegion(s.px, s.edge, w, h, seeds, { mean, spread }, tmp, { edge: Number(ctx.options.edge ?? 0.12), limit });
    // write the region into the selection (only the window changes)
    const x0 = Math.max(0, limit.x), y0 = Math.max(0, limit.y), x1 = Math.min(w, limit.x + limit.w), y1 = Math.min(h, limit.y + limit.h);
    const d = s.data, v = s.sub ? 0 : 255;
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) { const i = yy * w + xx; if (tmp[i]) d[i] = v; }
    doc.selection = s.out;
    s.out.version++;
    doc.invalidate({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 }, false, true);
  };
  return {
    id: "quick-selection", group: "wand", label: "Quick Selection Tool", icon: "brush-selection",
    options: [
      { key: "op", label: "Selection", kind: "select-op", default: "new", options: [{ value: "new", label: "New Selection" }, { value: "add", label: "Add to Selection" }, { value: "subtract", label: "Subtract from Selection" }] },
      { key: "size", label: "Size", kind: "number", min: 1, max: 5000, unit: "px", default: 30 },
      { key: "edge", label: "Edge Sensitivity", kind: "number", min: 0.01, max: 1, step: 0.01, default: 0.12 },
      { key: "sampleAll", label: "Sample All Layers", kind: "boolean", default: false },
      { key: "autoEnhance", label: "Auto-Enhance", kind: "boolean", default: false },
    ],
    cursor: () => "brush",
    down(ctx, p) {
      const doc = ctx.doc, opt = (ctx.options.op as string | undefined) ?? "new";
      const sub = p.alt || opt === "subtract";
      doc.begin(sub ? "Quick Selection (Subtract)" : "Quick Selection");
      const fresh = opt === "new" && !p.shift && !sub;
      const out = fresh || !doc.selection ? new Mask(doc.width, doc.height) : doc.selection.clone();
      const data = out.writable();
      const { px, edge } = edgeData(doc, !!ctx.options.sampleAll);
      s = { sub, out, data, region: new Uint8Array(doc.width * doc.height), px, edge, sum: [0, 0, 0], sq: [0, 0, 0], n: 0, last: [p.x, p.y] };
      dab(ctx, p.x, p.y);
    },
    move(ctx, p) {
      if (!s || !s.last) return;
      const r = Math.max(1, Number(ctx.options.size ?? 30) / 2), [lx, ly] = s.last, dist = Math.hypot(p.x - lx, p.y - ly);
      if (dist < r * 0.5) return;
      const steps = Math.ceil(dist / (r * 0.5));
      for (let i = 1; i <= steps; i++) dab(ctx, lx + ((p.x - lx) * i) / steps, ly + ((p.y - ly) * i) / steps);
      s.last = [p.x, p.y];
    },
    up(ctx) {
      if (!s) return;
      const doc = ctx.doc, out = s.out;
      s = null;
      doc.selection = out.isEmpty() ? null : out;
      if (ctx.options.autoEnhance && doc.selection) { smooth(doc, 2); featherSel(doc, 0.7); }
      doc.commit();
      if ((ctx.options.op ?? "new") === "new") ctx.setOption("op", "add");
    },
    cancel(ctx) { if (s) { s = null; ctx.doc.cancel(); } },
    pending: () => !!s,
    overlay: (ctx) => (s?.last ? [{ type: "brush", x: s.last[0], y: s.last[1], size: Number(ctx.options.size ?? 30), hardness: 1 }] : []),
  };
}

// ——— object selection ———

export interface AiHooks {
  /** Segment the object inside `rect` of the pixels (straight RGBA, doc-size): a doc-size Mask or a rect-size alpha. */
  selectObject?: ((pixels: { width: number; height: number; data: Float32Array }, rect: Rect) => Mask | Uint8Array | Promise<Mask | Uint8Array | null> | null) | undefined;
  selectSubject?: ((pixels: { width: number; height: number; data: Float32Array }) => Mask | Uint8Array | Promise<Mask | Uint8Array | null> | null) | undefined;
  selectSky?: ((pixels: { width: number; height: number; data: Float32Array }) => Mask | Uint8Array | Promise<Mask | Uint8Array | null> | null) | undefined;
}

/** A hook result (doc-size Mask, doc-size array or a `rect`-size array) as a doc-size Mask. */
export function hookMask(doc: ImageDocument, r: Mask | Uint8Array, rect: Rect = doc.bounds): Mask {
  if (r instanceof Mask) return r;
  const m = new Mask(doc.width, doc.height);
  if (r.length === m.data.length) { m.data.set(r); return m; }
  for (let y = 0; y < rect.h; y++) for (let x = 0; x < rect.w; x++) {
    const dx = rect.x + x, dy = rect.y + y;
    if (dx >= 0 && dy >= 0 && dx < doc.width && dy < doc.height) m.data[dy * doc.width + dx] = r[y * rect.w + x]!;
  }
  return m;
}

/**
 * Object selection without a model: the background is modeled from the rectangle's border; pixels that differ from it
 * and connect to the center become the object; when that finds nothing, quick-selection growth from the center.
 */
export function objectFallback(doc: ImageDocument, rect: Rect, sampleAll = true): Mask {
  const w = doc.width, h = doc.height, { px, edge } = edgeData(doc, sampleAll);
  const r = { x: Math.max(0, Math.floor(rect.x)), y: Math.max(0, Math.floor(rect.y)), w: 0, h: 0 };
  r.w = Math.min(w, Math.ceil(rect.x + rect.w)) - r.x; r.h = Math.min(h, Math.ceil(rect.y + rect.h)) - r.y;
  const out = new Mask(w, h);
  if (r.w < 3 || r.h < 3) return out;
  // border color model
  const sum = [0, 0, 0], sq = [0, 0, 0];
  let n = 0;
  const addPx = (i: number): void => { for (let c = 0; c < 3; c++) { const v = px[i * 4 + c]!; sum[c]! += v; sq[c]! += v * v; } n++; };
  for (let x = r.x; x < r.x + r.w; x++) { addPx(r.y * w + x); addPx((r.y + r.h - 1) * w + x); }
  for (let y = r.y; y < r.y + r.h; y++) { addPx(y * w + r.x); addPx(y * w + r.x + r.w - 1); }
  const mean = sum.map((v) => v / n), sd = sq.map((v, c) => Math.sqrt(Math.max(0, v / n - mean[c]! ** 2)));
  const fg = new Uint8Array(w * h);
  for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) {
    const i = y * w + x;
    let d = 0;
    for (let c = 0; c < 3; c++) d = Math.max(d, Math.abs(px[i * 4 + c]! - mean[c]!) / Math.max(0.04, 2.5 * sd[c]!));
    if (d > 1) fg[i] = 1;
  }
  // keep the components touching the central third
  const keep = new Uint8Array(w * h), stack: number[] = [];
  for (let y = r.y + Math.floor(r.h / 3); y < r.y + Math.ceil((2 * r.h) / 3); y++) for (let x = r.x + Math.floor(r.w / 3); x < r.x + Math.ceil((2 * r.w) / 3); x++) {
    const i = y * w + x;
    if (fg[i] && !keep[i]) { keep[i] = 1; stack.push(i); }
  }
  while (stack.length) {
    const i = stack.pop()!, x = i % w, y = (i / w) | 0;
    for (const [nx, ny] of [[x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]] as const) {
      if (nx < r.x || ny < r.y || nx >= r.x + r.w || ny >= r.y + r.h) continue;
      const j = ny * w + nx;
      if (fg[j] && !keep[j]) { keep[j] = 1; stack.push(j); }
    }
  }
  let any = false;
  for (let i = 0; i < keep.length; i++) if (keep[i]) { out.data[i] = 255; any = true; }
  if (!any) {
    const cx = r.x + r.w / 2, cy = r.y + r.h / 2, seeds = disk(w, h, cx, cy, Math.max(2, Math.min(r.w, r.h) / 8));
    const s2 = [0, 0, 0], q2 = [0, 0, 0];
    for (const i of seeds) for (let c = 0; c < 3; c++) { const v = px[i * 4 + c]!; s2[c]! += v; q2[c]! += v * v; }
    const m2 = s2.map((v) => v / seeds.length), sp = q2.map((v, c) => Math.max(0.06, 2.5 * Math.sqrt(Math.max(0, v / seeds.length - m2[c]! ** 2))));
    const reg = new Uint8Array(w * h);
    growRegion(px, edge, w, h, seeds, { mean: m2, spread: sp }, reg, { edge: 0.12, limit: r });
    for (let i = 0; i < reg.length; i++) if (reg[i]) out.data[i] = 255;
  }
  return out;
}

function objectSelectionTool(): Tool {
  let s: { a: [number, number]; pts: [number, number][]; op: SelectOp } | null = null;
  return {
    id: "object-selection", group: "wand", label: "Object Selection Tool", icon: "scan",
    options: [
      OP_OPTION,
      { key: "mode", label: "Mode", kind: "choice", default: "rect", options: [{ value: "rect", label: "Rectangle" }, { value: "lasso", label: "Lasso" }] },
      { key: "sampleAll", label: "Sample All Layers", kind: "boolean", default: true },
    ],
    cursor: () => "crosshair",
    down(ctx, p) { s = { a: [p.x, p.y], pts: [[p.x, p.y]], op: opOf(ctx, p).op }; },
    move(ctx, p) { if (s) { s.pts.push([p.x, p.y]); ctx.invalidate(null); } },
    up(ctx, p) {
      if (!s) return;
      s.pts.push([p.x, p.y]);
      const { pts, op } = s, lasso = ctx.options.mode === "lasso";
      s = null;
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => q[1]);
      const rect: Rect = { x: Math.floor(Math.min(...xs)), y: Math.floor(Math.min(...ys)), w: 0, h: 0 };
      rect.w = Math.ceil(Math.max(...xs)) - rect.x; rect.h = Math.ceil(Math.max(...ys)) - rect.y;
      if (rect.w < 2 || rect.h < 2) return;
      const doc = ctx.doc, ai = ctx.shared.ai as AiHooks | undefined;
      const apply = (m: Mask): void => {
        if (lasso) { const lm = polygonMask(doc, pts); for (let i = 0; i < m.data.length; i++) m.data[i] = Math.round((m.data[i]! * lm.data[i]!) / 255); }
        doc.change("Object Selection", () => combine(doc, m, op));
      };
      const res = ai?.selectObject ? ai.selectObject({ width: doc.width, height: doc.height, data: samplePixels(doc, ctx.options.sampleAll !== false) }, rect) : null;
      if (res && typeof (res as Promise<unknown>).then === "function") {
        void (res as Promise<Mask | Uint8Array | null>).then((m) => apply(m ? hookMask(doc, m, rect) : objectFallback(doc, rect, ctx.options.sampleAll !== false)));
      } else apply(res ? hookMask(doc, res as Mask | Uint8Array, rect) : objectFallback(doc, rect, ctx.options.sampleAll !== false));
    },
    cancel() { s = null; },
    pending: () => !!s,
    overlay(ctx): OverlayShape[] {
      if (!s) return [];
      if (ctx.options.mode === "lasso") return [{ type: "polyline", points: s.pts, dash: true }];
      const l = s.pts[s.pts.length - 1]!;
      return [{ type: "rect", rect: { x: Math.min(s.a[0], l[0]), y: Math.min(s.a[1], l[1]), w: Math.abs(l[0] - s.a[0]), h: Math.abs(l[1] - s.a[1]) }, dash: true }];
    },
  };
}

// ——— registration ———

/** Factories of every tool in this area (fresh tool state per call). */
export function selectTools(): Tool[] {
  return [
    moveTool(),
    marqueeTool("rect"), marqueeTool("ellipse"), lineMarquee("row"), lineMarquee("column"),
    lassoTool(), polygonalLassoTool(), magneticLassoTool(),
    objectSelectionTool(), quickSelectionTool(), magicWandTool(),
    eyedropperTool(), colorSamplerTool(), rulerTool(), noteTool(), countTool(),
    handTool(), rotateViewTool(), zoomTool(),
  ];
}

/** Register the selection, move, measure and view tools. Returns a remover. */
export function installSelectTools(): () => void {
  return registerTool(...selectTools());
}

export { marqueeTool, lineMarquee, lassoTool, polygonalLassoTool, magneticLassoTool, magicWandTool, quickSelectionTool, objectSelectionTool };
