// Layer styles (effects): types and the passes the compositor draws. Rendering lives in styles-render.ts (loaded with
// the compositor); this file is types only so the model stays light.

import type { BlendMode } from "./blend.ts";
import type { Gradient, Pattern, RGBA } from "./layers.ts";

/** A contour: a 0–1 → 0–1 curve as points (linear when empty). */
export type Contour = [number, number][];

export interface ShadowFx { enabled: boolean; blend: BlendMode; color: RGBA; opacity: number; angle: number; distance: number; spread: number; size: number; contour?: Contour | undefined; noise?: number | undefined; knockout?: boolean | undefined; globalLight?: boolean }
export interface GlowFx { enabled: boolean; blend: BlendMode; color: RGBA | null; gradient?: Gradient | undefined; opacity: number; spread: number; size: number; technique: "softer" | "precise"; source?: "edge" | "center" | undefined; range?: number | undefined; jitter?: number | undefined; contour?: Contour | undefined; noise?: number }
export interface BevelFx { enabled: boolean; style: "inner" | "outer" | "emboss" | "pillow" | "stroke"; technique: "smooth" | "chisel-hard" | "chisel-soft"; depth: number; direction: "up" | "down"; size: number; soften: number; angle: number; altitude: number; globalLight?: boolean | undefined; highlight: { blend: BlendMode; color: RGBA; opacity: number }; shadow: { blend: BlendMode; color: RGBA; opacity: number }; contour?: Contour | undefined; texture?: { pattern: Pattern; scale: number; depth: number } }
export interface StrokeFx { enabled: boolean; size: number; position: "outside" | "inside" | "center"; blend: BlendMode; opacity: number; fill: { type: "color"; color: RGBA } | { type: "gradient"; gradient: Gradient } | { type: "pattern"; pattern: Pattern; scale: number } }
export interface OverlayFx<T> { enabled: boolean; blend: BlendMode; opacity: number; value: T }
export interface SatinFx { enabled: boolean; blend: BlendMode; color: RGBA; opacity: number; angle: number; distance: number; size: number; invert: boolean; contour?: Contour }

export interface LayerStyle {
  /** All effects on / off (the eye beside "Effects"). */
  enabled: boolean;
  dropShadow?: ShadowFx[] | undefined;
  innerShadow?: ShadowFx[] | undefined;
  outerGlow?: GlowFx | undefined;
  innerGlow?: GlowFx | undefined;
  bevel?: BevelFx | undefined;
  satin?: SatinFx | undefined;
  colorOverlay?: OverlayFx<RGBA>[] | undefined;
  gradientOverlay?: OverlayFx<Gradient>[] | undefined;
  patternOverlay?: OverlayFx<{ pattern: Pattern; scale: number }>;
  stroke?: StrokeFx[] | undefined;
  /** Effects scale with the layer (Layer › Layer Style › Scale Effects). */
  scale?: number | undefined;
}

/** Global light (shared angle / altitude of effects that use it). */
export interface GlobalLight { angle: number; altitude: number }

/** Effects that are on, in drawing order. */
export function activeEffects(s: LayerStyle | undefined): string[] {
  if (!s || !s.enabled) return [];
  const on: string[] = [];
  if (s.dropShadow?.some((f) => f.enabled)) on.push("dropShadow");
  if (s.outerGlow?.enabled) on.push("outerGlow");
  if (s.innerShadow?.some((f) => f.enabled)) on.push("innerShadow");
  if (s.innerGlow?.enabled) on.push("innerGlow");
  if (s.bevel?.enabled) on.push("bevel");
  if (s.satin?.enabled) on.push("satin");
  if (s.colorOverlay?.some((f) => f.enabled)) on.push("colorOverlay");
  if (s.gradientOverlay?.some((f) => f.enabled)) on.push("gradientOverlay");
  if (s.patternOverlay?.enabled) on.push("patternOverlay");
  if (s.stroke?.some((f) => f.enabled)) on.push("stroke");
  return on;
}

/** How far outside the layer's pixels the effects reach (the compositor reads this much extra around a tile). */
export function styleHalo(s: LayerStyle | undefined): number {
  if (!s || !s.enabled) return 0;
  let h = 0;
  for (const f of s.dropShadow ?? []) if (f.enabled) h = Math.max(h, f.distance + f.size * 1.5 + 2);
  for (const f of s.innerShadow ?? []) if (f.enabled) h = Math.max(h, f.distance + f.size * 1.5 + 2);
  if (s.outerGlow?.enabled) h = Math.max(h, s.outerGlow.size * 1.5 + 2);
  if (s.innerGlow?.enabled) h = Math.max(h, s.innerGlow.size * 1.5 + 2);
  if (s.bevel?.enabled) h = Math.max(h, s.bevel.size * 1.5 + s.bevel.soften + 2);
  if (s.satin?.enabled) h = Math.max(h, s.satin.distance + s.satin.size * 1.5 + 2);
  for (const f of s.stroke ?? []) if (f.enabled) h = Math.max(h, f.size + 2);
  return Math.ceil(h * (s.scale ?? 1));
}

/** One pass the compositor draws: straight-alpha pixels with their own blend mode and opacity. */
export interface StylePass {
  px: Float32Array;
  blend: BlendMode;
  opacity: number;
  /** "under": drawn before the layer (shadows, outer glow); "content": the layer itself; "over": after it. */
  place: "under" | "content" | "over";
}

/** Default values for a new effect of each kind (the Layer Style dialog starts here). */
export const FX_DEFAULTS = {
  dropShadow: (): ShadowFx => ({ enabled: true, blend: "multiply", color: [0, 0, 0, 1], opacity: 0.35, angle: 120, distance: 8, spread: 0, size: 12, globalLight: true }),
  innerShadow: (): ShadowFx => ({ enabled: true, blend: "multiply", color: [0, 0, 0, 1], opacity: 0.35, angle: 120, distance: 5, spread: 0, size: 5, globalLight: true }),
  outerGlow: (): GlowFx => ({ enabled: true, blend: "screen", color: [1, 1, 0.75, 1], opacity: 0.75, spread: 0, size: 10, technique: "softer" }),
  innerGlow: (): GlowFx => ({ enabled: true, blend: "screen", color: [1, 1, 0.75, 1], opacity: 0.75, spread: 0, size: 10, technique: "softer", source: "edge" }),
  bevel: (): BevelFx => ({ enabled: true, style: "inner", technique: "smooth", depth: 1, direction: "up", size: 5, soften: 0, angle: 120, altitude: 30, globalLight: true, highlight: { blend: "screen", color: [1, 1, 1, 1], opacity: 0.75 }, shadow: { blend: "multiply", color: [0, 0, 0, 1], opacity: 0.75 } }),
  satin: (): SatinFx => ({ enabled: true, blend: "multiply", color: [0, 0, 0, 1], opacity: 0.5, angle: 19, distance: 11, size: 14, invert: true }),
  colorOverlay: (): OverlayFx<RGBA> => ({ enabled: true, blend: "normal", opacity: 1, value: [0.95, 0.27, 0.27, 1] }),
  stroke: (): StrokeFx => ({ enabled: true, size: 3, position: "outside", blend: "normal", opacity: 1, fill: { type: "color", color: [0, 0, 0, 1] } }),
};
