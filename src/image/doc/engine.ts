// The bridge to march/image (the image-editing engine): adjustment layers and smart filters run the engine's filters.
// No filter bodies live here; the engine registers its filters (or an app registers its own), the document stores
// { id, params } and calls them per region.

import type { Rect } from "./tiles.ts";

/** One parameter of a filter, for generated UIs (Properties panel, filter gallery). */
export interface ParamSpec {
  key: string;
  label: string;
  kind: "number" | "angle" | "color" | "boolean" | "choice" | "curve" | "levels" | "gradient" | "point" | "map";
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  default: unknown;
  options?: { value: string; label: string }[];
}

/** Pixels handed to a filter: straight RGBA floats 0–1, row-major. */
export interface FilterPixels { width: number; height: number; data: Float32Array }

export interface FilterContext {
  /** Where the pixels are in the document (some filters are position-aware: lighting, clouds, lens flare). */
  rect: Rect;
  /** Document size and resolution. */
  doc: { width: number; height: number; dpi: number };
  /** Preview scale (1 = full size): filters with radii scale them for previews. */
  scale: number;
  /** The selection / mask coverage 0–1 for the region (null = everywhere). */
  mask?: Float32Array | null | undefined;
  signal?: AbortSignal | undefined;
}

export interface FilterDef {
  id: string;
  label: string;
  /** Menu group: "adjust" (Image › Adjustments) or a Filter menu group ("blur", "sharpen", "distort", "noise", "pixelate", "render", "stylize", "other"…). */
  group: string;
  params: ParamSpec[];
  /** Works on the pixels in place or returns new ones of the same size. */
  apply(px: FilterPixels, params: Record<string, unknown>, ctx: FilterContext): FilterPixels | void;
  /** How many pixels around a region the filter reads (blur radius…); 0 = per pixel. Infinity = needs the whole image. */
  halo?(params: Record<string, unknown>, scale: number): number;
  /** Can be an adjustment layer (pure per-pixel color change). */
  adjustment?: boolean | undefined;
  /** Short description for menus and the filter gallery. */
  hint?: string | undefined;
  /** Preview thumbnail kind for galleries. */
  icon?: string | undefined;
}

const registry = new Map<string, FilterDef>();
const listeners = new Set<() => void>();

/** Add filters (the engine calls this; apps and plugins may add their own). Returns a remover. */
export function registerFilter(...defs: FilterDef[]): () => void {
  for (const d of defs) registry.set(d.id, d);
  for (const fn of listeners) fn();
  return () => { for (const d of defs) if (registry.get(d.id) === d) registry.delete(d.id); for (const fn of listeners) fn(); };
}

export const getFilter = (id: string): FilterDef | undefined => registry.get(id);
export const filters = (group?: string): FilterDef[] => [...registry.values()].filter((d) => !group || d.group === group);
export const adjustments = (): FilterDef[] => [...registry.values()].filter((d) => d.adjustment);
export function onFilters(fn: () => void): () => void { listeners.add(fn); return () => listeners.delete(fn); }

/** Default parameters of a filter. */
export function defaultParams(id: string): Record<string, unknown> {
  const d = registry.get(id);
  return d ? Object.fromEntries(d.params.map((p) => [p.key, structuredClone(p.default)])) : {};
}

/** Run a filter on straight float pixels (returns the result; unknown ids pass the pixels through). */
export function runFilter(id: string, px: FilterPixels, params: Record<string, unknown>, ctx: FilterContext): FilterPixels {
  const d = registry.get(id);
  if (!d) return px;
  const out = d.apply(px, { ...defaultParams(id), ...params }, ctx);
  return out ?? px;
}

export function filterHalo(id: string, params: Record<string, unknown>, scale = 1): number {
  const d = registry.get(id);
  return d?.halo ? d.halo({ ...defaultParams(id), ...params }, scale) : 0;
}

/** 8-bit ImageData-like ↔ float pixels (for engines that work on bytes). */
export function toBytes(px: FilterPixels): { width: number; height: number; data: Uint8ClampedArray } {
  const d = new Uint8ClampedArray(px.data.length);
  for (let i = 0; i < d.length; i++) d[i] = Math.round(px.data[i]! * 255);
  return { width: px.width, height: px.height, data: d };
}
export function fromBytes(img: { width: number; height: number; data: Uint8ClampedArray }): FilterPixels {
  const f = new Float32Array(img.data.length);
  for (let i = 0; i < f.length; i++) f[i] = img.data[i]! / 255;
  return { width: img.width, height: img.height, data: f };
}

/** Wrap a byte-based filter function (ImageData in, ImageData out) as a FilterDef apply. */
export const byteFilter = (fn: (img: { width: number; height: number; data: Uint8ClampedArray }, params: Record<string, unknown>, ctx: FilterContext) => { width: number; height: number; data: Uint8ClampedArray } | void) =>
  (px: FilterPixels, params: Record<string, unknown>, ctx: FilterContext): FilterPixels => {
    const img = toBytes(px);
    return fromBytes(fn(img, params, ctx) ?? img);
  };
