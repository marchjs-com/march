// One renderHooks.prepare for the vector layer kinds (text, shape, smart): each module adds its kind here; the hook
// chains to whatever prepare was installed before (other modules keep working). Also the cache key helper the three
// renderers share: JSON of the layer's data with pixel data replaced by identity + version (no pixel copies).

import { renderHooks } from "../composite.ts";
import type { ImageDocument } from "../document.ts";
import type { Layer, LayerKind } from "../layers.ts";
import { Mask, TiledRaster } from "../tiles.ts";

type Prepare = (doc: ImageDocument, layer: Layer) => void;
const byKind = new Map<LayerKind, Prepare>();
let installed = false;

/** Handle `prepare` for one layer kind (replaces an earlier handler of the same kind). */
export function addPrepare(kind: LayerKind, fn: Prepare): () => void {
  byKind.set(kind, fn);
  if (!installed) {
    installed = true;
    const prev = renderHooks.prepare;
    renderHooks.prepare = (doc, layer) => {
      const f = byKind.get(layer.kind);
      if (f) f(doc, layer);
      else prev?.(doc, layer);
    };
  }
  return () => { if (byKind.get(kind) === fn) byKind.delete(kind); };
}

const ids = new WeakMap<object, number>();
let seq = 0;
/** A stable number for an object's identity. */
export const identity = (o: object): number => { let n = ids.get(o); if (n == null) ids.set(o, (n = ++seq)); return n; };

/** JSON of plain data; rasters, masks and typed arrays become `#id:version` (cheap, changes when their pixels do). */
export function stableKey(v: unknown): string {
  return JSON.stringify(v, (_k, x: unknown) => {
    if (x instanceof TiledRaster || x instanceof Mask) return `#${identity(x)}:${x.version}`;
    if (ArrayBuffer.isView(x)) return `#${identity(x)}`;
    return x;
  });
}

/**
 * Keys of what each raster last showed. Keyed by the raster (shared by reference between the live layer object and
 * the history's copies), so undo / redo re-render only when the data really differs from what the pixels show.
 */
const shown = new WeakMap<TiledRaster, string>();
export function upToDate(raster: TiledRaster, key: string): boolean { return shown.get(raster) === key; }
export function markShown(raster: TiledRaster, key: string): void { shown.set(raster, key); }
export function forget(raster: TiledRaster): void { shown.delete(raster); }

/**
 * Replace all of a raster's pixels with a straight RGBA buffer over `r` (geometry space). The raster's offset
 * (ox, oy: the Move tool moves a layer by changing it) stays an extra translation: the pixels land at r + offset, so a
 * moved vector layer does not need a re-render and its cache key does not include the offset. `bakeOffset` (text,
 * shapes, smart) folds the offset back into the geometry when a command edits it.
 */
export function replaceRaster(raster: TiledRaster, r: { x: number; y: number; w: number; h: number } | null, px: Float32Array | null): void {
  raster.clear();
  if (r && px && r.w > 0 && r.h > 0) raster.write(r.x + raster.ox, r.y + raster.oy, r.w, r.h, px);
}
