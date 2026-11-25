// Artboards: create from presets (phone, tablet, web, social sizes), from layers (their bounds) or from the selection;
// move layers in and out; auto-nest a layer dropped onto an artboard (the artboard under the layer's center takes
// it; outside every artboard it goes back to the root). Layers locked with `locks.artboard` stay where they are.

import type { ImageDocument } from "../document.ts";
import type { ArtboardLayer, Layer, RGBA } from "../layers.ts";
import { rectUnion, type Rect } from "../tiles.ts";
import { layerBounds } from "../bounds.ts";

export interface ArtboardPreset { id: string; name: string; group: "phone" | "tablet" | "web" | "social" | "print" | "desktop"; w: number; h: number }

/** Preset sizes in CSS pixels (phones and tablets at 1×), social posts and banners at their upload sizes. */
export const ARTBOARD_PRESETS: ArtboardPreset[] = [
  { id: "phone-small", name: "Phone (small)", group: "phone", w: 360, h: 640 },
  { id: "phone", name: "Phone", group: "phone", w: 390, h: 844 },
  { id: "phone-large", name: "Phone (large)", group: "phone", w: 430, h: 932 },
  { id: "android", name: "Android", group: "phone", w: 412, h: 915 },
  { id: "tablet", name: "Tablet", group: "tablet", w: 768, h: 1024 },
  { id: "tablet-large", name: "Tablet (large)", group: "tablet", w: 1024, h: 1366 },
  { id: "tablet-landscape", name: "Tablet (landscape)", group: "tablet", w: 1180, h: 820 },
  { id: "web", name: "Web", group: "web", w: 1440, h: 1024 },
  { id: "web-small", name: "Web (small)", group: "web", w: 1280, h: 800 },
  { id: "web-hd", name: "Web (HD)", group: "web", w: 1920, h: 1080 },
  { id: "desktop-4k", name: "Desktop 4K", group: "desktop", w: 3840, h: 2160 },
  { id: "post-square", name: "Square Post", group: "social", w: 1080, h: 1080 },
  { id: "post-portrait", name: "Portrait Post", group: "social", w: 1080, h: 1350 },
  { id: "story", name: "Story / Reel", group: "social", w: 1080, h: 1920 },
  { id: "cover-wide", name: "Wide Cover", group: "social", w: 1500, h: 500 },
  { id: "link-preview", name: "Link Preview", group: "social", w: 1200, h: 630 },
  { id: "video-thumb", name: "Video Thumbnail", group: "social", w: 1280, h: 720 },
  { id: "a4", name: "A4 (150 ppi)", group: "print", w: 1240, h: 1754 },
  { id: "letter", name: "Letter (150 ppi)", group: "print", w: 1275, h: 1650 },
];

/** Where a new artboard goes: right of the right-most artboard with a gap (or the origin). */
export function nextArtboardSpot(doc: ImageDocument, gap = 100): { x: number; y: number } {
  const boards = doc.layers.filter((l): l is ArtboardLayer => l.kind === "artboard");
  if (!boards.length) return { x: 0, y: 0 };
  const right = Math.max(...boards.map((b) => b.rect.x + b.rect.w));
  return { x: right + gap, y: Math.min(...boards.map((b) => b.rect.y)) };
}

/** A new artboard (one history step): from a preset id, a rectangle, or { w, h } at the next free spot. */
export function createArtboard(doc: ImageDocument, what: string | Rect | { w: number; h: number }, opts: { name?: string; background?: RGBA | null } = {}): ArtboardLayer {
  let rect: Rect, name = opts.name;
  if (typeof what === "string") {
    const p = ARTBOARD_PRESETS.find((x) => x.id === what) ?? ARTBOARD_PRESETS[1]!;
    rect = { ...nextArtboardSpot(doc), w: p.w, h: p.h };
    name ??= p.name;
  } else if ("x" in what) rect = { x: Math.round(what.x), y: Math.round(what.y), w: Math.max(1, Math.round(what.w)), h: Math.max(1, Math.round(what.h)) };
  else rect = { ...nextArtboardSpot(doc), w: what.w, h: what.h };
  return doc.change("New Artboard", () => {
    const a = doc.newArtboard(rect, name ?? doc.nextName("Artboard"));
    if (opts.background !== undefined) a.background = opts.background;
    doc.layers.push(a);
    doc.setActive(a.id);
    return a;
  }, "artboard");
}

/** Layer › New › Artboard from Layers: an artboard around the layers, the layers moved into it. */
export function artboardFromLayers(doc: ImageDocument, ids: string[] = doc.selected, name?: string): ArtboardLayer | null {
  const layers = ids.map((id) => doc.find(id)).filter((l): l is Layer => !!l && l.kind !== "artboard");
  if (!layers.length) return null;
  let b: Rect | null = null;
  for (const l of layers) b = rectUnion(b, layerBounds(doc, l));
  const r = b ?? doc.bounds;
  return doc.change("Artboard from Layers", () => {
    const order = doc.all().map((l) => l.id);
    layers.sort((a, c) => order.indexOf(a.id) - order.indexOf(c.id));
    const a = doc.newArtboard({ x: Math.floor(r.x), y: Math.floor(r.y), w: Math.ceil(r.w), h: Math.ceil(r.h) }, name ?? doc.nextName("Artboard"));
    doc.layers.push(a);
    for (const l of layers) doc.move(l.id, a.id, a.children.length);
    doc.setActive(a.id);
    return a;
  }, "artboard");
}

/** An artboard the size of the selection's bounds (empty selection: null). */
export function artboardFromSelection(doc: ImageDocument, name?: string): ArtboardLayer | null {
  const b = doc.selection?.bounds();
  return b ? createArtboard(doc, b, name ? { name } : {}) : null;
}

/** The artboard holding a layer (null at the root or in a plain group outside artboards). */
export function artboardOf(doc: ImageDocument, id: string): ArtboardLayer | null {
  let loc = doc.locate(id);
  while (loc && loc.parent) {
    if (loc.parent.kind === "artboard") return loc.parent;
    loc = doc.locate(loc.parent.id);
  }
  return null;
}

/** The top-most artboard containing a document point. */
export function artboardAt(doc: ImageDocument, x: number, y: number): ArtboardLayer | null {
  for (let i = doc.layers.length - 1; i >= 0; i--) {
    const l = doc.layers[i]!;
    if (l.kind === "artboard" && x >= l.rect.x && x < l.rect.x + l.rect.w && y >= l.rect.y && y < l.rect.y + l.rect.h) return l;
  }
  return null;
}

/** Move layers into an artboard (on top of its children), or out to the root when board is null. One step. */
export function moveToArtboard(doc: ImageDocument, ids: string[], board: string | null): void {
  doc.change(board ? "Move into Artboard" : "Move out of Artboard", () => {
    for (const id of ids) {
      const l = doc.find(id);
      if (!l || l.kind === "artboard" || l.locks.artboard) continue;
      if (board) { const a = doc.find(board); if (a && a.kind === "artboard") doc.move(id, a.id, a.children.length); }
      else doc.move(id, null, doc.layers.length);
    }
  }, "artboard");
}

/**
 * After a layer is dropped (moved on the canvas): put it in the artboard under its center, or at the root when it
 * left every artboard. Returns the artboard id it ended in (null = root), or undefined when nothing changed.
 * Call inside the move's change (it does not open its own step).
 */
export function autoNest(doc: ImageDocument, id: string): string | null | undefined {
  const l = doc.find(id);
  if (!l || l.kind === "artboard" || l.locks.artboard) return undefined;
  const b = layerBounds(doc, l);
  if (!b) return undefined;
  const target = artboardAt(doc, b.x + b.w / 2, b.y + b.h / 2);
  const current = artboardOf(doc, id);
  if (target?.id === current?.id) return undefined;
  // inside a group of the current artboard: leave groups alone, only top-level moves
  if (target) doc.move(id, target.id, target.children.length);
  else doc.move(id, null, doc.layers.length);
  return target ? target.id : null;
}

/** Resize / move an artboard; its children move with it when `withContents`. One step. */
export function setArtboardRect(doc: ImageDocument, id: string, rect: Rect, withContents = true): void {
  const a = doc.find(id);
  if (!a || a.kind !== "artboard") return;
  doc.change("Artboard Size", () => {
    const dx = Math.round(rect.x - a.rect.x), dy = Math.round(rect.y - a.rect.y);
    a.rect = { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.max(1, Math.round(rect.w)), h: Math.max(1, Math.round(rect.h)) };
    if (withContents && (dx || dy)) for (const c of a.children) shift(c, dx, dy);
  }, "artboard");
}

function shift(l: Layer, dx: number, dy: number): void {
  if ("raster" in l) { l.raster.ox += dx; l.raster.oy += dy; }
  if (l.kind === "group") for (const c of l.children) shift(c, dx, dy);
}
