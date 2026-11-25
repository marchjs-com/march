// The canvas view of one document: tiled, mip-mapped display at 1 %–3200 % with rotation; rulers, guides, grid,
// pixel grid, slices, artboards, notes, counts and samplers; marching ants and tool overlays on the motion clock;
// pen / mouse / touch input (coalesced samples with pressure, tilt and twist), pinch zoom and rotate, two-finger
// tap undo and three-finger tap redo, wheel zoom at the cursor, space / middle-button panning.

import { effect, untrack, onCleanup, signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t } from "../../../core/i18n.ts";
import { on, setStyle, clamp } from "../../../core/util.ts";
import { observeSize } from "../../../ui/observe.ts";
import { pointerDrag } from "../../../behaviors/drag/index.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { reducedMotion } from "../../../motion/env.ts";
import { select, newId, type Rect, type ImageDocument } from "../../../image/doc/index.ts";
import { getTool, sample, type OverlayShape, type PointerSample, type ToolCursor } from "../../../image/doc/tools/tool.ts";
import { DisplayTiles, MAX_LEVEL, makeCanvas, type Drawable } from "./tiles-display.ts";
import type { DocEntry, Editor, ViewState } from "./editor.ts";

export const MIN_ZOOM = 0.01;
export const MAX_ZOOM = 32;
/** Zoom steps of Ctrl + / Ctrl − (the familiar presets). */
export const ZOOM_STEPS = [0.01, 0.02, 0.03, 0.04, 0.05, 0.0625, 0.0833, 0.125, 0.1667, 0.25, 0.3333, 0.5, 0.6667, 1, 2, 3, 4, 5, 6, 7, 8, 12, 16, 20, 24, 28, 32];

/** Map between document and view (CSS px) coordinates. */
export class ViewMath {
  constructor(public v: ViewState, public w: number, public h: number, public dw: number, public dh: number) {}
  toScreen(x: number, y: number): [number, number] {
    const { zoom: z, angle, panX, panY } = this.v, c = Math.cos(angle), s = Math.sin(angle);
    const dx = (x - this.dw / 2) * z, dy = (y - this.dh / 2) * z;
    return [this.w / 2 + panX + dx * c - dy * s, this.h / 2 + panY + dx * s + dy * c];
  }
  toDoc(sx: number, sy: number): [number, number] {
    const { zoom: z, angle, panX, panY } = this.v, c = Math.cos(-angle), s = Math.sin(-angle);
    const dx = sx - this.w / 2 - panX, dy = sy - this.h / 2 - panY;
    return [this.dw / 2 + (dx * c - dy * s) / z, this.dh / 2 + (dx * s + dy * c) / z];
  }
  /** The document rectangle visible in the view (bounding box when rotated). */
  visible(): Rect {
    const pts = [this.toDoc(0, 0), this.toDoc(this.w, 0), this.toDoc(0, this.h), this.toDoc(this.w, this.h)];
    const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
    const x0 = Math.max(0, Math.floor(Math.min(...xs))), y0 = Math.max(0, Math.floor(Math.min(...ys)));
    const x1 = Math.min(this.dw, Math.ceil(Math.max(...xs))), y1 = Math.min(this.dh, Math.ceil(Math.max(...ys)));
    return { x: x0, y: y0, w: Math.max(0, x1 - x0), h: Math.max(0, y1 - y0) };
  }
  /** Canvas 2D matrix (doc → device pixels). */
  matrix(dpr: number): [number, number, number, number, number, number] {
    const { zoom: z, angle } = this.v, c = Math.cos(angle) * z * dpr, s = Math.sin(angle) * z * dpr;
    const [ox, oy] = this.toScreen(0, 0);
    return [c, s, -s, c, ox * dpr, oy * dpr];
  }
}

/** Fit the document into the view (zoom and pan). */
export function fitView(v: ViewState, w: number, h: number, dw: number, dh: number, fill = false): ViewState {
  const z = fill ? Math.max(w / dw, h / dh) : Math.min((w - 48) / dw, (h - 48) / dh);
  return { ...v, zoom: clamp(z, MIN_ZOOM, MAX_ZOOM), panX: 0, panY: 0 };
}

/** Next zoom preset up / down. */
export function stepZoom(z: number, dir: 1 | -1): number {
  if (dir > 0) return ZOOM_STEPS.find((s) => s > z + 1e-6) ?? MAX_ZOOM;
  return [...ZOOM_STEPS].reverse().find((s) => s < z - 1e-6) ?? MIN_ZOOM;
}

/** Zoom keeping a view point fixed. */
export function zoomAt(v: ViewState, z: number, sx: number, sy: number, w: number, h: number, dw: number, dh: number): ViewState {
  z = clamp(z, MIN_ZOOM, MAX_ZOOM);
  const m = new ViewMath(v, w, h, dw, dh);
  const [x, y] = m.toDoc(sx, sy);
  const next = { ...v, zoom: z };
  const m2 = new ViewMath(next, w, h, dw, dh);
  const [nx, ny] = m2.toScreen(x, y);
  return { ...next, panX: v.panX + sx - nx, panY: v.panY + sy - ny };
}

const CURSORS: Partial<Record<ToolCursor, string>> = {
  crosshair: "crosshair", move: "move", text: "text", grab: "grab", grabbing: "grabbing", "not-allowed": "not-allowed",
  "zoom-in": "zoom-in", "zoom-out": "zoom-out", "resize-nwse": "nwse-resize", "resize-nesw": "nesw-resize", "resize-ns": "ns-resize",
  "resize-ew": "ew-resize", copy: "copy", pointer: "default", default: "default",
};

export interface CanvasViewProps {
  editor: Editor;
  entry: DocEntry;
  /** Context menu at a document point. */
  onContext?: ((e: MouseEvent, x: number, y: number) => void) | undefined;
  /** The rulers' and the view's accessible labels. */
  labels?: { canvas?: string | undefined } | undefined;
}

export interface CanvasViewApi { fit(fill?: boolean): void; actual(): void; zoomBy(dir: 1 | -1): void; math(): ViewMath; redraw(): void; tiles: DisplayTiles }

/** The view of one open document. */
export function CanvasView(props: CanvasViewProps & { api?: ((a: CanvasViewApi) => void) | undefined }): HTMLElement {
  const ed = props.editor, entry = props.entry, doc = entry.doc;
  const tiles = new DisplayTiles(doc);
  const size = signal<[number, number]>([0, 0]);
  let dpr = globalThis.devicePixelRatio || 1;
  const pixels = h("canvas", { class: "m-pe-pixels", "aria-hidden": "true" }) as HTMLCanvasElement;
  const overlay = h("canvas", { class: "m-pe-overlay", "aria-hidden": "true" }) as HTMLCanvasElement;
  const rulerX = h("canvas", { class: "m-pe-ruler m-pe-ruler-x", "aria-hidden": "true" }) as HTMLCanvasElement;
  const rulerY = h("canvas", { class: "m-pe-ruler m-pe-ruler-y", "aria-hidden": "true" }) as HTMLCanvasElement;
  const port = h("div", {
    class: "m-pe-port", tabindex: "0", role: "application",
    "aria-roledescription": t`image canvas`,
    "aria-label": () => props.labels?.canvas ?? t`Canvas: ${entry.doc.name}, ${Math.round(entry.view().zoom * 100)} %`,
  }, pixels, overlay) as HTMLElement;
  const corner = h("div", { class: "m-pe-ruler-corner", "aria-hidden": "true" });
  const root = h("div", { class: () => ["m-pe-stage", entry.view().rulers ? "m-pe-with-rulers" : ""].join(" ") }, corner, rulerX, rulerY, port) as HTMLElement;

  let needPixels = true, needOverlay = true, antsT = 0, pointer: [number, number] | null = null, hoverSample: PointerSample | null = null;
  const math = (): ViewMath => new ViewMath(untrack(entry.view), size.peek()[0], size.peek()[1], doc.width, doc.height);

  const setView = (v: ViewState): void => { entry.view.set(v); needPixels = needOverlay = true; };
  const api: CanvasViewApi = {
    fit: (fill) => { const [w, h2] = size.peek(); if (w) setView(fitView(untrack(entry.view), w, h2, doc.width, doc.height, fill)); },
    actual: () => setView({ ...untrack(entry.view), zoom: 1 }),
    zoomBy: (dir) => { const [w, h2] = size.peek(); setView(zoomAt(untrack(entry.view), stepZoom(untrack(entry.view).zoom, dir), w / 2, h2 / 2, w, h2, doc.width, doc.height)); },
    math, redraw: () => { tiles.invalidate(null); needPixels = needOverlay = true; }, tiles,
  };
  props.api?.(api);
  ed.shared.view = api;

  let fitted = false;
  observeSize(port, (r) => {
    size.set([r.width, r.height]);
    dpr = globalThis.devicePixelRatio || 1;
    for (const c of [pixels, overlay]) { c.width = Math.max(1, Math.round(r.width * dpr)); c.height = Math.max(1, Math.round(r.height * dpr)); }
    if (!fitted && r.width > 0) { fitted = true; api.fit(); }
    needPixels = needOverlay = true;
  });

  // document changes → stale tiles
  const offDoc = doc.on((c) => {
    if (c.dirty) tiles.invalidate(c.dirty); else tiles.invalidate(null);
    if (c.structure && (doc.width !== lastW || doc.height !== lastH)) { tiles.clear(); lastW = doc.width; lastH = doc.height; }
    needPixels = needOverlay = true;
  });
  let lastW = doc.width, lastH = doc.height;
  onCleanup(offDoc);
  effect(() => { entry.view(); ed.prefs(); needPixels = needOverlay = true; });
  effect(() => { ed.tool(); ed.toolOptions(); needOverlay = true; });

  // ——— drawing ———
  let checker: CanvasPattern | null = null;
  const pctx = (): CanvasRenderingContext2D | null => pixels.getContext("2d");
  const drawPixels = (): void => {
    const ctx = pctx();
    if (!ctx) return;
    const m = math(), v = m.v;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, pixels.width, pixels.height);
    const mx = m.matrix(dpr);
    ctx.setTransform(...mx);
    // transparency checkerboard under the document
    const ck = untrack(ed.prefs).checker;
    if (ck !== "none") {
      if (!checker) {
        const n = ck === "small" ? 4 : ck === "large" ? 16 : 8, c = makeCanvas(n * 2, n * 2);
        const x = c?.getContext("2d") as CanvasRenderingContext2D | null;
        if (x && c) { x.fillStyle = "#fff"; x.fillRect(0, 0, n * 2, n * 2); x.fillStyle = "#cfd3da"; x.fillRect(0, 0, n, n); x.fillRect(n, n, n, n); checker = ctx.createPattern(c as CanvasImageSource, "repeat"); }
      }
      if (checker) {
        ctx.save();
        // a constant on-screen checker size: undo the zoom on the pattern
        checker.setTransform?.(new DOMMatrix().scale(1 / v.zoom, 1 / v.zoom));
        ctx.fillStyle = checker;
        ctx.fillRect(0, 0, doc.width, doc.height);
        ctx.restore();
      }
    }
    ctx.imageSmoothingEnabled = v.zoom < 2;
    ctx.imageSmoothingQuality = "high";
    const level = clamp(Math.floor(Math.log2(1 / (v.zoom * dpr))), 0, MAX_LEVEL);
    const vis = m.visible();
    if (vis.w <= 0 || vis.h <= 0) return;
    const span = tiles.span(level);
    const x0 = Math.floor(vis.x / span), y0 = Math.floor(vis.y / span), x1 = Math.floor((vis.x + vis.w - 1) / span), y1 = Math.floor((vis.y + vis.h - 1) / span);
    const started = performance.now();
    let pending = false;
    // centre-out order so the middle sharpens first
    const order: [number, number][] = [];
    for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) order.push([tx, ty]);
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    order.sort((a, b) => Math.hypot(a[0] - cx, a[1] - cy) - Math.hypot(b[0] - cx, b[1] - cy));
    const seam = 0.6 / v.zoom;
    for (const [tx, ty] of order) {
      let got: { canvas: Drawable; fresh: boolean } | null = tiles.get(level, tx, ty);
      if ((!got || !got.fresh) && performance.now() - started < 12) {
        const c = tiles.render(level, tx, ty);
        got = c ? { canvas: c, fresh: true } : null;
      } else if (!got || !got.fresh) pending = true;
      if (got) {
        const w = got.canvas.width << level, hh = got.canvas.height << level;
        ctx.drawImage(got.canvas as CanvasImageSource, tx * span, ty * span, w + seam, hh + seam);
      } else {
        // a coarser level stands in
        for (let l = level + 1; l <= MAX_LEVEL; l++) {
          const s2 = tiles.span(l), ptx = Math.floor((tx * span) / s2), pty = Math.floor((ty * span) / s2), g = tiles.get(l, ptx, pty);
          if (!g) continue;
          const f = 1 << (l - level), sx = ((tx * span - ptx * s2) / s2) * g.canvas.width, sy = ((ty * span - pty * s2) / s2) * g.canvas.height;
          ctx.drawImage(g.canvas as CanvasImageSource, sx, sy, g.canvas.width / f, g.canvas.height / f, tx * span, ty * span, span, span);
          break;
        }
      }
    }
    tiles.evict(vis.x + vis.w / 2, vis.y + vis.h / 2);
    if (pending) needPixels = true;
  };

  // marching ants: the selection outline (cached per mask version), dashed, animated on the motion clock
  let antsKey = "", antsPath: Path2D | null = null, qmCanvas: Drawable | null = null, qmKey = "";
  const antsOf = (): Path2D | null => {
    const sel = doc.selection;
    if (!sel) return null;
    const key = `${sel.version}:${sel.data.length}:${sel === lastSel}`;
    if (key !== antsKey || sel !== lastSel) {
      lastSel = sel;
      antsKey = key;
      const step = Math.max(1, Math.round(Math.sqrt(doc.width * doc.height) / 2048));
      const p = new Path2D();
      for (const [a, b, c, d] of select.outline(sel, step) as [number, number, number, number][]) { p.moveTo(a, b); p.lineTo(c, d); }
      antsPath = p;
    }
    return antsPath;
  };
  let lastSel: unknown = null;

  const docLine = (ctx: CanvasRenderingContext2D, m: ViewMath, x1: number, y1: number, x2: number, y2: number): void => {
    const [a, b] = m.toScreen(x1, y1), [c, d] = m.toScreen(x2, y2);
    ctx.beginPath(); ctx.moveTo(a * dpr, b * dpr); ctx.lineTo(c * dpr, d * dpr); ctx.stroke();
  };

  const drawOverlay = (): void => {
    const ctx = overlay.getContext("2d");
    if (!ctx) return;
    const m = math(), v = m.v, mx = m.matrix(dpr), prefs = untrack(ed.prefs);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    const css = getComputedStyle(root);
    const accent = css.getPropertyValue("--m-pe-accent").trim() || "#4f8cff";
    const guideColor = css.getPropertyValue("--m-pe-guide").trim() || "#00c4ff";
    // pixel grid
    if (v.extras && v.pixelGrid && v.zoom >= prefs.pixelGridAt) {
      const vis = m.visible();
      ctx.strokeStyle = "rgba(128,128,128,.35)";
      ctx.lineWidth = 1;
      for (let x = vis.x; x <= vis.x + vis.w; x++) docLine(ctx, m, x, vis.y, x, vis.y + vis.h);
      for (let y = vis.y; y <= vis.y + vis.h; y++) docLine(ctx, m, vis.x, y, vis.x + vis.w, y);
    }
    // grid
    if (v.extras && v.grid) {
      const g = doc.grid, step = g.every, sub = step / Math.max(1, g.subdivisions);
      const vis = m.visible();
      for (const [st, alpha] of [[sub, 0.18], [step, 0.45]] as const) {
        if (st * v.zoom < 4) continue;
        ctx.strokeStyle = `rgba(${g.color[0] * 255},${g.color[1] * 255},${g.color[2] * 255},${alpha})`;
        ctx.setLineDash(g.style === "dashed" ? [4 * dpr, 4 * dpr] : []);
        for (let x = Math.ceil(vis.x / st) * st; x <= vis.x + vis.w; x += st) docLine(ctx, m, x, 0, x, doc.height);
        for (let y = Math.ceil(vis.y / st) * st; y <= vis.y + vis.h; y += st) docLine(ctx, m, 0, y, doc.width, y);
      }
      ctx.setLineDash([]);
    }
    // artboards, slices
    if (v.extras) {
      for (const l of doc.all()) if (l.kind === "artboard") {
        const [lx, ly] = m.toScreen(l.rect.x, l.rect.y);
        ctx.fillStyle = css.getPropertyValue("--m-pe-muted").trim() || "#9aa3b2";
        ctx.font = `${12 * dpr}px system-ui, sans-serif`;
        ctx.fillText(l.name, lx * dpr, (ly - 6) * dpr);
      }
      ctx.strokeStyle = "rgba(255,170,0,.8)";
      for (const s of doc.slices) {
        ctx.setTransform(...mx); ctx.lineWidth = 1 / v.zoom;
        ctx.strokeRect(s.rect.x, s.rect.y, s.rect.w, s.rect.h);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
    // guides
    if (v.extras && v.guides) {
      ctx.strokeStyle = guideColor;
      ctx.lineWidth = Math.max(1, dpr);
      for (const g of doc.guides) g.axis === "x" ? docLine(ctx, m, g.pos, -1e5, g.pos, 1e5) : docLine(ctx, m, -1e5, g.pos, 1e5, g.pos);
    }
    // quick mask: the unselected area tinted
    if (untrack(ed.quickMask) || doc.quickMask) {
      const sel = doc.selection;
      const key = `${sel?.version ?? -1}:${!!sel}`;
      if (key !== qmKey) {
        qmKey = key;
        const scale = Math.min(1, 2048 / Math.max(doc.width, doc.height)), w = Math.max(1, Math.round(doc.width * scale)), hh = Math.max(1, Math.round(doc.height * scale));
        qmCanvas = makeCanvas(w, hh);
        const qx = qmCanvas?.getContext("2d") as CanvasRenderingContext2D | null;
        if (qx) {
          const img = new ImageData(w, hh);
          for (let y = 0; y < hh; y++) for (let x = 0; x < w; x++) {
            const a = 255 - (sel ? sel.get(Math.floor(x / scale), Math.floor(y / scale)) : 0), i = (y * w + x) * 4;
            img.data[i] = 255; img.data[i + 3] = a * 0.5;
          }
          qx.putImageData(img, 0, 0);
        }
      }
      if (qmCanvas) { ctx.setTransform(...mx); ctx.drawImage(qmCanvas as CanvasImageSource, 0, 0, doc.width, doc.height); ctx.setTransform(1, 0, 0, 1, 0, 0); }
    } else if (v.extras && v.edges) {
      const p = antsOf();
      if (p) {
        ctx.setTransform(...mx);
        ctx.lineWidth = 1 / v.zoom;
        ctx.strokeStyle = "#000";
        ctx.setLineDash([]);
        ctx.stroke(p);
        ctx.strokeStyle = "#fff";
        ctx.setLineDash([4 / v.zoom, 4 / v.zoom]);
        ctx.lineDashOffset = -antsT / v.zoom;
        ctx.stroke(p);
        ctx.setLineDash([]);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
      }
    }
    // notes, counts, samplers
    if (v.extras) {
      ctx.font = `600 ${11 * dpr}px system-ui, sans-serif`;
      doc.counts.forEach((g) => { if (!g.visible) return; ctx.fillStyle = `rgb(${g.color[0] * 255},${g.color[1] * 255},${g.color[2] * 255})`; g.points.forEach(([x, y], i) => { const [sx, sy] = m.toScreen(x, y); ctx.fillText(String(i + 1), sx * dpr + 4, sy * dpr - 4); ctx.fillRect(sx * dpr - 2, sy * dpr - 2, 4, 4); }); });
      doc.samplers.forEach((s, i) => { const [sx, sy] = m.toScreen(s.x, s.y); ctx.strokeStyle = "#fff"; ctx.beginPath(); ctx.arc(sx * dpr, sy * dpr, 6 * dpr, 0, 6.3); ctx.stroke(); ctx.fillStyle = "#fff"; ctx.fillText(String(i + 1), sx * dpr + 8 * dpr, sy * dpr + 12 * dpr); });
      for (const n of doc.notes) { const [sx, sy] = m.toScreen(n.x, n.y); ctx.fillStyle = "#ffd34d"; ctx.fillRect(sx * dpr - 6 * dpr, sy * dpr - 6 * dpr, 12 * dpr, 12 * dpr); }
    }
    // the tool's own shapes
    const tool = getTool(untrack(ed.tool)), tctx = ed.toolContext();
    if (tool?.overlay && tctx) for (const s of tool.overlay(tctx)) drawShape(ctx, m, s, accent);
    // brush tip cursor
    if (hoverSample && tctx && tool && (prefs.cursors === "tip" || prefs.cursors === "tip-crosshair")) {
      const o = tctx.options as { size?: number; hardness?: number };
      if (typeof o.size === "number" && /brush|eraser|stamp|heal|blur|sharpen|smudge|dodge|burn|sponge|history|mixer|replace|pencil|liquify/.test(tool.id)) {
        const [sx, sy] = m.toScreen(hoverSample.x, hoverSample.y);
        ctx.strokeStyle = "rgba(0,0,0,.6)"; ctx.lineWidth = 2 * dpr;
        ctx.beginPath(); ctx.arc(sx * dpr, sy * dpr, Math.max(1, (o.size / 2) * v.zoom * dpr), 0, 6.3); ctx.stroke();
        ctx.strokeStyle = "rgba(255,255,255,.9)"; ctx.lineWidth = 1 * dpr; ctx.stroke();
        if (prefs.cursors === "tip-crosshair") { ctx.beginPath(); ctx.moveTo(sx * dpr - 5 * dpr, sy * dpr); ctx.lineTo(sx * dpr + 5 * dpr, sy * dpr); ctx.moveTo(sx * dpr, sy * dpr - 5 * dpr); ctx.lineTo(sx * dpr, sy * dpr + 5 * dpr); ctx.stroke(); }
      }
    }
  };

  const drawShape = (ctx: CanvasRenderingContext2D, m: ViewMath, s: OverlayShape, accent: string): void => {
    const mx = m.matrix(dpr), z = m.v.zoom;
    const color = ("color" in s && s.color) || accent;
    ctx.save();
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = dpr;
    if ("dash" in s && s.dash) ctx.setLineDash([4 * dpr, 4 * dpr]), (ctx.lineDashOffset = -antsT * dpr);
    switch (s.type) {
      case "line": docLine(ctx, m, s.x1, s.y1, s.x2, s.y2); break;
      case "rect": case "ellipse": {
        ctx.setTransform(...mx); ctx.lineWidth = 1 / z;
        if ("dash" in s && s.dash) ctx.setLineDash([4 / z, 4 / z]);
        if (s.type === "rect") {
          if ("fill" in s && s.fill) { ctx.fillStyle = s.fill; ctx.fillRect(s.rect.x, s.rect.y, s.rect.w, s.rect.h); }
          ctx.strokeRect(s.rect.x, s.rect.y, s.rect.w, s.rect.h);
        } else { ctx.beginPath(); ctx.ellipse(s.rect.x + s.rect.w / 2, s.rect.y + s.rect.h / 2, Math.abs(s.rect.w / 2), Math.abs(s.rect.h / 2), 0, 0, 6.3); ctx.stroke(); }
        break;
      }
      case "polyline": {
        ctx.setTransform(...mx); ctx.lineWidth = (s.width ?? 1) / z;
        if (s.dash) ctx.setLineDash([4 / z, 4 / z]);
        ctx.beginPath();
        s.points.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
        if (s.closed) ctx.closePath();
        ctx.stroke();
        break;
      }
      case "path": {
        ctx.setTransform(...mx); ctx.lineWidth = 1 / z;
        ctx.beginPath();
        for (const sp of s.path.subpaths) {
          const A = sp.anchors;
          if (!A.length) continue;
          ctx.moveTo(A[0]!.x, A[0]!.y);
          const n = sp.closed ? A.length : A.length - 1;
          for (let i = 0; i < n; i++) { const a = A[i]!, b = A[(i + 1) % A.length]!; ctx.bezierCurveTo(a.ox, a.oy, b.ix, b.iy, b.x, b.y); }
          if (sp.closed) ctx.closePath();
        }
        ctx.stroke();
        if (s.anchors) {
          ctx.setTransform(1, 0, 0, 1, 0, 0);
          let k = 0;
          for (const sp of s.path.subpaths) for (const a of sp.anchors) {
            const [x, y] = m.toScreen(a.x, a.y), sel = s.selected?.includes(k++);
            if (sel) { for (const [hx, hy] of [[a.ix, a.iy], [a.ox, a.oy]] as const) { const [qx, qy] = m.toScreen(hx, hy); ctx.beginPath(); ctx.moveTo(x * dpr, y * dpr); ctx.lineTo(qx * dpr, qy * dpr); ctx.stroke(); ctx.beginPath(); ctx.arc(qx * dpr, qy * dpr, 3 * dpr, 0, 6.3); ctx.fill(); } }
            ctx.fillStyle = sel ? color : "#fff"; ctx.fillRect(x * dpr - 3.5 * dpr, y * dpr - 3.5 * dpr, 7 * dpr, 7 * dpr);
            ctx.strokeRect(x * dpr - 3.5 * dpr, y * dpr - 3.5 * dpr, 7 * dpr, 7 * dpr);
          }
        }
        break;
      }
      case "handle": case "pin": {
        const [x, y] = m.toScreen(s.x, s.y), r = (s.type === "pin" ? 6 : 5) * dpr;
        ctx.fillStyle = s.active ? color : "#fff";
        ctx.beginPath();
        if (s.type === "pin" || ("shape" in s && s.shape === "circle")) ctx.arc(x * dpr, y * dpr, r, 0, 6.3);
        else if ("shape" in s && s.shape === "diamond") { ctx.moveTo(x * dpr, y * dpr - r); ctx.lineTo(x * dpr + r, y * dpr); ctx.lineTo(x * dpr, y * dpr + r); ctx.lineTo(x * dpr - r, y * dpr); ctx.closePath(); }
        else ctx.rect(x * dpr - r, y * dpr - r, r * 2, r * 2);
        ctx.fill(); ctx.stroke();
        break;
      }
      case "brush": {
        const [x, y] = m.toScreen(s.x, s.y);
        ctx.beginPath(); ctx.ellipse(x * dpr, y * dpr, (s.size / 2) * z * dpr, (s.size / 2) * z * dpr * (s.roundness ?? 1), s.angle ?? 0, 0, 6.3); ctx.stroke();
        break;
      }
      case "crosshair": { const [x, y] = m.toScreen(s.x, s.y); ctx.beginPath(); ctx.moveTo(x * dpr - 8 * dpr, y * dpr); ctx.lineTo(x * dpr + 8 * dpr, y * dpr); ctx.moveTo(x * dpr, y * dpr - 8 * dpr); ctx.lineTo(x * dpr, y * dpr + 8 * dpr); ctx.stroke(); break; }
      case "label": {
        const [x, y] = m.toScreen(s.x, s.y);
        ctx.font = `600 ${11 * dpr}px system-ui, sans-serif`;
        const w = ctx.measureText(s.text).width + 10 * dpr;
        ctx.fillStyle = "rgba(20,22,28,.85)"; ctx.fillRect(x * dpr + 10 * dpr, y * dpr + 10 * dpr, w, 18 * dpr);
        ctx.fillStyle = "#fff"; ctx.fillText(s.text, x * dpr + 15 * dpr, y * dpr + 23 * dpr);
        break;
      }
      case "mesh": {
        ctx.setTransform(...mx); ctx.lineWidth = 1 / z;
        const P = s.points, C = s.cols + 1;
        ctx.beginPath();
        for (let r = 0; r <= s.rows; r++) for (let c = 0; c <= s.cols; c++) {
          const i = (r * C + c) * 2;
          if (c < s.cols) { ctx.moveTo(P[i]!, P[i + 1]!); ctx.lineTo(P[i + 2]!, P[i + 3]!); }
          if (r < s.rows) { ctx.moveTo(P[i]!, P[i + 1]!); ctx.lineTo(P[i + C * 2]!, P[i + C * 2 + 1]!); }
        }
        ctx.stroke();
        break;
      }
      case "image": {
        const c = makeCanvas(s.width, s.height), x = c?.getContext("2d") as CanvasRenderingContext2D | null;
        if (c && x) {
          const img = new ImageData(s.width, s.height);
          for (let i = 0; i < s.pixels.length; i++) img.data[i] = s.pixels[i]! * 255;
          x.putImageData(img, 0, 0);
          ctx.setTransform(...mx);
          if (s.matrix) ctx.transform(s.matrix[0]!, s.matrix[1]!, s.matrix[2]!, s.matrix[3]!, s.matrix[4]!, s.matrix[5]!);
          ctx.globalAlpha = s.opacity ?? 1;
          ctx.drawImage(c as CanvasImageSource, s.rect.x, s.rect.y, s.rect.w, s.rect.h);
        }
        break;
      }
    }
    ctx.restore();
  };

  // rulers
  const drawRulers = (): void => {
    if (!untrack(entry.view).rulers) return;
    const m = math(), [w, hh] = size.peek(), units = untrack(ed.prefs).units;
    const per = units === "px" ? 1 : units === "%" ? doc.width / 100 : units === "in" ? doc.dpi : units === "cm" ? doc.dpi / 2.54 : units === "mm" ? doc.dpi / 25.4 : units === "pt" ? doc.dpi / 72 : doc.dpi / 6;
    const css = getComputedStyle(root);
    const fg = css.getPropertyValue("--m-pe-muted").trim() || "#9aa3b2";
    const steps = [1, 2, 5, 10, 20, 25, 50, 100, 200, 250, 500, 1000, 2000, 5000, 10000];
    const unitPx = per * m.v.zoom;
    const major = steps.find((s) => s * unitPx >= 60) ?? 10000;
    for (const [c, horiz] of [[rulerX, true], [rulerY, false]] as const) {
      const len = horiz ? w : hh, th = 20;
      c.width = Math.max(1, Math.round((horiz ? len : th) * dpr)); c.height = Math.max(1, Math.round((horiz ? th : len) * dpr));
      const x = c.getContext("2d");
      if (!x) continue;
      x.scale(dpr, dpr);
      x.strokeStyle = fg; x.fillStyle = fg; x.font = "10px system-ui, sans-serif"; x.lineWidth = 1;
      const [d0] = horiz ? [m.toDoc(0, hh / 2)[0]] : [m.toDoc(w / 2, 0)[1]];
      const [d1] = horiz ? [m.toDoc(w, hh / 2)[0]] : [m.toDoc(w / 2, hh)[1]];
      const a = Math.min(d0, d1) / per, b = Math.max(d0, d1) / per;
      for (let u = Math.floor(a / major) * major; u <= b; u += major / 10) {
        const docPos = u * per, s = horiz ? m.toScreen(docPos, doc.height / 2)[0] : m.toScreen(doc.width / 2, docPos)[1];
        const isMajor = Math.abs(u / major - Math.round(u / major)) < 1e-6, half = Math.abs((u * 2) / major - Math.round((u * 2) / major)) < 1e-6;
        const t2 = isMajor ? th : half ? th * 0.5 : th * 0.25;
        x.beginPath();
        if (horiz) { x.moveTo(s + 0.5, th); x.lineTo(s + 0.5, th - t2); } else { x.moveTo(th, s + 0.5); x.lineTo(th - t2, s + 0.5); }
        x.stroke();
        if (isMajor) {
          const label = String(Math.round(u * 100) / 100);
          if (horiz) x.fillText(label, s + 3, 9);
          else { x.save(); x.translate(9, s + 3); x.rotate(-Math.PI / 2); x.fillText(label, 0, 0); x.restore(); }
        }
      }
      if (pointer) {
        const [px, py] = m.toScreen(pointer[0], pointer[1]);
        x.strokeStyle = "#ff5a5a"; x.beginPath();
        if (horiz) { x.moveTo(px, 0); x.lineTo(px, th); } else { x.moveTo(0, py); x.lineTo(th, py); }
        x.stroke();
      }
    }
  };

  // the frame loop (motion clock: pausing motion stops the ants, never the drawing)
  const stopFrames = onFrame((_t, dt) => {
    const animate = untrack(ed.prefs).motion && !reducedMotion();
    if (doc.selection && animate) { antsT = (antsT + (dt / 1000) * untrack(ed.prefs).antsSpeed) % 8; needOverlay = true; }
    if (needPixels) { needPixels = false; drawPixels(); needOverlay = true; }
    if (needOverlay) { needOverlay = false; drawOverlay(); drawRulers(); }
  }, { essential: true });
  onCleanup(stopFrames);

  // ——— input ———
  const docPoint = (e: { clientX: number; clientY: number }): [number, number] => {
    const r = port.getBoundingClientRect();
    return math().toDoc(e.clientX - r.left, e.clientY - r.top);
  };
  const toSample = (e: PointerEvent): PointerSample => {
    const [x, y] = docPoint(e);
    const pen = e.pointerType === "pen";
    return sample(x, y, {
      pressure: pen ? e.pressure : e.buttons ? 0.5 : 0, tiltX: e.tiltX || 0, tiltY: e.tiltY || 0, twist: e.twist || 0, time: e.timeStamp,
      pointerType: (e.pointerType || "mouse") as PointerSample["pointerType"], button: e.button, shift: e.shiftKey, alt: e.altKey, ctrl: e.ctrlKey, meta: e.metaKey,
    });
  };

  let spaceDown = false;
  const offKeys = on(globalThis.document, "keydown", (e: KeyboardEvent) => { if (e.code === "Space" && !isTyping(e)) { spaceDown = true; setCursor("grab"); } });
  const offKeysUp = on(globalThis.document, "keyup", (e: KeyboardEvent) => { if (e.code === "Space") { spaceDown = false; updateCursor(); } });
  onCleanup(() => { offKeys(); offKeysUp(); });

  const setCursor = (c: ToolCursor): void => { setStyle(port, { cursor: c === "brush" ? (untrack(ed.prefs).cursors === "precise" ? "crosshair" : "none") : CURSORS[c] ?? "crosshair" }); };
  const updateCursor = (): void => {
    const tool = getTool(untrack(ed.tool)), ctx = ed.toolContext();
    if (spaceDown) return setCursor("grab");
    if (untrack(ed.tool) === "hand") return setCursor("grab");
    if (untrack(ed.tool) === "zoom") return setCursor("zoom-in");
    setCursor(tool?.cursor && ctx ? tool.cursor(ctx, hoverSample) : "crosshair");
  };
  effect(() => { ed.tool(); updateCursor(); });

  const pan = (e: PointerEvent): void => {
    const v0 = untrack(entry.view);
    setCursor("grabbing");
    pointerDrag(e, { threshold: 0, onMove: (p) => setView({ ...v0, panX: v0.panX + p.dx, panY: v0.panY + p.dy }), onEnd: () => updateCursor(), onClick: () => updateCursor() });
  };

  // touch gestures: two fingers pan / pinch / rotate; a quick two-finger tap undoes, three fingers redo
  const touches = new Map<number, [number, number]>();
  let gesture: { v: ViewState; d: number; a: number; cx: number; cy: number; t: number; moved: boolean; n: number } | null = null;
  const gestureFrom = (): { d: number; a: number; cx: number; cy: number } => {
    const pts = [...touches.values()], [p, q] = [pts[0]!, pts[1] ?? pts[0]!];
    return { d: Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, a: Math.atan2(q[1] - p[1], q[0] - p[0]), cx: (p[0] + q[0]) / 2, cy: (p[1] + q[1]) / 2 };
  };
  let strokeOpen = false;

  port.addEventListener("pointerdown", (e: PointerEvent) => {
    port.focus({ preventScroll: true });
    if (e.pointerType === "touch") {
      const r = port.getBoundingClientRect();
      touches.set(e.pointerId, [e.clientX - r.left, e.clientY - r.top]);
      if (touches.size >= 2) {
        if (strokeOpen) { getTool(untrack(ed.tool))?.cancel?.(ed.toolContext()!); strokeOpen = false; doc.cancel(); }
        const g = gestureFrom();
        gesture = { v: untrack(entry.view), ...g, t: e.timeStamp, moved: false, n: touches.size };
        return;
      }
    }
    if (e.button === 1 || spaceDown || untrack(ed.tool) === "hand") { e.preventDefault(); pan(e); return; }
    if (e.button === 2) return;
    const id = untrack(ed.tool);
    if (id === "zoom") {
      const r = port.getBoundingClientRect(), [w, hh] = size.peek(), v = untrack(entry.view);
      const sx = e.clientX - r.left, sy = e.clientY - r.top;
      // scrubby zoom on drag, a step on click
      pointerDrag(e, {
        threshold: 3,
        onMove: (p) => setView(zoomAt(v, v.zoom * Math.pow(2, p.dx / 120), sx, sy, w, hh, doc.width, doc.height)),
        onClick: (ev) => setView(zoomAt(v, stepZoom(v.zoom, ev.altKey ? -1 : 1), sx, sy, w, hh, doc.width, doc.height)),
      });
      return;
    }
    if (id === "rotate-view") {
      const r = port.getBoundingClientRect(), c = [r.left + r.width / 2, r.top + r.height / 2], v = untrack(entry.view);
      const a0 = Math.atan2(e.clientY - c[1]!, e.clientX - c[0]!);
      pointerDrag(e, { threshold: 0, onMove: (p) => {
        let a = v.angle + Math.atan2(p.clientY - c[1]!, p.clientX - c[0]!) - a0;
        if (p.event?.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12);
        setView({ ...v, angle: a });
      } });
      return;
    }
    const tool = getTool(id), ctx = ed.toolContext();
    if (!tool || !ctx) return;
    // guides follow the move tool
    if (id === "move" && dragGuide(e)) return;
    const s = toSample(e);
    tool.down?.(ctx, s);
    strokeOpen = true;
    needOverlay = true;
    pointerDrag(e, {
      threshold: 0,
      onMove: (p) => {
        const ev = p.event;
        if (!ev || !strokeOpen) return;
        const list = typeof ev.getCoalescedEvents === "function" ? ev.getCoalescedEvents() : [];
        for (const ce of list.length ? list : [ev]) tool.move?.(ctx, toSample(ce));
        hoverSample = toSample(ev);
        pointer = [hoverSample.x, hoverSample.y];
        needOverlay = true;
      },
      onEnd: (p, cancelled) => {
        if (!strokeOpen) return;
        strokeOpen = false;
        if (cancelled) tool.cancel?.(ctx); else tool.up?.(ctx, p.event ? toSample(p.event) : s);
        needOverlay = true;
        updateCursor();
      },
      onClick: (ev) => { if (!strokeOpen) return; strokeOpen = false; tool.up?.(ctx, toSample(ev)); needOverlay = true; updateCursor(); },
    });
  });
  port.addEventListener("pointermove", (e: PointerEvent) => {
    if (e.pointerType === "touch" && touches.has(e.pointerId)) {
      const r = port.getBoundingClientRect();
      touches.set(e.pointerId, [e.clientX - r.left, e.clientY - r.top]);
      if (gesture && touches.size >= 2) {
        const g = gestureFrom(), [w, hh] = size.peek(), v0 = gesture.v;
        if (Math.abs(g.d - gesture.d) > 8 || Math.hypot(g.cx - gesture.cx, g.cy - gesture.cy) > 8) gesture.moved = true;
        let v = zoomAt(v0, v0.zoom * (g.d / gesture.d), gesture.cx, gesture.cy, w, hh, doc.width, doc.height);
        v = { ...v, angle: v0.angle + (g.a - gesture.a), panX: v.panX + g.cx - gesture.cx, panY: v.panY + g.cy - gesture.cy };
        setView(v);
      }
      return;
    }
    const s = toSample(e);
    hoverSample = s;
    pointer = [s.x, s.y];
    ed.shared.pointer = pointer;
    if (!e.buttons) { const tool = getTool(untrack(ed.tool)), ctx = ed.toolContext(); if (tool?.hover && ctx) tool.hover(ctx, s); updateCursor(); }
    needOverlay = true;
    ed.emit("doc:change", { entry, pointer });
  });
  const endTouch = (e: PointerEvent): void => {
    if (!touches.has(e.pointerId)) return;
    touches.delete(e.pointerId);
    if (gesture && touches.size === 0) {
      if (!gesture.moved && e.timeStamp - gesture.t < 300) { if (gesture.n >= 3) doc.redo(); else doc.undo(); ed.announce(gesture.n >= 3 ? t`Redo` : t`Undo`); }
      gesture = null;
    }
  };
  port.addEventListener("pointerup", endTouch);
  port.addEventListener("pointercancel", endTouch);
  port.addEventListener("pointerleave", () => { hoverSample = null; pointer = null; needOverlay = true; });
  port.addEventListener("dblclick", (e: MouseEvent) => { const tool = getTool(untrack(ed.tool)), ctx = ed.toolContext(); if (tool?.dbl && ctx) tool.dbl(ctx, toSample(e as PointerEvent)); });
  port.addEventListener("contextmenu", (e: MouseEvent) => { e.preventDefault(); const [x, y] = docPoint(e); props.onContext?.(e, x, y); });
  port.addEventListener("wheel", (e: WheelEvent) => {
    e.preventDefault();
    const r = port.getBoundingClientRect(), [w, hh] = size.peek(), v = untrack(entry.view);
    const zoomIt = e.ctrlKey || e.altKey || e.metaKey || untrack(ed.prefs).wheelZooms;
    if (zoomIt) {
      const k = Math.exp(-e.deltaY * (e.deltaMode === 1 ? 0.05 : 0.0015));
      setView(zoomAt(v, v.zoom * k, e.clientX - r.left, e.clientY - r.top, w, hh, doc.width, doc.height));
    } else {
      const dx = e.shiftKey ? e.deltaY : e.deltaX, dy = e.shiftKey ? 0 : e.deltaY;
      setView({ ...v, panX: v.panX - dx, panY: v.panY - dy });
    }
  }, { passive: false });

  // guides: drag from a ruler to make one, drag one with the move tool, drop it outside to remove it
  const guideAt = (sx: number, sy: number): string | null => {
    const m = math();
    for (const g of doc.guides) {
      const [gx, gy] = m.toScreen(g.axis === "x" ? g.pos : 0, g.axis === "y" ? g.pos : 0);
      if (g.axis === "x" ? Math.abs(gx - sx) < 4 : Math.abs(gy - sy) < 4) return g.id;
    }
    return null;
  };
  const dragGuide = (e: PointerEvent, axis?: "x" | "y"): boolean => {
    const r = port.getBoundingClientRect();
    let id = axis ? null : guideAt(e.clientX - r.left, e.clientY - r.top);
    if (!axis && !id) return false;
    if (!untrack(entry.view).guides) return false;
    doc.begin(id ? "Move Guide" : "New Guide");
    if (!id) { id = newId("g"); doc.guides = [...doc.guides, { id, axis: axis!, pos: -1e6 }]; }
    const gid = id;
    pointerDrag(e, {
      threshold: 0,
      onMove: (p) => {
        const [x, y] = docPoint({ clientX: p.clientX, clientY: p.clientY });
        doc.guides = doc.guides.map((g) => (g.id === gid ? { ...g, pos: Math.round(g.axis === "x" ? x : y) } : g));
        needOverlay = true;
      },
      onEnd: (p, cancelled) => {
        const inside = p.clientX >= r.left && p.clientX <= r.right && p.clientY >= r.top && p.clientY <= r.bottom;
        if (!inside) doc.guides = doc.guides.filter((g) => g.id !== gid);
        if (cancelled) doc.cancel(); else doc.commit();
        needOverlay = true;
      },
      onClick: () => { doc.cancel(); },
    });
    return true;
  };
  rulerX.addEventListener("pointerdown", (e: PointerEvent) => dragGuide(e, "y"));
  rulerY.addEventListener("pointerdown", (e: PointerEvent) => dragGuide(e, "x"));
  corner.addEventListener("dblclick", () => setView({ ...untrack(entry.view) }));

  return root;
}

const isTyping = (e: KeyboardEvent): boolean => {
  const el = e.target as HTMLElement | null;
  return !!el && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
};

/** Is the key event aimed at a text field (shortcuts stay off)? */
export { isTyping };

/** A fit-to-view helper for documents not shown yet. */
export const docFits = (doc: ImageDocument, w: number, h: number): number => Math.min(w / doc.width, h / doc.height);
