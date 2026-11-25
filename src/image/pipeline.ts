// The pipeline: an edit list over a source raster. Runs of colour ops fuse into one 3D LUT (one pass however many
// sliders moved), pixel ops share one pass each, spatial and geometry ops get the whole raster. The source is never
// changed (non-destructive); a preview runs the same list on a smaller copy (ctx.scale scales radii).
import { cloneRaster, type Raster } from "./raster.ts";
import { buildLut, applyLut, type Lut3D } from "./lut.ts";
import { defOf, inert, type ImageOp, type OpContext, type OpDef } from "./op.ts";

/** A prepared stage. */
export type Stage =
  | { kind: "lut"; lut: Lut3D; ops: ImageOp[] }
  | { kind: "pixel"; op: ImageOp; def: OpDef; data: unknown; mix: number }
  | { kind: "run"; op: ImageOp; def: OpDef; mix: number };

export interface RenderOptions {
  /** Raster scale against the full image (default 1). */
  scale?: number | undefined;
  /** Full image size; default the raster's size / scale. */
  fullWidth?: number | undefined;
  fullHeight?: number | undefined;
  /** LUT grid size (default 33). */
  lutSize?: number | undefined;
  /** Stop before this many ops (history thumbnails, before / after a step). */
  upTo?: number | undefined;
}

const ctxFor = (r: Raster, o: RenderOptions): OpContext => {
  const scale = o.scale ?? 1;
  return { scale, fullWidth: o.fullWidth ?? Math.round(r.width / scale), fullHeight: o.fullHeight ?? Math.round(r.height / scale) };
};

/** A colour function for a run of colour ops (each with its mix), for LUT building. */
export function colorChain(ops: readonly ImageOp[], ctx: OpContext): (rgb: Float32Array) => void {
  const steps = ops.map((op) => {
    const def = defOf(op)!, p = { ...def.defaults, ...op.params } as never, data = def.prepare?.(p, ctx);
    return { def, p, data, mix: op.mix ?? 1 };
  });
  const prev = new Float32Array(3);
  return (rgb) => {
    for (const s of steps) {
      if (s.mix < 1) prev.set(rgb);
      if (s.def.colorWith) s.def.colorWith(rgb, s.p, s.data); else s.def.color!(rgb, s.p);
      if (s.mix < 1) for (let k = 0; k < 3; k++) rgb[k] = prev[k]! + (rgb[k]! - prev[k]!) * s.mix;
    }
  };
}

/** Group an edit list into stages (inert and unknown ops dropped; call ensureOps first for saved lists). */
export function plan(ops: readonly ImageOp[], ctx: OpContext, lutSize = 33): Stage[] {
  const stages: Stage[] = [];
  let run: ImageOp[] = [];
  const flush = (): void => { if (run.length) { stages.push({ kind: "lut", lut: buildLut(colorChain(run, ctx), lutSize), ops: run }); run = []; } };
  for (const op of ops) {
    const def = defOf(op);
    if (!def || inert(op, def)) continue;
    if (def.kind === "color" && (def.color || def.colorWith)) { run.push(op); continue; }
    flush();
    const p = { ...def.defaults, ...op.params } as never;
    if (def.kind === "pixel" && def.pixel) stages.push({ kind: "pixel", op, def, data: def.prepare?.(p, ctx), mix: op.mix ?? 1 });
    else if (def.run) stages.push({ kind: "run", op, def, mix: op.mix ?? 1 });
  }
  flush();
  return stages;
}

/** Blend b over a (same size) by t, into b. */
function mixInto(a: Raster, b: Raster, t: number): void {
  if (a.width !== b.width || a.height !== b.height) return;
  const x = a.data, y = b.data;
  for (let i = 0; i < y.length; i++) y[i] = x[i]! + (y[i]! - x[i]!) * t;
}

/** Run one stage on a raster (in place where it can; returns the result). */
export function runStage(r: Raster, s: Stage, ctx: OpContext): Raster {
  if (s.kind === "lut") { applyLut(r, s.lut); return r; }
  const p = { ...s.def.defaults, ...s.op.params } as never;
  const before = s.mix < 1 ? cloneRaster(r) : null;
  let out = r;
  if (s.kind === "pixel") {
    const d = r.data, w = r.width, h = r.height, f = s.def.pixel!;
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i += 4) f(d, i, x, y, w, h, p, s.data);
  } else out = s.def.run!(r, p, ctx);
  if (before) mixInto(before, out, s.mix);
  return out;
}

/** Apply an edit list to a source raster: a new raster, the source untouched. */
export function render(src: Raster, ops: readonly ImageOp[], o: RenderOptions = {}): Raster {
  const ctx = ctxFor(src, o);
  const list = o.upTo != null ? ops.slice(0, o.upTo) : ops;
  let r = cloneRaster(src);
  for (const s of plan(list, ctx, o.lutSize)) r = runStage(r, s, ctx);
  return r;
}

/**
 * The same, in slices that give the page a frame between them (big images stay responsive): resolves with the result,
 * or null when `signal` aborts (a newer edit replaced this one).
 */
export async function renderAsync(src: Raster, ops: readonly ImageOp[], o: RenderOptions & { signal?: AbortSignal | undefined; yieldEvery?: number | undefined } = {}): Promise<Raster | null> {
  const ctx = ctxFor(src, o);
  const list = o.upTo != null ? ops.slice(0, o.upTo) : ops;
  const pause = (): Promise<void> => new Promise((res) => { const ch = new MessageChannel(); ch.port1.onmessage = () => res(); ch.port2.postMessage(0); });
  let r = cloneRaster(src);
  const rows = Math.max(16, Math.floor((o.yieldEvery ?? 400_000) / Math.max(1, r.width)));
  for (const s of plan(list, ctx, o.lutSize)) {
    if (o.signal?.aborted) return null;
    if (s.kind === "lut") {
      // tiled: bands of rows, a pause between bands
      for (let y = 0; y < r.height; y += rows) { applyLut(r, s.lut, y, Math.min(r.height, y + rows)); if (o.signal?.aborted) return null; await pause(); }
    } else { r = runStage(r, s, ctx); await pause(); }
  }
  return o.signal?.aborted ? null : r;
}

/** The fused colour LUT of a list of colour ops only (export as .cube, GPU upload). */
export function lutOf(ops: readonly ImageOp[], size = 33): Lut3D {
  return buildLut(colorChain(ops.filter((o) => { const d = defOf(o); return d?.kind === "color" && !inert(o, d); }), { scale: 1, fullWidth: 1, fullHeight: 1 }), size);
}

/** A cheap CSS `filter` preview of a list (null when an op has no CSS form): instant feedback while dragging. */
export function cssPreview(ops: readonly ImageOp[]): string | null {
  const parts: string[] = [];
  for (const op of ops) {
    const def = defOf(op);
    if (!def || inert(op, def)) continue;
    const c = def.css?.({ ...def.defaults, ...op.params } as never);
    if (c == null) return null;
    if (c) parts.push(c);
  }
  return parts.join(" ") || "none";
}
