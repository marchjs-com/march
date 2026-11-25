// Fill family: paint bucket (tolerance, contiguous, anti-alias, all layers; foreground or pattern; mode, opacity) and
// the gradient tool (linear, radial, angle, reflected, diamond; dither, reverse, transparency; mode, opacity; drawn
// live while dragging, Shift snaps to 45°). Also the flood fill both the bucket and the magic eraser use: it reads the
// image tile by tile on demand, so a small fill on a 4K canvas touches only the tiles it needs.

import { compositeInto, type BlendMode } from "../blend.ts";
import { renderRegion } from "../composite.ts";
import type { ImageDocument } from "../document.ts";
import { hasRaster, type Gradient, type Layer, type Pattern, type RGBA } from "../layers.ts";
import { renderGradient, renderPattern } from "../paint.ts";
import { TILE, tileKey, type Rect } from "../tiles.ts";
import { PaintSurface, findPattern, paintBlocker, type PaintMode } from "../brush/engine.ts";
import { bool, choice, optBool, optMode, optNum, optOpacity, optPct, optStr, targetOf, type PaintTool } from "./paint-common.ts";
import type { OverlayShape, ToolContext } from "./tool.ts";

/** A flood fill result: an 8-bit mask the document's size and the bounds of what it covers. */
export interface FloodResult { mask: Uint8Array; bounds: Rect }

/**
 * Pixels similar to the one at (x, y): tolerance 0–255 on the largest channel difference (alpha included), contiguous
 * (scanline flood) or everywhere; reading the active layer or all layers merged. Anti-alias softens the edge pixels.
 */
export function floodMask(doc: ImageDocument, layer: Layer | null, x: number, y: number, o: { tolerance: number; contiguous: boolean; sampleAll: boolean; antialias: boolean }): FloodResult | null {
  const W = doc.width, H = doc.height, x0 = Math.floor(x), y0 = Math.floor(y);
  if (x0 < 0 || y0 < 0 || x0 >= W || y0 >= H) return null;
  const chunks = new Map<number, Float32Array>();
  const chunk = (tx: number, ty: number): Float32Array => {
    const k = tileKey(tx, ty);
    let c = chunks.get(k);
    if (!c) {
      const r = { x: tx * TILE, y: ty * TILE, w: TILE, h: TILE };
      if (o.sampleAll || !layer || !hasRaster(layer)) {
        c = renderRegion(doc, r);
        for (let i = 0; i < c.length; i += 4) { const a = c[i + 3]!; if (a > 0) { c[i]! /= a; c[i + 1]! /= a; c[i + 2]! /= a; } }
      } else c = layer.raster.read(r.x, r.y, r.w, r.h);
      chunks.set(k, c);
    }
    return c;
  };
  const at = (px: number, py: number): number => ((py & (TILE - 1)) * TILE + (px & (TILE - 1))) * 4;
  const c0 = chunk(x0 >> 8, y0 >> 8), i0 = at(x0, y0);
  const ref = [c0[i0]!, c0[i0 + 1]!, c0[i0 + 2]!, c0[i0 + 3]!];
  const tol = o.tolerance / 255 + 1e-6;
  const ok = (px: number, py: number): boolean => {
    const c = chunk(px >> 8, py >> 8), i = at(px, py);
    return Math.abs(c[i]! - ref[0]!) <= tol && Math.abs(c[i + 1]! - ref[1]!) <= tol && Math.abs(c[i + 2]! - ref[2]!) <= tol && Math.abs(c[i + 3]! - ref[3]!) <= tol;
  };
  const mask = new Uint8Array(W * H);
  let bx0 = W, by0 = H, bx1 = -1, by1 = -1;
  const mark = (px: number, py: number): void => { mask[py * W + px] = 255; if (px < bx0) bx0 = px; if (px > bx1) bx1 = px; if (py < by0) by0 = py; if (py > by1) by1 = py; };
  if (!o.contiguous) {
    for (let py = 0; py < H; py++) for (let px = 0; px < W; px++) if (ok(px, py)) mark(px, py);
  } else {
    const stack: number[] = [x0, y0];
    while (stack.length) {
      const sy = stack.pop()!, sx = stack.pop()!;
      if (mask[sy * W + sx]) continue;
      let lx = sx, rx = sx;
      while (lx > 0 && !mask[sy * W + lx - 1] && ok(lx - 1, sy)) lx--;
      while (rx < W - 1 && !mask[sy * W + rx + 1] && ok(rx + 1, sy)) rx++;
      for (let px = lx; px <= rx; px++) mark(px, sy);
      for (const ny of [sy - 1, sy + 1]) {
        if (ny < 0 || ny >= H) continue;
        let inRun = false;
        for (let px = lx; px <= rx; px++) {
          const good = !mask[ny * W + px] && ok(px, ny);
          if (good && !inRun) { stack.push(px, ny); inRun = true; } else if (!good) inRun = false;
        }
      }
    }
  }
  if (bx1 < 0) return null;
  if (o.antialias) {
    // soften the stair steps: edge pixels take their 3×3 average
    const ex0 = Math.max(0, bx0 - 1), ey0 = Math.max(0, by0 - 1), ex1 = Math.min(W - 1, bx1 + 1), ey1 = Math.min(H - 1, by1 + 1);
    const copy = mask.slice();
    for (let py = ey0; py <= ey1; py++) for (let px = ex0; px <= ex1; px++) {
      let s = 0, n = 0, on = 0;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        const qx = px + dx, qy = py + dy;
        if (qx < 0 || qy < 0 || qx >= W || qy >= H) continue;
        const v = copy[qy * W + qx]!;
        s += v; n++; if (v) on++;
      }
      if (on && on < n) mask[py * W + px] = Math.max(copy[py * W + px]! ? 128 : 0, Math.round(s / n));
    }
    bx0 = ex0; by0 = ey0; bx1 = ex1; by1 = ey1;
  }
  return { mask, bounds: { x: bx0, y: by0, w: bx1 - bx0 + 1, h: by1 - by0 + 1 } };
}

/** Run fn over a rectangle in tile-sized pieces (bounded scratch memory). */
export function forChunks(r: Rect, fn: (c: Rect) => void): void {
  for (let y = r.y; y < r.y + r.h; y += TILE) for (let x = r.x; x < r.x + r.w; x += TILE) fn({ x, y, w: Math.min(TILE, r.x + r.w - x), h: Math.min(TILE, r.y + r.h - y) });
}

/**
 * Composite straight paint over `base` with a per-pixel coverage, a paint mode and opacity: the shared kernel of the
 * bucket and gradient (normal… modes through compositeInto, plus behind and clear). Result is straight RGBA in `out`.
 */
export function paintOver(base: Float32Array, paint: Float32Array, cov: Float32Array | null, mode: PaintMode, opacity: number, r: Rect, out: Float32Array): void {
  const n = r.w * r.h;
  if (mode === "clear") {
    for (let p = 0; p < n; p++) { const i = p * 4, k = opacity * (cov ? cov[p]! : 1) * paint[i + 3]!; out[i] = base[i]!; out[i + 1] = base[i + 1]!; out[i + 2] = base[i + 2]!; out[i + 3] = base[i + 3]! * (1 - k); }
    return;
  }
  if (mode === "behind") {
    for (let p = 0; p < n; p++) {
      const i = p * 4, ba = base[i + 3]!, sa = paint[i + 3]! * opacity * (cov ? cov[p]! : 1) * (1 - ba), oa = ba + sa;
      if (oa <= 0) { out[i] = out[i + 1] = out[i + 2] = out[i + 3] = 0; continue; }
      for (let c = 0; c < 3; c++) out[i + c] = (base[i + c]! * ba + paint[i + c]! * sa) / oa;
      out[i + 3] = oa;
    }
    return;
  }
  for (let i = 0; i < n * 4; i += 4) { const a = base[i + 3]!; out[i] = base[i]! * a; out[i + 1] = base[i + 1]! * a; out[i + 2] = base[i + 2]! * a; out[i + 3] = a; }
  compositeInto(out, paint, { mode: mode as BlendMode, opacity, mask: cov, x: r.x, y: r.y, w: r.w });
  for (let i = 0; i < n * 4; i += 4) { const a = out[i + 3]!; if (a > 0) { out[i]! /= a; out[i + 1]! /= a; out[i + 2]! /= a; } else out[i] = out[i + 1] = out[i + 2] = 0; }
}

// ——— paint bucket ———

export const paintBucketTool: PaintTool = {
  id: "paint-bucket", group: "fill", label: "Paint Bucket", icon: "bucket", key: "G",
  options: [
    choice("fill", "Fill", "foreground", [["foreground", "Foreground"], ["pattern", "Pattern"]]),
    { key: "pattern", label: "Pattern", kind: "pattern", default: "checker", visible: (o) => o.fill === "pattern" },
    optMode(), optOpacity(),
    { key: "tolerance", label: "Tolerance", kind: "number", min: 0, max: 255, step: 1, default: 32 },
    bool("antialias", "Anti-alias", true), bool("contiguous", "Contiguous", true), bool("sampleAll", "All layers", false),
  ],
  cursor: () => "bucket",
  down(ctx, p) {
    const doc = ctx.doc, layer = doc.active, target = targetOf(ctx);
    const why = paintBlocker(doc, layer, target);
    if (why) { ctx.announce(why); return; }
    const flood = floodMask(doc, layer, p.x, p.y, { tolerance: optNum(ctx, "tolerance", 32), contiguous: optBool(ctx, "contiguous", true), sampleAll: optBool(ctx, "sampleAll", false), antialias: optBool(ctx, "antialias", true) });
    if (!flood) return;
    const usePattern = optStr(ctx, "fill", "foreground") === "pattern";
    const pat = usePattern ? patternOf(ctx) : null;
    const mode = optStr(ctx, "mode", "normal") as PaintMode, opacity = optPct(ctx, "opacity", 100);
    doc.change("Paint Bucket", () => {
      const s = new PaintSurface(doc, layer!, target);
      let m: PaintMode = mode;
      let color: RGBA = ctx.fg;
      if (m === "clear" && (s.keepAlpha || s.mask)) { m = "normal"; color = ctx.bg; }
      forChunks(flood.bounds, (c) => {
        const n = c.w * c.h, base = s.readCurrent(c, new Float32Array(n * 4)), paint = new Float32Array(n * 4), cov = new Float32Array(n);
        for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) cov[y * c.w + x] = flood.mask[(c.y + y) * doc.width + c.x + x]! / 255;
        if (pat) renderPattern(pat, 1, c, paint);
        else for (let i = 0; i < n * 4; i += 4) { paint[i] = color[0]!; paint[i + 1] = color[1]!; paint[i + 2] = color[2]!; paint[i + 3] = color[3] ?? 1; }
        const out = new Float32Array(n * 4);
        paintOver(base, paint, cov, m, opacity, c, out);
        s.commit(c, out, base);
      });
    }, "paint-bucket");
    ctx.invalidate(flood.bounds);
  },
};

function patternOf(ctx: ToolContext): Pattern | null {
  const v = ctx.options.pattern;
  if (v && typeof v === "object") return v as Pattern;
  return findPattern(typeof v === "string" ? v : "checker", ctx.shared.patterns as Pattern[] | undefined);
}

// ——— gradient ———

interface GradState { from: [number, number] | null; to: [number, number] | null; surface: PaintSurface | null; area: Rect | null }
const gstates = new WeakMap<ToolContext, GradState>();
const gstate = (ctx: ToolContext): GradState => { let s = gstates.get(ctx); if (!s) gstates.set(ctx, (s = { from: null, to: null, surface: null, area: null })); return s; };

/** The gradient the tool draws: the option's gradient (or ctx.shared.gradient), else foreground → background. */
export function gradientOf(ctx: ToolContext, from: [number, number], to: [number, number]): Gradient {
  const g = (typeof ctx.options.gradient === "object" && ctx.options.gradient) || ctx.shared.gradient;
  const type = optStr(ctx, "type", "linear") as Gradient["type"];
  const base: Gradient = g ? { ...(g as Gradient) } : { type, stops: [{ at: 0, color: ctx.fg }, { at: 1, color: ctx.bg }], from, to };
  base.type = type;
  base.from = from; base.to = to; base.relative = false;
  base.reverse = optBool(ctx, "reverse", false);
  base.dither = optBool(ctx, "dither", true);
  if (!optBool(ctx, "transparency", true)) delete base.alpha;
  return base;
}

/** Snap the end point to multiples of 45° around the start (Shift). */
export function snap45(from: [number, number], x: number, y: number): [number, number] {
  const dx = x - from[0], dy = y - from[1], len = Math.hypot(dx, dy), a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4);
  return [from[0] + Math.cos(a) * len, from[1] + Math.sin(a) * len];
}

function drawGradient(ctx: ToolContext, st: GradState): void {
  if (!st.surface || !st.from || !st.to || !st.area) return;
  const g = gradientOf(ctx, st.from, st.to), s = st.surface;
  let mode = optStr(ctx, "mode", "normal") as PaintMode;
  if (mode === "clear" && (s.keepAlpha || s.mask)) mode = "normal";
  const opacity = optPct(ctx, "opacity", 100);
  forChunks(st.area, (c) => {
    const n = c.w * c.h, base = s.readOriginal(c, new Float32Array(n * 4)), paint = new Float32Array(n * 4), out = new Float32Array(n * 4);
    renderGradient(g, c, paint);
    paintOver(base, paint, null, mode, opacity, c, out);
    s.commit(c, out, base);
  });
  ctx.invalidate(st.area);
}

export const gradientTool: PaintTool = {
  id: "gradient", group: "fill", label: "Gradient", icon: "gradient", key: "G",
  options: [
    { key: "gradient", label: "Gradient", kind: "gradient", default: null },
    choice("type", "Type", "linear", [["linear", "Linear"], ["radial", "Radial"], ["angle", "Angle"], ["reflected", "Reflected"], ["diamond", "Diamond"]]),
    optMode(), optOpacity(), bool("reverse", "Reverse", false), bool("dither", "Dither", true), bool("transparency", "Transparency", true),
  ],
  cursor: () => "crosshair",
  down(ctx, p) {
    const doc = ctx.doc, layer = doc.active, target = targetOf(ctx), st = gstate(ctx);
    const why = paintBlocker(doc, layer, target);
    if (why) { ctx.announce(why); return; }
    doc.begin("Gradient", "gradient");
    st.surface = new PaintSurface(doc, layer!, target);
    st.from = [p.x, p.y]; st.to = null;
    const sel = doc.selection?.bounds() ?? null;
    st.area = sel ?? doc.bounds;
  },
  move(ctx, p) {
    const st = gstate(ctx);
    if (!st.surface || !st.from) return;
    st.to = p.shift ? snap45(st.from, p.x, p.y) : [p.x, p.y];
    drawGradient(ctx, st);
  },
  up(ctx, p) {
    const st = gstate(ctx);
    if (!st.surface || !st.from) return;
    st.to = p.shift ? snap45(st.from, p.x, p.y) : [p.x, p.y];
    if (Math.hypot(st.to[0] - st.from[0], st.to[1] - st.from[1]) < 1) ctx.doc.cancel();
    else { drawGradient(ctx, st); ctx.doc.commit(); }
    st.surface = null; st.from = null; st.to = null; st.area = null;
  },
  cancel(ctx) { const st = gstate(ctx); if (st.surface) { ctx.doc.cancel(); st.surface = null; st.from = null; ctx.invalidate(null); } },
  pending: (ctx) => !!gstate(ctx).surface,
  overlay(ctx): OverlayShape[] {
    const st = gstate(ctx);
    return st.from && st.to ? [{ type: "line", x1: st.from[0], y1: st.from[1], x2: st.to[0], y2: st.to[1] }, { type: "handle", x: st.from[0], y: st.from[1], id: "from", shape: "circle" }, { type: "handle", x: st.to[0], y: st.to[1], id: "to", shape: "circle" }] : [];
  },
};
