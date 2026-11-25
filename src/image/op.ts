// Operations: every filter, adjustment and geometry step is an op, its own module (march/image/ops/<name>) and its own
// function. An op value is plain JSON ({ type, params }), so an edit list can be saved, shared and reordered; the
// implementation travels with the value made by its function (a symbol key JSON leaves out) and is found by type
// otherwise (registered on import, or loaded on demand: ops/index.ts).
//   import { exposure } from "march/image/ops/exposure";     exposure(0.5) → { type: "exposure", params: { amount: 0.5 } }
import type { Raster } from "./raster.ts";

/** What an op does to pixels, which decides how the pipeline runs it. */
export type OpKind =
  /** colour in, colour out (fused with its neighbours into one 3D lookup table) */
  | "color"
  /** each pixel from its own colour and position (vignette, grain): one pass, no neighbours */
  | "pixel"
  /** reads neighbours (blur, sharpen, clarity): whole raster in, same size out */
  | "spatial"
  /** changes the size or the geometry (crop, rotate, resize) */
  | "geometry";

/** Numeric parameter description (sliders are built from it). */
export interface ParamSpec {
  min: number;
  max: number;
  default: number;
  step?: number | undefined;
  /** Slider centred on 0 (the neutral value in the middle). */
  centered?: boolean | undefined;
  unit?: string | undefined;
}

/** Context handed to an op while it runs. */
export interface OpContext {
  /** Scale of the raster against the full image (0.25 when a preview is a quarter of it): radii in px scale by it. */
  scale: number;
  /** Full image size (pixels), for ops that place things in image space. */
  fullWidth: number;
  fullHeight: number;
}

/** An op's implementation. */
export interface OpDef<P extends object = Record<string, any>> {
  type: string;
  kind: OpKind;
  /** Default parameters (also the neutral setting where there is one). */
  defaults: P;
  /** Numeric params as sliders (min / max / step / centered). */
  params?: { readonly [K in keyof P]?: ParamSpec } | undefined;
  /** Does this setting change nothing (skipped by the pipeline)? */
  identity?: ((p: P) => boolean) | undefined;
  /** kind "color": map one linear RGB triple in place (values may leave 0–1; alpha untouched). */
  color?: ((rgb: Float32Array, p: P) => void) | undefined;
  /** Prepare per-run data once (tables, curves) before color / pixel are called. */
  prepare?: ((p: P, ctx: OpContext) => unknown) | undefined;
  /** kind "color" with prepare: like color, with the prepared data. */
  colorWith?: ((rgb: Float32Array, p: P, data: unknown) => void) | undefined;
  /** kind "pixel": change pixel `i` (index into data, ×4) at x, y in place. */
  pixel?: ((d: Float32Array, i: number, x: number, y: number, w: number, h: number, p: P, data: unknown) => void) | undefined;
  /** kind "spatial" / "geometry": a new raster (or the same, changed in place). */
  run?: ((r: Raster, p: P, ctx: OpContext) => Raster) | undefined;
  /** Cheap preview as a CSS filter (null: none; the pipeline must run). */
  css?: ((p: P) => string | null) | undefined;
}

/** One step of an edit list: plain JSON. */
export interface ImageOp<P extends object = Record<string, any>> {
  type: string;
  params: P;
  /** Stable id within an edit list (added by imageDoc). */
  id?: string | undefined;
  /** false: kept in the list, skipped. */
  on?: boolean | undefined;
  /** Strength 0–1 blended with the image before the op (default 1). */
  mix?: number | undefined;
}

/** The implementation an op value carries (not saved as JSON). */
export const OP_DEF: unique symbol = Symbol.for("march.image.op");
type Carrying = ImageOp & { [OP_DEF]?: OpDef };

const registry = new Map<string, OpDef>();

/** Register an op (its module does this when imported). */
export function defineOp<P extends object>(def: OpDef<P>): OpDef<P> {
  registry.set(def.type, def as unknown as OpDef);
  return def;
}
/** The registered implementation of a type. */
export const getOp = (type: string): OpDef | undefined => registry.get(type);
/** Every registered type. */
export const opTypes = (): string[] => [...registry.keys()];

/** An op value for a definition: `{ type, params }` with the implementation attached. */
export function opOf<P extends object>(def: OpDef<P>, params?: Partial<P>): ImageOp<P> {
  const op = { type: def.type, params: { ...def.defaults, ...params } as P } as ImageOp<P> & { [OP_DEF]?: OpDef };
  Object.defineProperty(op, OP_DEF, { value: def, enumerable: false });
  return op;
}

/** The implementation of an op value (carried, registered, or undefined until loaded). */
export const defOf = (op: ImageOp): OpDef | undefined => (op as Carrying)[OP_DEF] ?? registry.get(op.type);

/** Is this op a no-op as set (off, mix 0, or identity)? */
export function inert(op: ImageOp, def = defOf(op)): boolean {
  if (op.on === false || op.mix === 0 || !def) return true;
  return def.identity ? def.identity({ ...def.defaults, ...op.params } as never) : false;
}

const loaders = new Map<string, () => Promise<unknown>>();
/** Tell the engine how to load a type it meets in saved JSON (ops/index.ts registers every built-in one). */
export function opLoader(type: string, load: () => Promise<unknown>): void { loaders.set(type, load); }
/** Load every implementation a list needs (built-in ones on demand). */
export async function ensureOps(ops: readonly ImageOp[]): Promise<void> {
  await Promise.all(ops.filter((o) => !defOf(o) && loaders.has(o.type)).map((o) => loaders.get(o.type)!()));
}

/** Clamp helper ops use. */
export const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
/** Mix two numbers. */
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
/** Smoothstep 0–1. */
export const smooth = (e0: number, e1: number, x: number): number => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
