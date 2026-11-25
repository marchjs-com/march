// History brushes: the history brush paints pixels back from the history source (a snapshot or a step, set in the
// History panel: doc.history.brushSource) and the art history brush paints stylized short strokes whose colors come
// from that source (tight / loose, short / medium / long, dab, curl), only where the image differs from it by more
// than the tolerance.

import type { RGBA } from "../layers.ts";
import type { TiledRaster } from "../tiles.ts";
import { rng } from "../brush/tips.ts";
import { choice, historySource, stateOf, optBrush, optFlow, optHardness, optMode, optNum, optOpacity, optPct, optSize, optSmoothing, optStr, pct, strokeTool, type PaintTool, type StrokeState } from "./paint-common.ts";
import type { ToolContext } from "./tool.ts";

export const historyBrushTool: PaintTool = strokeTool({
  id: "history-brush", group: "history-brush", label: "History Brush", icon: "history-brush", key: "Y", step: "History Brush", brush: "soft-round",
  options: [optBrush("soft-round"), optSize(60), optHardness(0), optMode(), optOpacity(), optFlow(), ...optSmoothing()],
  mask: false,
  setup(ctx, _p, st) {
    const src = historySource(ctx.doc, st.surface!.layer.id);
    if (!src) return "The history state does not contain this layer";
    return { source: (r, out) => { src.read(r.x, r.y, r.w, r.h, out); } };
  },
});

export type ArtHistoryStyle = "tight-short" | "tight-medium" | "tight-long" | "loose-medium" | "loose-long" | "dab" | "tight-curl" | "tight-curl-long" | "loose-curl" | "loose-curl-long";

const STYLES: Record<ArtHistoryStyle, { len: number; loose: boolean; curl: number }> = {
  "tight-short": { len: 3, loose: false, curl: 0 }, "tight-medium": { len: 7, loose: false, curl: 0 }, "tight-long": { len: 14, loose: false, curl: 0 },
  "loose-medium": { len: 7, loose: true, curl: 0 }, "loose-long": { len: 14, loose: true, curl: 0 }, dab: { len: 1, loose: true, curl: 0 },
  "tight-curl": { len: 6, loose: false, curl: 0.35 }, "tight-curl-long": { len: 14, loose: false, curl: 0.25 },
  "loose-curl": { len: 6, loose: true, curl: 0.45 }, "loose-curl-long": { len: 14, loose: true, curl: 0.3 },
};

/** Paint a burst of art-history strokes around (x, y). */
function burst(ctx: ToolContext, st: StrokeState, x: number, y: number): void {
  const stroke = st.stroke, src = st.data.src as TiledRaster, rand = st.data.rand as () => number;
  if (!stroke || !src) return;
  const style = STYLES[optStr(ctx, "style", "tight-short") as ArtHistoryStyle] ?? STYLES["tight-short"];
  const area = optNum(ctx, "area", 50), size = Math.max(1, optNum(ctx, "size", 6)), tol = optPct(ctx, "tolerance", 0);
  const fidelity = optPct(ctx, "fidelity", 100);
  const count = Math.max(1, Math.round((area * area) / (size * size * 6)));
  const live = st.surface!;
  const px = new Float32Array(4), cur = new Float32Array(4);
  for (let k = 0; k < Math.min(count, 64); k++) {
    const a = rand() * Math.PI * 2, d = Math.sqrt(rand()) * area / 2;
    let sx = x + Math.cos(a) * d, sy = y + Math.sin(a) * d;
    const ix = Math.floor(sx), iy = Math.floor(sy);
    if (ix < 0 || iy < 0 || ix >= ctx.doc.width || iy >= ctx.doc.height) continue;
    src.read(ix, iy, 1, 1, px);
    if (px[3]! <= 0) continue;
    if (tol > 0) {
      live.readCurrent({ x: ix, y: iy, w: 1, h: 1 }, cur);
      if (Math.max(Math.abs(cur[0]! - px[0]!), Math.abs(cur[1]! - px[1]!), Math.abs(cur[2]! - px[2]!)) < tol) continue;
    }
    // fidelity < 100 % lets the color drift
    const drift = (1 - fidelity) * 0.4;
    const color: RGBA = [px[0]! + (rand() - 0.5) * drift, px[1]! + (rand() - 0.5) * drift, px[2]! + (rand() - 0.5) * drift, 1];
    // direction: along the source's edges (perpendicular to its gradient), or random when loose
    let dir = rand() * Math.PI * 2;
    if (!style.loose) {
      const g = new Float32Array(9 * 4);
      src.read(ix - 1, iy - 1, 3, 3, g);
      const L = (i: number): number => 0.3 * g[i * 4]! + 0.59 * g[i * 4 + 1]! + 0.11 * g[i * 4 + 2]!;
      const gx = L(5) - L(3), gy = L(7) - L(1);
      if (Math.abs(gx) + Math.abs(gy) > 1e-4) dir = Math.atan2(gy, gx) + Math.PI / 2;
    }
    const steps = Math.max(1, Math.round(style.len * (0.6 + rand() * 0.8)));
    const curl = style.curl * (rand() < 0.5 ? -1 : 1);
    for (let s = 0; s < steps; s++) {
      stroke.stamp(sx, sy, { size, color, alpha: 1 });
      sx += Math.cos(dir) * size * 0.5; sy += Math.sin(dir) * size * 0.5;
      dir += curl;
    }
  }
  stroke.flush();
}

export const artHistoryBrushTool: PaintTool = strokeTool({
  id: "art-history-brush", group: "history-brush", label: "Art History Brush", icon: "art-history-brush", key: "Y", step: "Art History Brush", brush: "hard-round",
  options: [
    optSize(6), optHardness(80), optMode(), optOpacity(),
    choice("style", "Style", "tight-short", [["tight-short", "Tight Short"], ["tight-medium", "Tight Medium"], ["tight-long", "Tight Long"], ["loose-medium", "Loose Medium"], ["loose-long", "Loose Long"], ["dab", "Dab"], ["tight-curl", "Tight Curl"], ["tight-curl-long", "Tight Curl Long"], ["loose-curl", "Loose Curl"], ["loose-curl-long", "Loose Curl Long"]]),
    { key: "area", label: "Area", kind: "number", min: 1, max: 500, step: 1, unit: "px", default: 50 },
    pct("tolerance", "Tolerance", 0), pct("fidelity", "Fidelity", 100),
  ],
  mask: false,
  setup(ctx, _p, st) {
    const src = historySource(ctx.doc, st.surface!.layer.id);
    if (!src) return "The history state does not contain this layer";
    st.data.src = src;
    st.data.rand = rng(typeof ctx.shared.seed === "number" ? ctx.shared.seed : (Math.random() * 1e9) | 0);
    // the engine places no dabs of its own: the strokes come from burst()
    return { manual: true, smoothing: 0 };
  },
});

// bursts on down / move / airbrush tick
const baseDown = artHistoryBrushTool.down!, baseMove = artHistoryBrushTool.move!, baseTick = artHistoryBrushTool.tick!;
artHistoryBrushTool.down = (ctx, p) => { baseDown(ctx, p); const st = (artHistoryState(ctx)); if (st.stroke) burst(ctx, st, p.x, p.y); };
artHistoryBrushTool.move = (ctx, p) => { baseMove(ctx, p); const st = artHistoryState(ctx); if (st.stroke) burst(ctx, st, p.x, p.y); };
artHistoryBrushTool.tick = (ctx, dt) => {
  baseTick(ctx, dt);
  const st = artHistoryState(ctx), h = st.hover;
  if (st.stroke && h) { st.data.acc = ((st.data.acc as number) ?? 0) + dt; while ((st.data.acc as number) >= 50) { st.data.acc = (st.data.acc as number) - 50; burst(ctx, st, h.x, h.y); } }
};

const artHistoryState = (ctx: ToolContext): StrokeState => stateOf(ctx, "art-history-brush");
