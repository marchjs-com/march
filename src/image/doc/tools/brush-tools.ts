// Brush family: brush (B), pencil (no anti-aliasing, auto erase), color replacement (hue / saturation / color /
// luminosity; sampling continuous / once / background swatch; limits contiguous / discontiguous / find edges) and the
// mixer brush (a paint reservoir that loads, picks up and mixes canvas color; load / clean).

import { blendColor, type BlendMode } from "../blend.ts";
import type { RGBA } from "../layers.ts";
import type { Rect } from "../tiles.ts";
import type { DabInfo } from "../brush/engine.ts";
import {
  bool, choice, optBool, optBrush, optFlow, optHardness, optMode, optNum, optOpacity, optPct, optPressure, optSampleAll, optSize,
  optSmoothing, optStr, optSymmetry, pct, readMerged, strokeTool, type PaintTool,
} from "./paint-common.ts";
import type { ToolContext } from "./tool.ts";

export const brushTool: PaintTool = strokeTool({
  id: "brush", group: "brush", label: "Brush", icon: "brush", key: "B", step: "Brush", brush: "soft-round",
  options: [optBrush("soft-round"), optSize(60), optHardness(0), optMode(), optOpacity(), optFlow(), bool("airbrush", "Airbrush", false), ...optSmoothing(), ...optPressure(), ...optSymmetry(), { key: "angle", label: "Angle", kind: "angle", min: -180, max: 180, default: 0 }],
  setup: (ctx) => (ctx.options.angle ? { angle: optNum(ctx, "angle", 0) } : {}),
});

export const pencilTool: PaintTool = strokeTool({
  id: "pencil", group: "brush", label: "Pencil", icon: "pencil", key: "B", step: "Pencil", brush: "pencil",
  options: [optBrush("pencil"), optSize(2), optMode(), optOpacity(), bool("autoErase", "Auto erase", false), ...optSmoothing(), ...optPressure(), ...optSymmetry()],
  setup(ctx, p, st, base) {
    const extra: { aliased: true; fg?: RGBA; spacing: number } = { aliased: true, spacing: Math.min(base.preset.spacing ?? 0.15, 0.15) };
    if (optBool(ctx, "autoErase", false) && st.surface) {
      // starting on the foreground color paints the background color
      const px = st.surface.readCurrent({ x: Math.floor(p.x), y: Math.floor(p.y), w: 1, h: 1 }, new Float32Array(4));
      const fg = ctx.fg;
      if (px[3]! > 0 && Math.abs(px[0]! - fg[0]!) < 1 / 255 && Math.abs(px[1]! - fg[1]!) < 1 / 255 && Math.abs(px[2]! - fg[2]!) < 1 / 255) extra.fg = ctx.bg;
    }
    return extra;
  },
});

// ——— color matching shared by color replacement and the background eraser ———

/** Weight 0–1 of a pixel matching a color within a tolerance (0–1), with a soft band when anti-aliased. */
export function colorMatch(px: Float32Array, i: number, ref: ArrayLike<number>, tol: number, soft = true): number {
  const d = Math.max(Math.abs(px[i]! - ref[0]!), Math.abs(px[i + 1]! - ref[1]!), Math.abs(px[i + 2]! - ref[2]!));
  if (d <= tol) return 1;
  if (!soft) return 0;
  const band = 0.06;
  return d < tol + band ? 1 - (d - tol) / band : 0;
}

/**
 * The limits of a sampling tool inside one dab: "discontiguous" keeps `w`; "contiguous" keeps only pixels connected to
 * the dab center through matching pixels; "find-edges" is contiguous and also fades the weight at strong edges.
 */
export function applyLimits(limits: string, r: Rect, px: Float32Array, w: Float32Array, cx: number, cy: number): void {
  if (limits === "discontiguous") return;
  const n = r.w * r.h, seen = new Uint8Array(n), stack: number[] = [];
  const sx = Math.max(0, Math.min(r.w - 1, Math.floor(cx - r.x))), sy = Math.max(0, Math.min(r.h - 1, Math.floor(cy - r.y)));
  if (w[sy * r.w + sx]! > 0) { stack.push(sy * r.w + sx); seen[sy * r.w + sx] = 1; }
  while (stack.length) {
    const p = stack.pop()!, x = p % r.w;
    const nb = [x > 0 ? p - 1 : -1, x < r.w - 1 ? p + 1 : -1, p - r.w, p + r.w];
    for (const q of nb) if (q >= 0 && q < n && !seen[q]! && w[q]! > 0) { seen[q] = 1; stack.push(q); }
  }
  for (let p = 0; p < n; p++) if (!seen[p]!) w[p] = 0;
  if (limits === "find-edges") {
    for (let y = 1; y < r.h - 1; y++) for (let x = 1; x < r.w - 1; x++) {
      const p = y * r.w + x;
      if (!w[p]) continue;
      let g = 0;
      for (let c = 0; c < 3; c++) {
        const gx = px[(p + 1) * 4 + c]! - px[(p - 1) * 4 + c]!, gy = px[(p + r.w) * 4 + c]! - px[(p - r.w) * 4 + c]!;
        g = Math.max(g, Math.hypot(gx, gy));
      }
      w[p] = w[p]! * Math.max(0, 1 - g * 2);
    }
  }
}

/** The reference color of a sampling tool for this dab. */
export function sampledColor(ctx: ToolContext, mode: string, once: RGBA | null, r: Rect, px: Float32Array, info: DabInfo): RGBA {
  if (mode === "background") return ctx.bg;
  if (mode === "once" && once) return once;
  const x = Math.max(0, Math.min(r.w - 1, Math.floor(info.x - r.x))), y = Math.max(0, Math.min(r.h - 1, Math.floor(info.y - r.y)));
  const i = (y * r.w + x) * 4;
  return [px[i]!, px[i + 1]!, px[i + 2]!, px[i + 3]!];
}

export const colorReplacementTool: PaintTool = strokeTool({
  id: "color-replacement", group: "brush", label: "Color Replacement", icon: "color-replace", key: "B", step: "Color Replacement", brush: "hard-round",
  options: [
    optSize(30), optHardness(100),
    choice("mode", "Mode", "color", [["hue", "Hue"], ["saturation", "Saturation"], ["color", "Color"], ["luminosity", "Luminosity"]]),
    choice("sampling", "Sampling", "continuous", [["continuous", "Continuous"], ["once", "Once"], ["background", "Background swatch"]]),
    choice("limits", "Limits", "contiguous", [["contiguous", "Contiguous"], ["discontiguous", "Discontiguous"], ["find-edges", "Find edges"]]),
    pct("tolerance", "Tolerance", 30), bool("antialias", "Anti-alias", true),
  ],
  setup(ctx, p, st) {
    const tol = optPct(ctx, "tolerance", 30), limits = optStr(ctx, "limits", "contiguous"), sampling = optStr(ctx, "sampling", "continuous");
    const mode = optStr(ctx, "mode", "color") as BlendMode, aa = optBool(ctx, "antialias", true);
    const once = sampling === "once" && st.surface ? [...st.surface.readCurrent({ x: Math.floor(p.x), y: Math.floor(p.y), w: 1, h: 1 }, new Float32Array(4))] as RGBA : null;
    let w = new Float32Array(0);
    const fg = [ctx.fg[0], ctx.fg[1], ctx.fg[2]];
    return {
      mode: "normal",
      direct(r, px, a, info) {
        const n = r.w * r.h;
        if (w.length < n) w = new Float32Array(n);
        const ref = sampledColor(ctx, sampling, once, r, px, info);
        for (let i = 0; i < n; i++) w[i] = a[i]! > 0 && px[i * 4 + 3]! > 0 ? colorMatch(px, i * 4, ref, tol, aa) : 0;
        applyLimits(limits, r, px, w, info.x, info.y);
        const b = [0, 0, 0];
        for (let i = 0; i < n; i++) {
          const k = a[i]! * w[i]!;
          if (k <= 0) continue;
          const j = i * 4;
          b[0] = px[j]!; b[1] = px[j + 1]!; b[2] = px[j + 2]!;
          const c = blendColor(mode, b, fg);
          px[j] = b[0]! + (c[0]! - b[0]!) * k; px[j + 1] = b[1]! + (c[1]! - b[1]!) * k; px[j + 2] = b[2]! + (c[2]! - b[2]!) * k;
        }
      },
    };
  },
});

// ——— mixer brush ———

/** The mixer brush's reservoir (shared between strokes): its color and how much paint is left (0–1). */
export interface MixerReservoir { color: RGBA | null; amount: number }

const reservoir = (ctx: ToolContext): MixerReservoir => {
  let r = ctx.shared.mixer as MixerReservoir | undefined;
  if (!r) ctx.shared.mixer = r = { color: null, amount: 0 };
  return r;
};
/** Load the mixer brush with the foreground color. */
export function mixerLoad(ctx: ToolContext): void { const r = reservoir(ctx); r.color = [...ctx.fg] as RGBA; r.amount = 1; }
/** Clean the mixer brush (it then only moves paint around). */
export function mixerClean(ctx: ToolContext): void { const r = reservoir(ctx); r.color = null; r.amount = 0; }

export const mixerBrushTool: PaintTool = strokeTool({
  id: "mixer-brush", group: "brush", label: "Mixer Brush", icon: "mixer-brush", key: "B", step: "Mixer Brush", brush: "mixer-wet",
  options: [
    optBrush("mixer-wet"), optSize(50), optHardness(50),
    pct("wet", "Wet", 50), pct("load", "Load", 50), pct("mix", "Mix", 50), optFlow(),
    bool("loadAfter", "Load the brush after each stroke", true), bool("cleanAfter", "Clean the brush after each stroke", false),
    optSampleAll(), ...optSmoothing(),
  ],
  setup(ctx) {
    const res = reservoir(ctx);
    if (optBool(ctx, "loadAfter", true)) mixerLoad(ctx);
    const wet = optPct(ctx, "wet", 50), load = optPct(ctx, "load", 50), mix = optPct(ctx, "mix", 50), all = optBool(ctx, "sampleAll", false);
    let canvas = new Float32Array(0);
    return {
      mode: "normal",
      direct(r, px, a, info) {
        const n = r.w * r.h;
        const src = all ? readMerged(ctx.doc, r, {}, canvas.length >= n * 4 ? canvas.subarray(0, n * 4) : (canvas = new Float32Array(n * 4))) : px;
        // average canvas color under the dab
        let sr = 0, sg = 0, sb = 0, sw = 0;
        for (let i = 0; i < n; i++) { const k = a[i]! * src[i * 4 + 3]!; sr += src[i * 4]! * k; sg += src[i * 4 + 1]! * k; sb += src[i * 4 + 2]! * k; sw += k; }
        const avg: RGBA | null = sw > 0 ? [sr / sw, sg / sw, sb / sw, 1] : null;
        // the brush picks up canvas paint (mix × wet) and runs dry (load)
        if (res.color && avg) for (let c = 0; c < 3; c++) res.color[c] = res.color[c]! + (avg[c]! - res.color[c]!) * mix * wet * 0.5;
        if (res.color) res.amount = Math.max(0, res.amount - (1 - load) * 0.03);
        const paint = res.color ?? avg;
        if (!paint) return;
        const strength = res.color ? 0.25 + 0.75 * res.amount : 0.6;
        for (let i = 0; i < n; i++) {
          const k = a[i]!;
          if (k <= 0) continue;
          const j = i * 4;
          for (let c = 0; c < 3; c++) {
            // wet paint blends the brush color with the pixel under it
            const target = paint[c]! + (px[j + c]! - paint[c]!) * wet * (res.color ? 0.5 : 0.85);
            px[j + c] = px[j + c]! + (target - px[j + c]!) * k * strength;
          }
          px[j + 3] = Math.max(px[j + 3]!, Math.min(1, k * strength * (res.color ? 1 : px[j + 3]!) + px[j + 3]! * (1 - k * strength)));
        }
        void info;
      },
    };
  },
  finish(ctx) { if (optBool(ctx, "cleanAfter", false)) mixerClean(ctx); },
});
