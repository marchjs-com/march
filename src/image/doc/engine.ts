// The bridge to march/image (the image-editing engine): adjustment layers and smart filters store an op value
// ({ type, params, on, mix }) and run it through the engine's pipeline. No filter bodies live here: every adjustment
// and filter is the engine's op (src/image/ops/*), found by type (loaded on demand with ensureOps).
// The document keeps sRGB-encoded straight colors; ops work in linear light, so a region is converted on the way in
// and back on the way out.

import { getOp, opTypes, defineOp, ensureOps, type OpDef, type ImageOp, type ParamSpec as OpParamSpec } from "../op.ts";
import { render } from "../pipeline.ts";
import { toLinear, toEncoded, type Raster } from "../raster.ts";
import type { Rect } from "./tiles.ts";

/** Pixels handed to a filter: straight RGBA floats 0–1 (sRGB-encoded), row-major. */
export interface FilterPixels { width: number; height: number; data: Float32Array }

export interface FilterContext {
  /** Where the pixels are in the document. */
  rect: Rect;
  /** Document size and resolution. */
  doc: { width: number; height: number; dpi: number };
  /** Preview scale (1 = full size): ops scale their radii by it. */
  scale: number;
  signal?: AbortSignal | undefined;
}

/** A filter / adjustment as the editor lists it (menus, Properties, filter gallery). */
export interface FilterInfo {
  id: string;
  kind: OpDef["kind"];
  /** Numeric parameters with their slider ranges. */
  params: Record<string, OpParamSpec>;
  defaults: Record<string, unknown>;
  /** A pure color change: can be an adjustment layer and runs per tile. */
  adjustment: boolean;
}

const info = (def: OpDef): FilterInfo => ({
  id: def.type, kind: def.kind, params: (def.params ?? {}) as Record<string, OpParamSpec>, defaults: def.defaults as Record<string, unknown>,
  adjustment: def.kind === "color",
});

/** The engine's op for an id, as a FilterInfo. */
export const getFilter = (id: string): FilterInfo | undefined => { const d = getOp(id); return d ? info(d) : undefined; };
/** Every registered op (optionally of one kind). */
export const filters = (kind?: OpDef["kind"]): FilterInfo[] => opTypes().map((t) => getOp(t)!).filter((d) => !kind || d.kind === kind).map(info);
/** Ops that can be adjustment layers (color ops). */
export const adjustments = (): FilterInfo[] => filters("color");
/** Add an op of your own (plugins): the engine's defineOp. */
export const registerFilter = <P extends object>(def: OpDef<P>): OpDef<P> => defineOp(def);

/** Default parameters of an op. */
export function defaultParams(id: string): Record<string, unknown> {
  const d = getOp(id);
  return d ? { ...(d.defaults as Record<string, unknown>) } : {};
}

/** Load every op a document's adjustment layers and smart filters need (call after opening a file). */
export async function ensureDocOps(ids: readonly string[]): Promise<void> {
  await ensureOps(ids.map((type) => ({ type, params: {} } as ImageOp)));
}

/** Run one op on straight sRGB-encoded pixels; unknown ids pass the pixels through. */
export function runFilter(id: string, px: FilterPixels, params: Record<string, unknown>, ctx: FilterContext, mix = 1): FilterPixels {
  if (!getOp(id)) return px;
  const n = px.width * px.height, lin = new Float32Array(n * 4), d = px.data;
  for (let i = 0; i < n * 4; i += 4) { lin[i] = toLinear(d[i]!); lin[i + 1] = toLinear(d[i + 1]!); lin[i + 2] = toLinear(d[i + 2]!); lin[i + 3] = d[i + 3]!; }
  const src: Raster = { width: px.width, height: px.height, data: lin, space: "srgb" };
  const out = render(src, [{ type: id, params, mix }], { scale: ctx.scale, fullWidth: ctx.doc.width, fullHeight: ctx.doc.height });
  const o = out.data, res = new Float32Array(out.width * out.height * 4);
  for (let i = 0; i < res.length; i += 4) { res[i] = toEncoded(Math.max(0, o[i]!)); res[i + 1] = toEncoded(Math.max(0, o[i + 1]!)); res[i + 2] = toEncoded(Math.max(0, o[i + 2]!)); res[i + 3] = o[i + 3]!; }
  return { width: out.width, height: out.height, data: res };
}

/**
 * How far around a region an op reads: 0 for color ops (they run per tile); Infinity for pixel, spatial and geometry
 * ops (position-aware or neighbourhood ops get the whole document region, cached by the caller).
 */
export function filterHalo(id: string, _params?: Record<string, unknown>, _scale = 1): number {
  const d = getOp(id);
  if (!d) return 0;
  return d.kind === "color" ? 0 : Infinity;
}
