// Stamps: clone stamp (Alt+click sets the source; aligned keeps the offset between strokes; samples the current layer,
// the current and below, or all layers, frozen at the stroke start; the overlay shows the source under the brush) and
// pattern stamp (a pattern painted through the brush, aligned to the canvas or to each stroke).

import type { Pattern } from "../layers.ts";
import { renderPattern } from "../paint.ts";
import { findPattern } from "../brush/engine.ts";
import {
  bool, choice, optBool, optBrush, optFlow, optHardness, optMode, optNum, optOpacity, optPct, optSize, optSmoothing, optStr, pct,
  sampleSource, stateOf, strokeTool, type PaintTool, type PixelSource,
} from "./paint-common.ts";
import type { OverlayShape, PointerSample, ToolContext } from "./tool.ts";

/** A clone / heal source point: set with Alt+click, kept in ctx.shared under the tool's key. */
export interface SourcePoint { x: number; y: number; layerId: string | null; offset: [number, number] | null }

/** Alt+click: remember the source point (and forget the aligned offset). */
export function setSource(ctx: ToolContext, key: string, p: PointerSample): boolean {
  ctx.shared[key] = { x: p.x, y: p.y, layerId: ctx.doc.activeId, offset: null } satisfies SourcePoint;
  ctx.announce("Source set");
  return true;
}

/** The offset (source − destination) for a stroke starting at p: aligned keeps the first stroke's offset. */
export function sourceOffset(ctx: ToolContext, key: string, p: PointerSample, aligned: boolean): [number, number] | null {
  const s = ctx.shared[key] as SourcePoint | undefined;
  if (!s) return null;
  if (aligned && s.offset) return s.offset;
  const off: [number, number] = [Math.round(s.x - p.x), Math.round(s.y - p.y)];
  s.offset = off;
  return off;
}

/** Overlay for a source tool: the crosshair on the source and a ghost of the source pixels under the brush. */
export function sourceOverlay(ctx: ToolContext, key: string, toolId: string, read: PixelSource | null): OverlayShape[] {
  const s = ctx.shared[key] as SourcePoint | undefined, st = stateOf(ctx, toolId), h = st.hover;
  if (!s || !h) return [];
  const off = (st.data.offset as [number, number] | undefined) ?? (s.offset && optBool(ctx, "aligned", true) ? s.offset : [Math.round(s.x - h.x), Math.round(s.y - h.y)]);
  const out: OverlayShape[] = [{ type: "crosshair", x: h.x + off[0]!, y: h.y + off[1]! }];
  if (optBool(ctx, "showOverlay", true) && ctx.doc.active) {
    const size = Math.max(4, Math.min(512, Math.round(optNum(ctx, "size", 40))));
    const rect = { x: Math.round(h.x - size / 2), y: Math.round(h.y - size / 2), w: size, h: size };
    const reader = read ?? sampleSource(ctx.doc, ctx.doc.active, optStr(ctx, "sample", "current") as "current" | "below" | "all");
    const pixels = reader({ x: rect.x + off[0]!, y: rect.y + off[1]!, w: size, h: size }, new Float32Array(size * size * 4));
    out.push({ type: "image", rect, pixels, width: size, height: size, opacity: optPct(ctx, "overlayOpacity", 50) });
  }
  return out;
}

const sampleOpt = choice("sample", "Sample", "current", [["current", "Current layer"], ["below", "Current & below"], ["all", "All layers"]]);

export const cloneStampTool: PaintTool = strokeTool({
  id: "clone-stamp", group: "stamp", label: "Clone Stamp", icon: "stamp", key: "S", step: "Clone Stamp", brush: "soft-round", cursor: "stamp",
  options: [
    optBrush("soft-round"), optSize(60), optHardness(0), optMode(), optOpacity(), optFlow(), bool("aligned", "Aligned", true), sampleOpt,
    bool("showOverlay", "Show overlay", true), pct("overlayOpacity", "Overlay opacity", 50), ...optSmoothing(),
  ],
  alt: (ctx, p) => setSource(ctx, "cloneSource", p),
  setup(ctx, p, st) {
    const off = sourceOffset(ctx, "cloneSource", p, optBool(ctx, "aligned", true));
    if (!off) return "Alt-click to set a source point first";
    const read = sampleSource(ctx.doc, st.surface!.layer, optStr(ctx, "sample", "current") as "current" | "below" | "all");
    st.data.offset = off;
    st.data.read = read;
    return { source: (r, out) => { read({ x: r.x + off[0], y: r.y + off[1], w: r.w, h: r.h }, out); } };
  },
  overlay: (ctx, st) => sourceOverlay(ctx, "cloneSource", "clone-stamp", (st.data.read as PixelSource | undefined) ?? null),
});

function patternOf(ctx: ToolContext): Pattern | null {
  const v = ctx.options.pattern;
  if (v && typeof v === "object") return v as Pattern;
  return findPattern(typeof v === "string" ? v : "checker", ctx.shared.patterns as Pattern[] | undefined);
}

export const patternStampTool: PaintTool = strokeTool({
  id: "pattern-stamp", group: "stamp", label: "Pattern Stamp", icon: "stamp-pattern", key: "S", step: "Pattern Stamp", brush: "soft-round", cursor: "stamp",
  options: [
    optBrush("soft-round"), optSize(60), optHardness(0), optMode(), optOpacity(), optFlow(),
    { key: "pattern", label: "Pattern", kind: "pattern", default: "checker" }, bool("aligned", "Aligned", true),
    { key: "scale", label: "Scale", kind: "percent", min: 1, max: 1000, step: 1, unit: "%", default: 100 }, ...optSmoothing(),
  ],
  setup(ctx, p) {
    const pat = patternOf(ctx);
    if (!pat) return "Choose a pattern";
    const scale = optPct(ctx, "scale", 100) || 1, offset: [number, number] = optBool(ctx, "aligned", true) ? [0, 0] : [Math.round(p.x), Math.round(p.y)];
    return { source: (r, out) => renderPattern(pat, scale, r, out, 0, offset) };
  },
});
