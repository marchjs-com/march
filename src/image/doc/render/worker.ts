// Rendering off the main thread. snapshotDoc() turns a document region into a structured-clone message (the layer
// tree as plain data, only the raster tiles the region needs, masks as arrays) plus the list of buffers to transfer;
// renderSnapshot() rebuilds a document from it and composites — that is what a worker runs. WorkerPool sends tile jobs
// to workers with transferable buffers, or runs them inline when no worker factory is given (Node, tests).
// Render hooks (text layout, layer styles, smart objects) and registered filters must be installed in the worker too.

import { ImageDocument } from "../document.ts";
import { renderRegion } from "../composite.ts";
import { hasRaster, walk, type Layer } from "../layers.ts";
import { Mask, TILE, TiledRaster, keyTx, keyTy, rectIntersect, type BitDepth, type PixelArray, type Rect } from "../tiles.ts";

interface RasterData { $raster: number; depth: BitDepth; ox: number; oy: number; tiles: [number, PixelArray][] }
interface MaskData { $mask: number; width: number; height: number; outside: number; data: Uint8Array }

/** A document region as plain, cloneable data. */
export interface DocSnapshot {
  width: number;
  height: number;
  depth: BitDepth;
  dpi: number;
  /** The layer tree with rasters / masks replaced by { $raster } / { $mask } references. */
  layers: unknown[];
  rasters: RasterData[];
  masks: MaskData[];
  rect: Rect;
}

/**
 * Snapshot what rendering `rect` needs (grown by `halo` for filters and effects). Tile arrays are copied (the
 * document keeps its own), so `transfer` can hand them to a worker without detaching anything live.
 */
export function snapshotDoc(doc: ImageDocument, rect: Rect = doc.bounds, halo = 0): { snapshot: DocSnapshot; transfer: ArrayBuffer[] } {
  const need: Rect = { x: rect.x - halo, y: rect.y - halo, w: rect.w + 2 * halo, h: rect.h + 2 * halo };
  const rasters: RasterData[] = [], masks: MaskData[] = [], transfer: ArrayBuffer[] = [];
  const rIds = new Map<TiledRaster, number>(), mIds = new Map<Mask, number>();
  const conv = (v: unknown): unknown => {
    if (v instanceof TiledRaster) {
      let id = rIds.get(v);
      if (id === undefined) {
        id = rasters.length;
        rIds.set(v, id);
        const tiles: [number, PixelArray][] = [];
        for (const [k, t] of v.tiles) {
          const tr = { x: keyTx(k) * TILE + v.ox, y: keyTy(k) * TILE + v.oy, w: TILE, h: TILE };
          if (!rectIntersect(tr, need)) continue;
          const copy = t.slice() as PixelArray;
          tiles.push([k, copy]);
          transfer.push(copy.buffer as ArrayBuffer);
        }
        rasters.push({ $raster: id, depth: v.depth, ox: v.ox, oy: v.oy, tiles });
      }
      return { $raster: id };
    }
    if (v instanceof Mask) {
      let id = mIds.get(v);
      if (id === undefined) {
        id = masks.length;
        mIds.set(v, id);
        const data = v.data.slice();
        transfer.push(data.buffer as ArrayBuffer);
        masks.push({ $mask: id, width: v.width, height: v.height, outside: v.outside, data });
      }
      return { $mask: id };
    }
    if (ArrayBuffer.isView(v)) return v;
    if (Array.isArray(v)) return v.map(conv);
    if (v && typeof v === "object") { const o: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v)) if (typeof x !== "function") o[k] = conv(x); return o; }
    return v;
  };
  const layers = doc.layers.map(conv) as unknown[];
  return { snapshot: { width: doc.width, height: doc.height, depth: doc.depth, dpi: doc.dpi, layers, rasters, masks, rect }, transfer };
}

/** Rebuild a document from a snapshot (in a worker). */
export function restoreSnapshot(s: DocSnapshot): ImageDocument {
  const doc = new ImageDocument({ width: s.width, height: s.height, depth: s.depth, dpi: s.dpi, background: "transparent" });
  const rasters = s.rasters.map((r) => { const t = new TiledRaster(r.depth); t.ox = r.ox; t.oy = r.oy; for (const [k, a] of r.tiles) t.tiles.set(k, a); return t; });
  const masks = s.masks.map((m) => { const k = new Mask(0, 0); k.width = m.width; k.height = m.height; k.outside = m.outside; k.data = m.data; return k; });
  const back = (v: unknown): unknown => {
    if (ArrayBuffer.isView(v)) return v;
    if (Array.isArray(v)) return v.map(back);
    if (v && typeof v === "object") {
      const o = v as Record<string, unknown>;
      if (typeof o.$raster === "number" && Object.keys(o).length === 1) return rasters[o.$raster]!;
      if (typeof o.$mask === "number" && Object.keys(o).length === 1) return masks[o.$mask]!;
      const out: Record<string, unknown> = {};
      for (const [k, x] of Object.entries(o)) out[k] = back(x);
      return out;
    }
    return v;
  };
  doc.layers = back(s.layers) as Layer[];
  return doc;
}

/** What a worker does with a snapshot: the premultiplied RGBA of its rect. */
export function renderSnapshot(s: DocSnapshot, rect: Rect = s.rect): Float32Array {
  return renderRegion(restoreSnapshot(s), rect);
}
/** Design name kept for the UI: render a snapshot region (in a worker, or inline). */
export const renderInWorker = renderSnapshot;

// ——— the pool ———

/** The part of a Worker the pool uses. */
export interface WorkerLike {
  postMessage(msg: unknown, transfer?: Transferable[]): void;
  onmessage: ((e: { data: unknown }) => void) | null;
  terminate(): void;
}

interface Job { id: number; snapshot: DocSnapshot; transfer: ArrayBuffer[]; resolve: (px: Float32Array) => void; reject: (e: unknown) => void }

/**
 * A pool of render workers. `create` makes a worker that runs workerMain(); without it every job renders inline
 * (synchronously inside the returned promise), so code paths are the same under Node.
 */
export class WorkerPool {
  readonly size: number;
  private create: (() => WorkerLike) | null;
  private idle: WorkerLike[] = [];
  private all: WorkerLike[] = [];
  private queue: Job[] = [];
  private running = new Map<WorkerLike, Job>();
  private seq = 0;

  constructor(o: { size?: number | undefined; create?: (() => WorkerLike) | undefined } = {}) {
    this.create = o.create ?? null;
    const hc = typeof navigator !== "undefined" ? (navigator as { hardwareConcurrency?: number }).hardwareConcurrency ?? 4 : 4;
    this.size = Math.max(1, o.size ?? Math.min(8, hc - 1));
  }

  get inline(): boolean { return !this.create; }

  /** Render a region of a document off the main thread (premultiplied RGBA). */
  render(doc: ImageDocument, rect: Rect, halo = 0): Promise<Float32Array> {
    const { snapshot, transfer } = snapshotDoc(doc, rect, halo);
    return this.run(snapshot, transfer);
  }

  /** Render every tile of a region in parallel; `onTile` gets each finished tile. */
  async renderTiles(doc: ImageDocument, rect: Rect, onTile: (r: Rect, px: Float32Array) => void): Promise<void> {
    const jobs: Promise<void>[] = [];
    for (let y = Math.floor(rect.y / TILE) * TILE; y < rect.y + rect.h; y += TILE) for (let x = Math.floor(rect.x / TILE) * TILE; x < rect.x + rect.w; x += TILE) {
      const r = rectIntersect({ x, y, w: TILE, h: TILE }, rectIntersect(rect, doc.bounds) ?? rect);
      if (r) jobs.push(this.render(doc, r).then((px) => onTile(r, px)));
    }
    await Promise.all(jobs);
  }

  run(snapshot: DocSnapshot, transfer: ArrayBuffer[] = []): Promise<Float32Array> {
    if (!this.create) {
      try { return Promise.resolve(renderSnapshot(snapshot)); } catch (e) { return Promise.reject(e); }
    }
    return new Promise((resolve, reject) => { this.queue.push({ id: ++this.seq, snapshot, transfer, resolve, reject }); this.pump(); });
  }

  private pump(): void {
    while (this.queue.length) {
      let w = this.idle.pop();
      if (!w && this.all.length < this.size) { w = this.create!(); this.all.push(w); this.listen(w); }
      if (!w) return;
      const job = this.queue.shift()!;
      this.running.set(w, job);
      w.postMessage({ id: job.id, snapshot: job.snapshot }, job.transfer);
    }
  }

  private listen(w: WorkerLike): void {
    w.onmessage = (e) => {
      const job = this.running.get(w);
      this.running.delete(w);
      this.idle.push(w);
      const d = e.data as { id: number; px?: Float32Array; error?: string };
      if (job) { if (d.px) job.resolve(d.px); else job.reject(new Error(d.error ?? "render failed")); }
      this.pump();
    };
  }

  dispose(): void {
    for (const w of this.all) w.terminate();
    for (const j of this.queue) j.reject(new Error("pool disposed"));
    this.all = []; this.idle = []; this.queue = []; this.running.clear();
  }
}

/** The worker side: `workerMain(self)` in a module worker (after installing render hooks and filters). */
export function workerMain(scope: { onmessage: ((e: { data: unknown }) => void) | null; postMessage(msg: unknown, transfer?: Transferable[]): void }): void {
  scope.onmessage = (e) => {
    const { id, snapshot } = e.data as { id: number; snapshot: DocSnapshot };
    try {
      const px = renderSnapshot(snapshot);
      scope.postMessage({ id, px }, [px.buffer as ArrayBuffer]);
    } catch (err) {
      scope.postMessage({ id, error: String(err) });
    }
  };
}

/** Which rasters a snapshot of `rect` would copy (for budgeting a job before making it). */
export function snapshotBytes(doc: ImageDocument, rect: Rect): number {
  let n = 0;
  for (const [l] of walk(doc.layers)) if (hasRaster(l)) for (const k of l.raster.tiles.keys()) {
    const tr = { x: keyTx(k) * TILE + l.raster.ox, y: keyTy(k) * TILE + l.raster.oy, w: TILE, h: TILE };
    if (rectIntersect(tr, rect)) n += TILE * TILE * 4 * (l.raster.depth / 8);
  }
  return n;
}
