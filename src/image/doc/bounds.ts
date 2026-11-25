// Content bounds of a layer in document space: one function for move, smart objects, export and slices.
import { renderHooks } from "./composite.ts";
import type { ImageDocument } from "./document.ts";
import { hasRaster, isContainer, type Layer } from "./layers.ts";
import { pathBounds } from "./paths.ts";
import { rectUnion, type Rect } from "./tiles.ts";

/** Content bounds of any layer in document space (null = nothing). Vector layers are brought up to date first. */
export function layerBounds(doc: ImageDocument, l: Layer): Rect | null {
  if (l.kind === "artboard") return { ...l.rect };
  if (l.kind === "fill" || l.kind === "adjustment") return doc.bounds;
  if (isContainer(l)) { let r: Rect | null = null; for (const c of l.children) r = rectUnion(r, layerBounds(doc, c)); return r; }
  if (l.kind === "shape" && !l.raster.tiles.size) { const b = pathBounds(l.path); if (b) return { x: Math.floor(b.x), y: Math.floor(b.y), w: Math.ceil(b.w) + 1, h: Math.ceil(b.h) + 1 }; }
  if (hasRaster(l)) {
    // text / shape / smart rasters are caches: bring them up to date first
    renderHooks.prepare?.(doc, l);
    return l.raster.bounds();
  }
  return null;
}
