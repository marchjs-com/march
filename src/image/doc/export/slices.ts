// Slices: user slices, slices made from layers (their rectangle follows the layer's pixels) and auto slices that cover
// the rest of the document, as the "Save for Web" table layout expects.

import type { ImageDocument, Slice } from "../document.ts";
import { hasRaster, isContainer, newId, type Layer } from "../layers.ts";
import { rectIntersect, rectUnion, type Rect } from "../tiles.ts";

/** Pixel bounds of a layer in document pixels (containers: their children; fill / adjustment layers: the document). */
export function layerBounds(doc: ImageDocument, l: Layer): Rect | null {
  if (l.kind === "artboard") return { ...l.rect };
  if (isContainer(l)) { let r: Rect | null = null; for (const c of l.children) r = rectUnion(r, layerBounds(doc, c)); return r; }
  if (hasRaster(l)) return l.raster.bounds();
  return doc.bounds;
}

/** Add a user slice (call inside doc.change). */
export function addSlice(doc: ImageDocument, rect: Rect, name?: string): Slice {
  const s: Slice = { id: newId("s"), name: name ?? `${doc.name.replace(/\.[^.]+$/, "")}_${doc.slices.length + 1}`, rect: { ...rect }, kind: "user" };
  doc.slices.push(s);
  return s;
}

/** New slices from layers (Layer › New Layer Based Slice; call inside doc.change). */
export function slicesFromLayers(doc: ImageDocument, ids: string[]): Slice[] {
  const out: Slice[] = [];
  for (const id of ids) {
    const l = doc.find(id);
    if (!l) continue;
    const r = layerBounds(doc, l);
    if (!r) continue;
    const s: Slice = { id: newId("s"), name: l.name, rect: r, kind: "layer", layerId: l.id };
    doc.slices.push(s);
    out.push(s);
  }
  return out;
}

/**
 * Every slice of the document: user slices, layer slices with their current rectangles (clipped to the document), then
 * auto slices covering what is left (a grid from all slice edges, merged along rows).
 */
export function sliceRects(doc: ImageDocument, opts: { auto?: boolean } = {}): Slice[] {
  const D = doc.bounds;
  const own: Slice[] = [];
  for (const s of doc.slices) {
    if (s.kind === "auto") continue;
    let rect: Rect | null = s.rect;
    if (s.kind === "layer" && s.layerId) { const l = doc.find(s.layerId); rect = l ? layerBounds(doc, l) : null; }
    rect = rect && rectIntersect(rect, D);
    if (rect) own.push({ ...s, rect });
  }
  if (opts.auto === false) return own;
  if (!own.length) return [{ id: "auto-1", name: `${baseName(doc)}_01`, rect: D, kind: "auto" }];
  const xs = new Set([0, D.w]), ys = new Set([0, D.h]);
  for (const s of own) { xs.add(s.rect.x); xs.add(s.rect.x + s.rect.w); ys.add(s.rect.y); ys.add(s.rect.y + s.rect.h); }
  const X = [...xs].sort((a, b) => a - b), Y = [...ys].sort((a, b) => a - b);
  const covered = (r: Rect): boolean => own.some((s) => rectIntersect(s.rect, r) !== null);
  const auto: Slice[] = [];
  for (let j = 0; j + 1 < Y.length; j++) {
    let run = null as Rect | null;
    for (let i = 0; i + 1 < X.length; i++) {
      const cell = { x: X[i]!, y: Y[j]!, w: X[i + 1]! - X[i]!, h: Y[j + 1]! - Y[j]! };
      if (!cell.w || !cell.h) continue;
      if (covered(cell)) { if (run) { auto.push(mk(run)); run = null; } continue; }
      run = run ? { x: run.x, y: run.y, w: run.w + cell.w, h: run.h } : cell;
    }
    if (run) auto.push(mk(run));
  }
  function mk(r: Rect): Slice { return { id: `auto-${auto.length + 1}`, name: "", rect: r, kind: "auto" }; }
  const all = [...own, ...auto].sort((a, b) => a.rect.y - b.rect.y || a.rect.x - b.rect.x);
  all.forEach((s, i) => { if (!s.name) s.name = `${baseName(doc)}_${String(i + 1).padStart(2, "0")}`; });
  return all;
}

const baseName = (doc: ImageDocument): string => doc.name.replace(/\.[^.]+$/, "") || "Untitled";
