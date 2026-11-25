// Shared pieces of the painting tools: option declarations, the stroke tool skeleton (one history step per stroke,
// Alt+click sources, [ ] brush size keys, the brush outline overlay, the airbrush tick), merged-image reads and the
// history source lookup.

import { renderRegion, type RenderOptions } from "../composite.ts";
import type { ImageDocument } from "../document.ts";
import { hasRaster, walk, type Layer, type Pattern } from "../layers.ts";
import type { State } from "../history.ts";
import type { Rect, TiledRaster } from "../tiles.ts";
import { BrushStroke, PaintSurface, paintBlocker, type PaintTarget, type StrokeSettings, type Symmetry, type SymmetryType } from "../brush/engine.ts";
import { findBrush, roundBrush, type BrushPreset } from "../brush/presets.ts";
import type { OverlayShape, PointerSample, Tool, ToolContext, ToolCursor, ToolOption } from "./tool.ts";

/** A tool with an airbrush clock: the UI calls tick(ctx, dt) every frame while the pointer is down. */
export interface PaintTool extends Tool {
  tick?: ((ctx: ToolContext, dt: number) => void) | undefined;
}

/** Hooks the app may put in ctx.shared for the retouch tools (march/image filters, content-aware fill). */
export interface PaintHooks {
  filters?: {
    /** Gaussian-like blur of straight RGBA. */
    blur?: ((px: { width: number; height: number; data: Float32Array }, radius: number) => Float32Array) | undefined;
    /** Sharpen (unsharp mask) of straight RGBA; amount 0–1. */
    sharpen?: ((px: { width: number; height: number; data: Float32Array }, amount: number) => Float32Array) | undefined;
  } | undefined;
  fill?: {
    /** Fill the masked pixels (mask 0–1) of a region; returns straight RGBA of the region or null to use the fallback. */
    contentAware?: ((req: { doc: ImageDocument; rect: Rect; pixels: Float32Array; mask: Float32Array; width: number; height: number }) => Float32Array | null) | undefined;
    /** Content-aware move / extend; returns true when it did the work (inside the open history step). */
    contentAwareMove?: ((req: { doc: ImageDocument; layer: Layer; dx: number; dy: number; mode: "move" | "extend"; adaptation: number }) => boolean) | undefined;
  } | undefined;
}

// ——— options ———

export const pct = (key: string, label: string, def: number, extra: Partial<ToolOption> = {}): ToolOption => ({ key, label, kind: "percent", min: 0, max: 100, step: 1, unit: "%", default: def, ...extra });
export const choice = (key: string, label: string, def: string, values: [string, string][], extra: Partial<ToolOption> = {}): ToolOption =>
  ({ key, label, kind: "choice", default: def, options: values.map(([value, l]) => ({ value, label: l })), ...extra });
export const bool = (key: string, label: string, def: boolean, extra: Partial<ToolOption> = {}): ToolOption => ({ key, label, kind: "boolean", default: def, ...extra });

export const optBrush = (def: string): ToolOption => ({ key: "brush", label: "Brush", kind: "brush", default: def });
export const optSize = (def: number): ToolOption => ({ key: "size", label: "Size", kind: "number", min: 1, max: 5000, step: 1, unit: "px", default: def });
export const optHardness = (def: number): ToolOption => pct("hardness", "Hardness", def);
export const optOpacity = (def = 100): ToolOption => pct("opacity", "Opacity", def);
export const optFlow = (def = 100): ToolOption => pct("flow", "Flow", def);
export const optMode = (def = "normal", extra: [string, string][] = [["behind", "Behind"], ["clear", "Clear"]]): ToolOption =>
  ({ key: "mode", label: "Mode", kind: "blend", default: def, options: extra.map(([value, label]) => ({ value, label })) });
export const optSmoothing = (): ToolOption[] => [
  pct("smoothing", "Smoothing", 10),
  choice("smoothingMode", "Smoothing mode", "rope", [["rope", "Pulled string"], ["average", "Average"]]),
  bool("catchUp", "Catch up at stroke end", true),
];
export const optSymmetry = (): ToolOption[] => [
  choice("symmetry", "Symmetry", "off", [["off", "Off"], ["vertical", "Vertical"], ["horizontal", "Horizontal"], ["both", "Dual axis"], ["diagonal", "Diagonal"], ["radial", "Radial"], ["mandala", "Mandala"]]),
  { key: "segments", label: "Segments", kind: "number", min: 2, max: 12, step: 1, default: 6, visible: (o) => o.symmetry === "radial" || o.symmetry === "mandala" },
];
export const optPressure = (): ToolOption[] => [bool("pressureSize", "Pressure controls size", false), bool("pressureOpacity", "Pressure controls opacity", false)];
export const optSampleAll = (label = "Sample all layers"): ToolOption => bool("sampleAll", label, false);

const num = (v: unknown, d: number): number => (typeof v === "number" && Number.isFinite(v) ? v : d);
export const optNum = (ctx: ToolContext, key: string, d: number): number => num(ctx.options[key], d);
export const optPct = (ctx: ToolContext, key: string, d: number): number => num(ctx.options[key], d) / 100;
export const optStr = (ctx: ToolContext, key: string, d: string): string => (typeof ctx.options[key] === "string" ? ctx.options[key] as string : d);
export const optBool = (ctx: ToolContext, key: string, d: boolean): boolean => (typeof ctx.options[key] === "boolean" ? ctx.options[key] as boolean : d);

/** The preset the options pick (library id), or a round brush; user / imported presets live in ctx.shared.brushPresets. */
export function presetOf(ctx: ToolContext, fallback: string): BrushPreset {
  const libs = ctx.shared.brushPresets as BrushPreset[] | undefined;
  const p = typeof ctx.options.brush === "object" && ctx.options.brush ? ctx.options.brush as BrushPreset : findBrush(typeof ctx.options.brush === "string" ? ctx.options.brush : fallback, libs);
  return p ?? findBrush(fallback) ?? roundBrush(30, 1);
}

/** The paint target: the layer, or its mask when the UI has the mask thumbnail active. */
export const targetOf = (ctx: ToolContext): PaintTarget => (ctx.shared.target === "mask" ? "mask" : "layer");

/** The symmetry the options ask for (center: ctx.shared.symmetryCenter or the canvas center). */
export function symmetryOf(ctx: ToolContext): Symmetry | null {
  const type = optStr(ctx, "symmetry", "off");
  if (type === "off") return null;
  const c = ctx.shared.symmetryCenter as [number, number] | undefined;
  return { type: type as SymmetryType, cx: c?.[0] ?? ctx.doc.width / 2, cy: c?.[1] ?? ctx.doc.height / 2, segments: optNum(ctx, "segments", 6), angle: num(ctx.shared.symmetryAngle, 0) };
}

/** Stroke settings from the usual options. */
export function baseSettings(ctx: ToolContext, preset: BrushPreset): StrokeSettings {
  const o = ctx.options;
  const hardness = o.hardness != null ? optPct(ctx, "hardness", 100) : undefined;
  return {
    preset,
    size: o.size != null ? optNum(ctx, "size", preset.size) : undefined,
    hardness: preset.tip.type === "round" ? hardness : undefined,
    opacity: optPct(ctx, "opacity", 100),
    flow: optPct(ctx, "flow", 100),
    mode: optStr(ctx, "mode", "normal") as StrokeSettings["mode"],
    fg: ctx.fg, bg: ctx.bg,
    smoothing: o.smoothing != null ? optPct(ctx, "smoothing", 0) : undefined,
    smoothingMode: optStr(ctx, "smoothingMode", "rope") === "average" ? "average" : "rope",
    catchUp: optBool(ctx, "catchUp", true),
    symmetry: symmetryOf(ctx),
    airbrush: o.airbrush != null ? optBool(ctx, "airbrush", false) || !!preset.airbrush : undefined,
    pressureSize: optBool(ctx, "pressureSize", false),
    pressureOpacity: optBool(ctx, "pressureOpacity", false),
    zoom: ctx.zoom,
    patterns: ctx.shared.patterns as Pattern[] | undefined,
    seed: typeof ctx.shared.seed === "number" ? ctx.shared.seed : undefined,
    invalidate: (r) => ctx.invalidate(r),
  };
}

// ——— the stroke tool skeleton ———

export interface StrokeState {
  stroke: BrushStroke | null;
  surface: PaintSurface | null;
  hover: { x: number; y: number } | null;
  points: [number, number][];
  /** Tool-specific data for the current stroke. */
  data: Record<string, unknown>;
}

const states = new WeakMap<ToolContext, Map<string, StrokeState>>();
export function stateOf(ctx: ToolContext, id: string): StrokeState {
  let m = states.get(ctx);
  if (!m) states.set(ctx, (m = new Map()));
  let s = m.get(id);
  if (!s) m.set(id, (s = { stroke: null, surface: null, hover: null, points: [], data: {} }));
  return s;
}

export interface StrokeToolDef {
  id: string;
  group: string;
  label: string;
  icon: string;
  key?: string | undefined;
  options: ToolOption[];
  /** History step label. */
  step: string;
  /** Default preset id. */
  brush: string;
  cursor?: ToolCursor | undefined;
  /** Alt+click (set a source); return true when handled. */
  alt?: ((ctx: ToolContext, p: PointerSample) => boolean) | undefined;
  /** Runs inside the history step before the surface is made (e.g. turn the background into a layer). */
  prepare?: ((ctx: ToolContext, p: PointerSample, layer: Layer) => void) | undefined;
  /** Stroke settings on top of the base ones, or a message to refuse the stroke. */
  setup?: ((ctx: ToolContext, p: PointerSample, st: StrokeState, base: StrokeSettings) => Partial<StrokeSettings> | string) | undefined;
  /** After the last dab, before the step is committed. */
  finish?: ((ctx: ToolContext, st: StrokeState, p: PointerSample) => void) | undefined;
  overlay?: ((ctx: ToolContext, st: StrokeState) => OverlayShape[]) | undefined;
  /** The mask can be the target (default true). */
  mask?: boolean | undefined;
}

/** A tool that paints strokes through the brush engine; the whole stroke is one history step. */
export function strokeTool(def: StrokeToolDef): PaintTool {
  const tool: PaintTool = {
    id: def.id, group: def.group, label: def.label, icon: def.icon, key: def.key, options: def.options,
    cursor: () => def.cursor ?? "brush",
    down(ctx, p) {
      const st = stateOf(ctx, def.id);
      if (p.alt && def.alt?.(ctx, p)) return;
      const doc = ctx.doc, layer = doc.active, target = def.mask === false ? "layer" : targetOf(ctx);
      const why = paintBlocker(doc, layer, target);
      if (why) { ctx.announce(why); return; }
      doc.begin(def.step, def.id);
      try {
        def.prepare?.(ctx, p, layer!);
        const surface = new PaintSurface(doc, layer!, target);
        const base = baseSettings(ctx, presetOf(ctx, def.brush));
        st.points = [[p.x, p.y]];
        st.data = {};
        st.surface = surface;
        const extra = def.setup ? def.setup(ctx, p, st, base) : {};
        if (typeof extra === "string") { doc.cancel(); st.surface = null; ctx.announce(extra); return; }
        st.stroke = new BrushStroke(surface, { ...base, ...extra });
        st.stroke.begin(p);
      } catch (e) { doc.cancel(); st.stroke = null; throw e; }
    },
    move(ctx, p) {
      const st = stateOf(ctx, def.id);
      st.hover = { x: p.x, y: p.y };
      if (!st.stroke) return;
      st.points.push([p.x, p.y]);
      st.stroke.move(p);
    },
    up(ctx, p) {
      const st = stateOf(ctx, def.id);
      if (!st.stroke) return;
      try {
        st.stroke.end(p);
        def.finish?.(ctx, st, p);
        ctx.doc.commit();
      } catch (e) { ctx.doc.cancel(); throw e; }
      finally { st.stroke = null; st.surface = null; }
    },
    cancel(ctx) {
      const st = stateOf(ctx, def.id);
      if (st.stroke) { ctx.doc.cancel(); st.stroke = null; st.surface = null; ctx.invalidate(null); }
    },
    hover(ctx, p) { stateOf(ctx, def.id).hover = { x: p.x, y: p.y }; },
    tick(ctx, dt) { stateOf(ctx, def.id).stroke?.tick(dt); },
    key_(ctx, e) {
      if (e.type !== "down" || (e.key !== "[" && e.key !== "]")) return false;
      const up = e.key === "]";
      if (e.shift) {
        const h = optNum(ctx, "hardness", 100);
        ctx.setOption("hardness", Math.max(0, Math.min(100, h + (up ? 25 : -25))));
      } else {
        const s = optNum(ctx, "size", presetOf(ctx, def.brush).size);
        const step = s < 10 ? 1 : s < 100 ? 5 : s < 200 ? 10 : 25;
        ctx.setOption("size", Math.max(1, Math.min(5000, s + (up ? step : -step))));
      }
      return true;
    },
    overlay(ctx) {
      const st = stateOf(ctx, def.id), out: OverlayShape[] = [];
      if (st.hover) {
        const preset = presetOf(ctx, def.brush);
        out.push({ type: "brush", x: st.hover.x, y: st.hover.y, size: optNum(ctx, "size", preset.size), hardness: optPct(ctx, "hardness", preset.tip.type === "round" ? preset.tip.hardness * 100 : 100), angle: preset.angle, roundness: preset.roundness });
      }
      const sym = symmetryOf(ctx);
      if (sym) out.push({ type: "crosshair", x: sym.cx, y: sym.cy });
      if (def.overlay) out.push(...def.overlay(ctx, st));
      return out;
    },
  };
  return tool;
}

// ——— pixels from elsewhere ———

/** The merged image over a region as straight RGBA (sample all layers). */
export function readMerged(doc: ImageDocument, r: Rect, opts: RenderOptions = {}, out?: Float32Array): Float32Array {
  const f = renderRegion(doc, r, opts, (out ?? new Float32Array(r.w * r.h * 4)) as Float32Array<ArrayBuffer>);
  for (let i = 0; i < f.length; i += 4) { const a = f[i + 3]!; if (a > 0) { const k = 1 / a; f[i]! *= k; f[i + 1]! *= k; f[i + 2]! *= k; } }
  return f;
}

/** Ids of the layers above `id` in the stack (for "current & below" sampling). */
export function layersAbove(doc: ImageDocument, id: string): Set<string> {
  const order = doc.all(), i = order.findIndex((l) => l.id === id), out = new Set<string>();
  if (i < 0) return out;
  const ancestors = new Set<string>();
  let loc = doc.locate(id);
  while (loc?.parent) { ancestors.add(loc.parent.id); loc = doc.locate(loc.parent.id); }
  for (let k = i + 1; k < order.length; k++) if (!ancestors.has(order[k]!.id)) out.add(order[k]!.id);
  return out;
}

/** The layer's raster in the history brush source state (null when the layer did not exist then). */
export function historySource(doc: ImageDocument, layerId: string): TiledRaster | null {
  return doc.history.sourceRaster((state: State) => {
    for (const [l] of walk((state.layers ?? []) as Layer[])) if (l.id === layerId && hasRaster(l)) return l.raster;
    return null;
  });
}

/** Straight RGBA reader for a source used across a stroke (snapshot: later writes are not seen). */
export type PixelSource = (r: Rect, out: Float32Array) => Float32Array;

/** The pixels a clone-like tool samples: current layer, current and below, or all layers, frozen at stroke start. */
export function sampleSource(doc: ImageDocument, layer: Layer, sample: "current" | "below" | "all"): PixelSource {
  const snap = hasRaster(layer) ? layer.raster.clone() : null;
  if (sample === "current") return (r, out) => (snap ? snap.read(r.x, r.y, r.w, r.h, out) : out.fill(0));
  const override = new Map<string, (r: Rect) => Float32Array>();
  if (snap) override.set(layer.id, (r) => snap.read(r.x, r.y, r.w, r.h));
  const exclude = sample === "below" ? layersAbove(doc, layer.id) : undefined;
  return (r, out) => readMerged(doc, r, { override, exclude }, out);
}
