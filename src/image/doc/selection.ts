// The selection engine: an 8-bit mask the document's size. Shapes (rectangle, ellipse, polygon / lasso, single row and
// column, path), combine (new, add, subtract, intersect), modify (feather, expand, contract, border, smooth, invert),
// magic wand / select similar / color range, save and load through alpha channels, marching ants outline.

import { blurPlane, distanceTo, maskToPlane, planeToMask } from "./alpha.ts";
import type { AlphaChannel, ImageDocument } from "./document.ts";
import { newId, type RGBA } from "./layers.ts";
import { fillPolygons, pathToMask, type PathData } from "./paths.ts";
import { Mask, type Rect } from "./tiles.ts";
import { renderRegion } from "./composite.ts";

/** How a new shape combines with the selection. @tr Yeni seçimin eskisiyle birleşimi. */
export type SelectOp = "new" | "add" | "subtract" | "intersect";

/** Combine `shape` into the document selection. */
export function combine(doc: ImageDocument, shape: Mask, op: SelectOp): void {
  if (op === "new" || !doc.selection) {
    doc.selection = op === "subtract" ? null : shape.isEmpty() ? null : shape;
    if (op === "intersect") doc.selection = null;
    return;
  }
  const s = doc.selection.clone(), d = s.writable(), m = shape.data;
  for (let i = 0; i < d.length; i++) {
    if (op === "add") d[i] = Math.max(d[i]!, m[i]!);
    else if (op === "subtract") d[i] = Math.round((d[i]! * (255 - m[i]!)) / 255);
    else d[i] = Math.round((d[i]! * m[i]!) / 255);
  }
  doc.selection = s.isEmpty() ? null : s;
}

const newMask = (doc: ImageDocument): Mask => new Mask(doc.width, doc.height);

/** Rectangle (optionally rounded / feathered). */
export function rectMask(doc: ImageDocument, r: Rect, antialias = true): Mask {
  const m = newMask(doc), d = m.data;
  const x0 = Math.max(0, Math.floor(r.x)), y0 = Math.max(0, Math.floor(r.y));
  const x1 = Math.min(doc.width, Math.ceil(r.x + r.w)), y1 = Math.min(doc.height, Math.ceil(r.y + r.h));
  for (let y = y0; y < y1; y++) {
    const cy = antialias ? Math.min(1, y + 1 - r.y, r.y + r.h - y) : 1;
    for (let x = x0; x < x1; x++) {
      const cx = antialias ? Math.min(1, x + 1 - r.x, r.x + r.w - x) : 1;
      d[y * doc.width + x] = Math.round(Math.max(0, Math.min(1, cx)) * Math.max(0, Math.min(1, cy)) * 255);
    }
  }
  return m;
}

export function ellipseMask(doc: ImageDocument, r: Rect, antialias = true): Mask {
  const m = newMask(doc), cx = r.x + r.w / 2, cy = r.y + r.h / 2, k = 64, pts: [number, number][] = [];
  const n = Math.max(32, Math.min(720, Math.round((r.w + r.h) / 2)));
  for (let i = 0; i < n; i++) pts.push([cx + Math.cos((i / n) * Math.PI * 2) * (r.w / 2), cy + Math.sin((i / n) * Math.PI * 2) * (r.h / 2)]);
  void k;
  const d = m.data;
  fillPolygons([pts], "nonzero", doc.bounds, (x, y, c) => { d[y * doc.width + x] = antialias ? Math.round(c * 255) : c >= 0.5 ? 255 : 0; });
  return m;
}

/** Freehand, polygonal and magnetic lasso all end as a polygon. */
export function polygonMask(doc: ImageDocument, pts: [number, number][], antialias = true): Mask {
  const m = newMask(doc), d = m.data;
  if (pts.length < 3) return m;
  fillPolygons([pts], "evenodd", doc.bounds, (x, y, c) => { d[y * doc.width + x] = antialias ? Math.round(c * 255) : c >= 0.5 ? 255 : 0; });
  return m;
}

export function rowMask(doc: ImageDocument, y: number): Mask {
  const m = newMask(doc);
  if (y >= 0 && y < doc.height) m.data.fill(255, y * doc.width, (y + 1) * doc.width);
  return m;
}
export function columnMask(doc: ImageDocument, x: number): Mask {
  const m = newMask(doc);
  if (x >= 0 && x < doc.width) for (let y = 0; y < doc.height; y++) m.data[y * doc.width + x] = 255;
  return m;
}

export const pathMask = (doc: ImageDocument, p: PathData, antialias = true): Mask => pathToMask(p, doc.width, doc.height, antialias);

// ——— whole selection commands (call inside doc.change) ———

export function selectAll(doc: ImageDocument): void { doc.selection = new Mask(doc.width, doc.height, 255); }

let lastSelection: Mask | null = null;
export function deselect(doc: ImageDocument): void {
  if (doc.selection) lastSelection = doc.selection;
  doc.selection = null;
}
export function reselect(doc: ImageDocument): void { if (lastSelection && lastSelection.width === doc.width && lastSelection.height === doc.height) doc.selection = lastSelection; }

export function invert(doc: ImageDocument): void {
  if (!doc.selection) { selectAll(doc); return; }
  const s = doc.selection.clone(), d = s.writable();
  for (let i = 0; i < d.length; i++) d[i] = 255 - d[i]!;
  doc.selection = s.isEmpty() ? null : s;
}

/** Soften the edge (Gaussian, radius in pixels). */
export function feather(doc: ImageDocument, radius: number): void {
  if (!doc.selection || radius <= 0) return;
  const s = doc.selection.clone(), p = maskToPlane(s);
  blurPlane(p, s.width, s.height, radius);
  planeToMask(p, s);
  doc.selection = s;
}

/** Grow (n > 0) or shrink (n < 0) by n pixels, round corners like the classic command. */
export function expand(doc: ImageDocument, n: number): void {
  if (!doc.selection || !n) return;
  const s = doc.selection.clone(), d0 = s.data, w = s.width, h = s.height;
  const grow = n > 0, r = Math.abs(n);
  const dist = distanceTo((i) => (grow ? d0[i]! >= 128 : d0[i]! < 128), w, h);
  const d = s.writable();
  for (let i = 0; i < d.length; i++) {
    if (grow) d[i] = dist[i]! <= r ? 255 : dist[i]! < r + 1 ? Math.round((r + 1 - dist[i]!) * 255) : 0;
    else d[i] = dist[i]! <= r ? 0 : Math.min(d[i]!, dist[i]! < r + 1 ? Math.round((dist[i]! - r) * 255) : 255);
  }
  doc.selection = s.isEmpty() ? null : s;
}
export const contract = (doc: ImageDocument, n: number): void => expand(doc, -Math.abs(n));

/** A band `width` pixels wide around the selection edge (half in, half out), soft edged. */
export function border(doc: ImageDocument, width: number): void {
  if (!doc.selection || width <= 0) return;
  const s = doc.selection, w = s.width, h = s.height, d0 = s.data;
  const inside = distanceTo((i) => d0[i]! < 128, w, h), outside = distanceTo((i) => d0[i]! >= 128, w, h);
  const half = width / 2, out = new Mask(w, h), d = out.data;
  for (let i = 0; i < d.length; i++) {
    const dist = d0[i]! >= 128 ? inside[i]! : outside[i]!;
    d[i] = dist <= half ? 255 : dist < half + 1 ? Math.round((half + 1 - dist) * 255) : 0;
  }
  doc.selection = out;
  feather(doc, Math.min(width / 4, 4));
}

/** Smooth: majority filter of the given radius (removes stray pixels, rounds corners). */
export function smooth(doc: ImageDocument, radius: number): void {
  if (!doc.selection || radius <= 0) return;
  const s = doc.selection.clone(), p = maskToPlane(s);
  blurPlane(p, s.width, s.height, radius);
  for (let i = 0; i < p.length; i++) p[i] = p[i]! >= 0.5 ? 1 : 0;
  planeToMask(p, s);
  doc.selection = s;
}

// ——— color based ———

export interface WandOptions { tolerance: number; contiguous: boolean; sampleAll: boolean; antialias: boolean; sampleSize?: 1 | 3 | 5 }

/** The pixels a color selection reads: the active layer or the merged image (straight RGBA). */
function samplePixels(doc: ImageDocument, sampleAll: boolean): Float32Array {
  const all = renderRegion(doc, doc.bounds);
  if (sampleAll) {
    for (let i = 0; i < all.length; i += 4) { const a = all[i + 3]!; if (a > 0) { all[i]! /= a; all[i + 1]! /= a; all[i + 2]! /= a; } }
    return all;
  }
  const l = doc.active;
  if (l && "raster" in l) return l.raster.read(0, 0, doc.width, doc.height);
  return samplePixels(doc, true);
}

function colorAt(px: Float32Array, w: number, h: number, x: number, y: number, size: number): RGBA {
  const r = (size - 1) >> 1, c: RGBA = [0, 0, 0, 0];
  let n = 0;
  for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) {
    if (xx < 0 || yy < 0 || xx >= w || yy >= h) continue;
    const i = (yy * w + xx) * 4;
    c[0]! += px[i]!; c[1]! += px[i + 1]!; c[2]! += px[i + 2]!; c[3]! += px[i + 3]!; n++;
  }
  return c.map((v) => v / (n || 1)) as RGBA;
}

/** Magic wand at (x, y). */
export function wandMask(doc: ImageDocument, x: number, y: number, o: WandOptions): Mask {
  const w = doc.width, h = doc.height, px = samplePixels(doc, o.sampleAll);
  const ref = colorAt(px, w, h, Math.round(x), Math.round(y), o.sampleSize ?? 1);
  const tol = o.tolerance / 255;
  const diff = (i: number): number => Math.max(Math.abs(px[i]! - ref[0]!), Math.abs(px[i + 1]! - ref[1]!), Math.abs(px[i + 2]! - ref[2]!), Math.abs(px[i + 3]! - ref[3]!));
  const m = new Mask(w, h), d = m.data;
  if (!o.contiguous) {
    for (let p = 0; p < w * h; p++) {
      const df = diff(p * 4);
      d[p] = df <= tol ? 255 : o.antialias && df <= tol + 1 / 255 * 2 ? 128 : 0;
    }
    return m;
  }
  const x0 = Math.round(x), y0 = Math.round(y);
  if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return m;
  // scanline flood fill
  const stack: number[] = [x0, y0];
  const seen = new Uint8Array(w * h);
  while (stack.length) {
    const sy = stack.pop()!, sx = stack.pop()!;
    let lx = sx;
    while (lx >= 0 && !seen[sy * w + lx]! && diff((sy * w + lx) * 4) <= tol) lx--;
    lx++;
    let rx = sx;
    while (rx < w && !seen[sy * w + rx]! && diff((sy * w + rx) * 4) <= tol) rx++;
    for (let xx = lx; xx < rx; xx++) {
      seen[sy * w + xx] = 1; d[sy * w + xx] = 255;
      for (const ny of [sy - 1, sy + 1]) {
        if (ny < 0 || ny >= h) continue;
        const k = ny * w + xx;
        if (!seen[k]! && diff(k * 4) <= tol && (xx === lx || seen[k - 1]! || diff((k - 1) * 4) > tol)) stack.push(xx, ny);
      }
    }
  }
  if (o.antialias) {
    // soften the stair steps along the edge
    const p = maskToPlane(m);
    blurPlane(p, w, h, 0.8);
    for (let i = 0; i < p.length; i++) d[i] = d[i]! === 255 ? 255 : Math.round(p[i]! * 255);
  }
  return m;
}

/** Select › Grow (contiguous) and Similar (everywhere) with the wand's tolerance, starting from the selection. */
export function growSimilar(doc: ImageDocument, tolerance: number, contiguous: boolean): void {
  if (!doc.selection) return;
  const sel = doc.selection, px = samplePixels(doc, true), w = doc.width;
  const colors: number[][] = [];
  for (let i = 0; i < sel.data.length && colors.length < 256; i += Math.max(1, Math.floor(sel.data.length / 4096))) if (sel.data[i]! >= 128) colors.push([px[i * 4]!, px[i * 4 + 1]!, px[i * 4 + 2]!]);
  const tol = tolerance / 255;
  const near = (i: number): boolean => colors.some((c) => Math.abs(px[i * 4]! - c[0]!) <= tol && Math.abs(px[i * 4 + 1]! - c[1]!) <= tol && Math.abs(px[i * 4 + 2]! - c[2]!) <= tol);
  const out = sel.clone(), d = out.writable();
  if (!contiguous) { for (let i = 0; i < d.length; i++) if (near(i)) d[i] = 255; }
  else {
    const q: number[] = [];
    for (let i = 0; i < d.length; i++) if (d[i]! >= 128) q.push(i);
    while (q.length) {
      const i = q.pop()!, x = i % w;
      for (const k of [i - w, i + w, x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1]) if (k >= 0 && k < d.length && d[k]! < 128 && near(k)) { d[k] = 255; q.push(k); }
    }
  }
  doc.selection = out;
}

/** Select › Color Range: by a sampled color with fuzziness, or a preset (reds, yellows, …, highlights, midtones, shadows, skin tones). */
export function colorRange(doc: ImageDocument, o: { color?: RGBA | undefined; fuzziness: number; preset?: "reds" | "yellows" | "greens" | "cyans" | "blues" | "magentas" | "highlights" | "midtones" | "shadows" | "skin" | undefined; invert?: boolean }): Mask {
  const px = samplePixels(doc, true), m = newMask(doc), d = m.data, fz = Math.max(1, o.fuzziness) / 255;
  for (let p = 0; p < d.length; p++) {
    const i = p * 4, r = px[i]!, g = px[i + 1]!, b = px[i + 2]!;
    let v = 0;
    if (o.preset) {
      const mx = Math.max(r, g, b), mn = Math.min(r, g, b), l = 0.299 * r + 0.587 * g + 0.114 * b, s = mx - mn;
      let hue = 0;
      if (s > 0) hue = mx === r ? ((g - b) / s) % 6 : mx === g ? (b - r) / s + 2 : (r - g) / s + 4;
      hue = ((hue * 60) + 360) % 360;
      const near = (c: number, width = 30): number => Math.max(0, 1 - Math.min(Math.abs(hue - c), 360 - Math.abs(hue - c)) / width) * Math.min(1, s * 4);
      switch (o.preset) {
        case "reds": v = near(0); break; case "yellows": v = near(60); break; case "greens": v = near(120); break;
        case "cyans": v = near(180); break; case "blues": v = near(240); break; case "magentas": v = near(300); break;
        case "highlights": v = Math.max(0, Math.min(1, (l - 0.6) / 0.25)); break;
        case "shadows": v = Math.max(0, Math.min(1, (0.4 - l) / 0.25)); break;
        case "midtones": v = Math.max(0, 1 - Math.abs(l - 0.5) / 0.25); break;
        case "skin": v = near(25, 25) * (l > 0.2 && l < 0.95 ? 1 : 0); break;
      }
    } else if (o.color) {
      const dist = Math.max(Math.abs(r - o.color[0]!), Math.abs(g - o.color[1]!), Math.abs(b - o.color[2]!));
      v = Math.max(0, 1 - dist / fz);
    }
    if (o.invert) v = 1 - v;
    d[p] = Math.round(v * 255);
  }
  return m;
}

// ——— channels ———

/** Select › Save Selection: a new alpha channel (or combine into an existing one). */
export function saveToChannel(doc: ImageDocument, name = "Alpha", into?: string, op: SelectOp = "new"): AlphaChannel | null {
  if (!doc.selection) return null;
  if (into) {
    const ch = doc.channels.find((c) => c.id === into);
    if (!ch) return null;
    const keep = doc.selection;
    doc.selection = ch.mask.clone();
    combine(doc, keep, op);
    ch.mask = doc.selection ?? new Mask(doc.width, doc.height);
    doc.selection = keep;
    return ch;
  }
  const ch: AlphaChannel = { id: newId("c"), name: `${name} ${doc.channels.length + 1}`, mask: doc.selection.clone(), visible: false, color: [1, 0, 0, 1], opacity: 0.5 };
  doc.channels = [...doc.channels, ch];
  return ch;
}

/** Select › Load Selection (Ctrl+click a channel / layer thumbnail). */
export function loadFromChannel(doc: ImageDocument, id: string, op: SelectOp = "new", invertIt = false): void {
  const ch = doc.channels.find((c) => c.id === id);
  if (!ch) return;
  let m = ch.mask.clone();
  if (invertIt) { m = m.clone(); const d = m.writable(); for (let i = 0; i < d.length; i++) d[i] = 255 - d[i]!; }
  combine(doc, m, op);
}

/** A layer's transparency as a selection (Ctrl+click the layer thumbnail). */
export function layerAlphaMask(doc: ImageDocument, layerId: string): Mask {
  const l = doc.find(layerId), m = newMask(doc);
  if (!l || !("raster" in l)) return m;
  const px = l.raster.read(0, 0, doc.width, doc.height), d = m.data;
  for (let i = 0; i < d.length; i++) d[i] = Math.round(px[i * 4 + 3]! * 255);
  return m;
}

/** Luminosity of the composite as a selection (Ctrl+Alt+2). */
export function luminosityMask(doc: ImageDocument): Mask {
  const px = renderRegion(doc, doc.bounds), m = newMask(doc), d = m.data;
  for (let i = 0; i < d.length; i++) { const k = i * 4; d[i] = Math.round((0.299 * px[k]! + 0.587 * px[k + 1]! + 0.114 * px[k + 2]!) * 255); }
  return m;
}

// ——— marching ants ———

/**
 * The selection edge as line segments [x1, y1, x2, y2] on pixel borders (threshold 50 %), joined into polylines for
 * a dashed stroke. Large documents: pass a step > 1 for a coarser preview outline.
 */
export function outline(m: Mask, step = 1): number[][] {
  const w = m.width, h = m.height, d = m.data;
  const on = (x: number, y: number): boolean => x >= 0 && y >= 0 && x < w && y < h && d[Math.min(h - 1, y) * w + Math.min(w - 1, x)]! >= 128;
  const segs: number[][] = [];
  for (let y = 0; y <= h; y += step) {
    let start = -1;
    for (let x = 0; x <= w; x += step) {
      const edge = x < w && on(x, y) !== on(x, y - step);
      if (edge && start < 0) start = x;
      if (!edge && start >= 0) { segs.push([start, y, x, y]); start = -1; }
    }
  }
  for (let x = 0; x <= w; x += step) {
    let start = -1;
    for (let y = 0; y <= h; y += step) {
      const edge = y < h && on(x, y) !== on(x - step, y);
      if (edge && start < 0) start = y;
      if (!edge && start >= 0) { segs.push([x, start, x, y]); start = -1; }
    }
  }
  return segs;
}

/** Make a work path from the selection (Paths panel › Make Work Path): the outline traced into polygons. */
export function selectionToPath(m: Mask, tolerance = 2): PathData {
  const segs = outline(m);
  // join segments end to end
  const key = (x: number, y: number): string => `${x},${y}`;
  const byStart = new Map<string, number[][]>();
  for (const s of segs) {
    for (const [a, b] of [[0, 1], [2, 3]] as const) { const k = key(s[a]!, s[b]!); if (!byStart.has(k)) byStart.set(k, []); byStart.get(k)!.push(s); }
  }
  const used = new Set<number[]>(), polys: [number, number][][] = [];
  for (const s of segs) {
    if (used.has(s)) continue;
    used.add(s);
    const poly: [number, number][] = [[s[0]!, s[1]!], [s[2]!, s[3]!]];
    for (;;) {
      const [lx, ly] = poly[poly.length - 1]!;
      const next = (byStart.get(key(lx, ly)) ?? []).find((t) => !used.has(t));
      if (!next) break;
      used.add(next);
      poly.push(next[0]! === lx && next[1]! === ly ? [next[2]!, next[3]!] : [next[0]!, next[1]!]);
    }
    polys.push(simplify(poly, tolerance));
  }
  return { fillRule: "evenodd", subpaths: polys.filter((p) => p.length > 2).map((p) => ({ closed: true, anchors: p.map(([x, y]) => ({ x, y, ix: x, iy: y, ox: x, oy: y, type: "corner" as const })) })) };
}

/** Douglas–Peucker. */
export function simplify(pts: [number, number][], tol: number): [number, number][] {
  if (pts.length < 3) return pts;
  // a closed ring (first point = last): split at the point farthest from the start, simplify both halves
  const f = pts[0]!, l = pts[pts.length - 1]!;
  if (f[0] === l[0] && f[1] === l[1] && pts.length > 3) {
    let far = 1, fd = -1;
    for (let i = 1; i < pts.length - 1; i++) { const d = Math.hypot(pts[i]![0] - f[0], pts[i]![1] - f[1]); if (d > fd) { fd = d; far = i; } }
    const a = simplify(pts.slice(0, far + 1), tol), b = simplify(pts.slice(far), tol);
    return [...a, ...b.slice(1)];
  }
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack: [number, number][] = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let far = -1, fd = tol;
    const [ax, ay] = pts[a]!, [bx, by] = pts[b]!, L = Math.hypot(bx - ax, by - ay) || 1;
    for (let i = a + 1; i < b; i++) {
      const d = Math.abs((by - ay) * pts[i]![0]! - (bx - ax) * pts[i]![1]! + bx * ay - by * ax) / L;
      if (d > fd) { fd = d; far = i; }
    }
    if (far >= 0) { keep[far] = 1; stack.push([a, far], [far, b]); }
  }
  return pts.filter((_, i) => keep[i]!);
}
