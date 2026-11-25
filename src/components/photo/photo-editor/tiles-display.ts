// Display tiles of a document for the canvas view: 256-px tiles per mip level (level L covers 256·2^L document
// pixels), rendered from the compositor on demand within a per-frame time budget, level L built from level L − 1 by
// a 2×2 box filter. Dirty rectangles drop the tiles they touch on every level; the old bitmap stays drawable until
// the new one is ready (no flicker), and a coarser level stands in while a finer one renders.

import { renderRegion, TILE, type ImageDocument, type Rect } from "../../../image/doc/index.ts";

export type Drawable = HTMLCanvasElement | OffscreenCanvas;

interface Entry { canvas: Drawable; bytes: Uint8ClampedArray; fresh: boolean }

/** Makes a canvas (OffscreenCanvas where it exists). */
export function makeCanvas(w: number, h: number): Drawable | null {
  const g = globalThis as { OffscreenCanvas?: typeof OffscreenCanvas; document?: Document };
  if (g.OffscreenCanvas) return new g.OffscreenCanvas(w, h);
  if (g.document) { const c = g.document.createElement("canvas"); c.width = w; c.height = h; return c; }
  return null;
}

export const MAX_LEVEL = 6;

/** A hook that changes display bytes in place (soft proof, gamut warning). */
export type DisplayTransform = (bytes: Uint8ClampedArray, rect: Rect) => void;

export class DisplayTiles {
  doc: ImageDocument;
  private tiles = new Map<string, Entry>();
  /** Bytes in the cache (a soft limit evicts far-away tiles). */
  limit = 256 * 1024 * 1024;
  transform: DisplayTransform | null = null;
  /** Renders one region (premultiplied float RGBA); replaceable by a worker or cache-backed renderer. */
  renderer: (doc: ImageDocument, r: Rect) => Float32Array = (doc, r) => renderRegion(doc, r);

  constructor(doc: ImageDocument) {
    this.doc = doc;
  }

  private key(l: number, tx: number, ty: number): string { return `${l}:${tx}:${ty}`; }

  /** Tile size in document pixels at a level. */
  span(level: number): number { return TILE << level; }

  /** A ready drawable (possibly stale) for a tile. */
  get(level: number, tx: number, ty: number): { canvas: Drawable; fresh: boolean } | null {
    const e = this.tiles.get(this.key(level, tx, ty));
    return e ? { canvas: e.canvas, fresh: e.fresh } : null;
  }

  /** Render (or re-render) a tile now. */
  render(level: number, tx: number, ty: number): Drawable | null {
    const k = this.key(level, tx, ty);
    const span = this.span(level);
    const x = tx * span, y = ty * span;
    const w = Math.min(TILE, Math.ceil((this.doc.width - x) / (1 << level))), h = Math.min(TILE, Math.ceil((this.doc.height - y) / (1 << level)));
    if (w <= 0 || h <= 0) return null;
    let bytes: Uint8ClampedArray;
    if (level === 0) {
      const f = this.renderer(this.doc, { x, y, w, h });
      bytes = new Uint8ClampedArray(w * h * 4);
      for (let i = 0; i < f.length; i += 4) {
        const a = f[i + 3]!;
        if (a <= 0) continue;
        const k2 = 255 / a;
        bytes[i] = f[i]! * k2 + 0.5; bytes[i + 1] = f[i + 1]! * k2 + 0.5; bytes[i + 2] = f[i + 2]! * k2 + 0.5; bytes[i + 3] = a * 255 + 0.5;
      }
    } else {
      // 2×2 box from the four children (premultiplied averaging so edges do not darken)
      bytes = new Uint8ClampedArray(w * h * 4);
      const acc = new Float32Array(w * h * 4), cnt = new Float32Array(w * h);
      for (let cy = 0; cy < 2; cy++) for (let cx = 0; cx < 2; cx++) {
        const ctx2 = tx * 2 + cx, cty = ty * 2 + cy;
        let child = this.tiles.get(this.key(level - 1, ctx2, cty));
        if (!child || !child.fresh) { this.render(level - 1, ctx2, cty); child = this.tiles.get(this.key(level - 1, ctx2, cty)); }
        if (!child) continue;
        const cw = Math.min(TILE, Math.ceil((this.doc.width - ctx2 * (TILE << (level - 1))) / (1 << (level - 1))));
        const b = child.bytes;
        const ox = cx * (TILE / 2), oy = cy * (TILE / 2);
        const chh = b.length / 4 / cw;
        for (let yy = 0; yy < chh; yy++) for (let xx = 0; xx < cw; xx++) {
          const dx = ox + (xx >> 1), dy = oy + (yy >> 1);
          if (dx >= w || dy >= h) continue;
          const si = (yy * cw + xx) * 4, d = dy * w + dx, a = b[si + 3]! / 255;
          acc[d * 4]! += b[si]! * a; acc[d * 4 + 1]! += b[si + 1]! * a; acc[d * 4 + 2]! += b[si + 2]! * a; acc[d * 4 + 3]! += a;
          cnt[d]! += 1;
        }
      }
      for (let p = 0; p < w * h; p++) {
        const n = cnt[p]!;
        if (!n) continue;
        const a = acc[p * 4 + 3]!;
        if (a > 0) { bytes[p * 4] = acc[p * 4]! / a; bytes[p * 4 + 1] = acc[p * 4 + 1]! / a; bytes[p * 4 + 2] = acc[p * 4 + 2]! / a; }
        bytes[p * 4 + 3] = (a / n) * 255;
      }
    }
    const shown = this.transform ? bytes.slice() : bytes;
    if (this.transform) this.transform(shown, { x, y, w: w << level, h: h << level });
    let e = this.tiles.get(k);
    const canvas = e && e.canvas.width === w && e.canvas.height === h ? e.canvas : makeCanvas(w, h);
    if (!canvas) return null;
    const ctx = canvas.getContext("2d") as CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null;
    if (ctx) ctx.putImageData(new ImageData(new Uint8ClampedArray(shown), w, h), 0, 0);
    e = { canvas, bytes, fresh: true };
    this.tiles.set(k, e);
    return canvas;
  }

  /** Mark tiles touching a region stale on every level (null = all). */
  invalidate(r: Rect | null): void {
    if (!r) { for (const e of this.tiles.values()) e.fresh = false; return; }
    for (let l = 0; l <= MAX_LEVEL; l++) {
      const s = this.span(l);
      const x0 = Math.floor(r.x / s), y0 = Math.floor(r.y / s), x1 = Math.floor((r.x + r.w - 1) / s), y1 = Math.floor((r.y + r.h - 1) / s);
      for (let ty = y0; ty <= y1; ty++) for (let tx = x0; tx <= x1; tx++) { const e = this.tiles.get(this.key(l, tx, ty)); if (e) e.fresh = false; }
    }
  }

  /** Forget everything (document resized). */
  clear(): void { this.tiles.clear(); }

  bytes(): number { let n = 0; for (const e of this.tiles.values()) n += e.bytes.length; return n; }

  /** Drop tiles farthest from a doc point until under the limit. */
  evict(cx: number, cy: number): void {
    if (this.bytes() <= this.limit) return;
    const list = [...this.tiles.entries()].map(([k, e]) => {
      const [l, tx, ty] = k.split(":").map(Number) as [number, number, number];
      const s = TILE << l;
      return { k, e, d: Math.hypot(tx * s + s / 2 - cx, ty * s + s / 2 - cy) };
    }).sort((a, b) => b.d - a.d);
    let total = this.bytes();
    for (const t of list) { if (total <= this.limit * 0.8) break; this.tiles.delete(t.k); total -= t.e.bytes.length; }
  }
}
