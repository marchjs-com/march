// Eraser family: eraser (brush / pencil / block; erase to history with the option or Alt), background eraser
// (sampling continuous / once / background swatch; limits contiguous / discontiguous / find edges; tolerance; protect
// foreground) and magic eraser (tolerance, contiguous, anti-alias, all layers, opacity). Erasing on the background
// layer paints the background color (eraser) or first turns it into a normal layer (background / magic eraser).

import type { RGBA } from "../layers.ts";
import { PaintSurface, paintBlocker } from "../brush/engine.ts";
import { findBrush, roundBrush } from "../brush/presets.ts";
import { applyLimits, colorMatch, sampledColor } from "./brush-tools.ts";
import { floodMask, forChunks } from "./fill.ts";
import {
  bool, choice, historySource, optBool, optBrush, optFlow, optHardness, optNum, optOpacity, optPct, optSize, optSmoothing, optStr,
  pct, strokeTool, type PaintTool,
} from "./paint-common.ts";

export const eraserTool: PaintTool = strokeTool({
  id: "eraser", group: "eraser", label: "Eraser", icon: "eraser", key: "E", step: "Eraser", brush: "eraser-soft",
  options: [
    choice("eraserMode", "Mode", "brush", [["brush", "Brush"], ["pencil", "Pencil"], ["block", "Block"]]),
    optBrush("eraser-soft"), optSize(60), optHardness(0), optOpacity(), optFlow(), bool("toHistory", "Erase to history", false), ...optSmoothing(),
  ],
  setup(ctx, p, st, base) {
    const how = optStr(ctx, "eraserMode", "brush");
    const extra: Record<string, unknown> = { mode: "clear" };
    if (how === "pencil") { extra.aliased = true; extra.hardness = 1; }
    if (how === "block") {
      // a fixed 16 screen-pixel square, hard, full strength
      extra.preset = { ...(findBrush("square") ?? roundBrush(16, 1)), spacing: 0.25 };
      extra.size = 16 / (ctx.zoom || 1);
      extra.aliased = true; extra.opacity = 1; extra.flow = 1;
    }
    if ((optBool(ctx, "toHistory", false) || p.alt) && st.surface?.raster) {
      const src = historySource(ctx.doc, st.surface.layer.id);
      if (!src) return "The history state does not contain this layer";
      extra.mode = "normal";
      extra.source = (r: { x: number; y: number; w: number; h: number }, out: Float32Array) => { src.read(r.x, r.y, r.w, r.h, out); };
    }
    void base;
    return extra;
  },
});

export const backgroundEraserTool: PaintTool = strokeTool({
  id: "background-eraser", group: "eraser", label: "Background Eraser", icon: "eraser-background", key: "E", step: "Background Eraser", brush: "hard-round",
  options: [
    optSize(60), optHardness(100),
    choice("sampling", "Sampling", "continuous", [["continuous", "Continuous"], ["once", "Once"], ["background", "Background swatch"]]),
    choice("limits", "Limits", "contiguous", [["contiguous", "Contiguous"], ["discontiguous", "Discontiguous"], ["find-edges", "Find edges"]]),
    pct("tolerance", "Tolerance", 50), bool("protectForeground", "Protect foreground color", false),
  ],
  mask: false,
  prepare(ctx, _p, layer) { if (ctx.doc.isBackground(layer)) ctx.doc.unlockBackground(); },
  setup(ctx, p, st) {
    if (st.surface?.keepAlpha) return "Transparency is locked on this layer";
    const tol = optPct(ctx, "tolerance", 50), limits = optStr(ctx, "limits", "contiguous"), sampling = optStr(ctx, "sampling", "continuous");
    const protect = optBool(ctx, "protectForeground", false), fg = ctx.fg;
    const once = sampling === "once" && st.surface ? [...st.surface.readCurrent({ x: Math.floor(p.x), y: Math.floor(p.y), w: 1, h: 1 }, new Float32Array(4))] as RGBA : null;
    let w = new Float32Array(0);
    return {
      mode: "normal",
      direct(r, px, a, info) {
        const n = r.w * r.h;
        if (w.length < n) w = new Float32Array(n);
        const ref = sampledColor(ctx, sampling, once, r, px, info);
        for (let i = 0; i < n; i++) {
          if (a[i]! <= 0 || px[i * 4 + 3]! <= 0) { w[i] = 0; continue; }
          w[i] = colorMatch(px, i * 4, ref, tol);
          if (protect && w[i]! > 0 && colorMatch(px, i * 4, fg, tol, false) > 0) w[i] = 0;
        }
        applyLimits(limits, r, px, w, info.x, info.y);
        for (let i = 0; i < n; i++) { const k = a[i]! * w[i]!; if (k > 0) px[i * 4 + 3] = px[i * 4 + 3]! * (1 - k); }
      },
    };
  },
});

export const magicEraserTool: PaintTool = {
  id: "magic-eraser", group: "eraser", label: "Magic Eraser", icon: "eraser-magic", key: "E",
  options: [
    { key: "tolerance", label: "Tolerance", kind: "number", min: 0, max: 255, step: 1, default: 32 },
    bool("antialias", "Anti-alias", true), bool("contiguous", "Contiguous", true), bool("sampleAll", "Sample all layers", false), optOpacity(),
  ],
  cursor: () => "wand",
  down(ctx, p) {
    const doc = ctx.doc, layer = doc.active;
    const why = paintBlocker(doc, layer, "layer");
    if (why) { ctx.announce(why); return; }
    if (layer!.locks.transparency) { ctx.announce("Transparency is locked on this layer"); return; }
    const flood = floodMask(doc, layer, p.x, p.y, { tolerance: optNum(ctx, "tolerance", 32), contiguous: optBool(ctx, "contiguous", true), sampleAll: optBool(ctx, "sampleAll", false), antialias: optBool(ctx, "antialias", true) });
    if (!flood) return;
    const op = optPct(ctx, "opacity", 100);
    doc.change("Magic Eraser", () => {
      if (doc.isBackground(layer!)) doc.unlockBackground();
      const s = new PaintSurface(doc, layer!, "layer");
      forChunks(flood.bounds, (c) => {
        const n = c.w * c.h, base = s.readCurrent(c, new Float32Array(n * 4)), out = base.slice();
        for (let y = 0; y < c.h; y++) for (let x = 0; x < c.w; x++) {
          const k = (flood.mask[(c.y + y) * doc.width + c.x + x]! / 255) * op;
          if (k > 0) out[(y * c.w + x) * 4 + 3] = base[(y * c.w + x) * 4 + 3]! * (1 - k);
        }
        s.commit(c, out, base);
      });
    }, "magic-eraser");
    ctx.invalidate(flood.bounds);
  },
};
