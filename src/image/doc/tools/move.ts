// Move tool (V): auto-select the layer or group under the pointer (topmost non-transparent pixel), drag the selected
// layers — or, with a pixel selection, cut the selected pixels and float them (one step), Alt duplicates, Shift
// constrains to 0 / 45 / 90°, arrow keys nudge 1 px (Shift 10 px). Smart guides snap the moving bounds to the
// document's edges and center, other layers' edges and centers, guides and the grid, with lines and distance labels.
// Align and distribute work on the selected layers, to the selection, or to the canvas.

import { layerBounds } from "../bounds.ts";
import type { ImageDocument } from "../document.ts";
import { hasRaster, isContainer, walk, type Layer } from "../layers.ts";
import { pathBounds, transformPath } from "../paths.ts";
import { Mask, rectUnion, type Rect } from "../tiles.ts";
import type { OverlayShape, PointerSample, Tool, ToolContext } from "./tool.ts";

// ——— geometry helpers ———

/** Bounds of a layer's visible content in document pixels (containers: their children; fill / adjustment: null). */

/** Shift a mask's pixels by whole pixels (journaled). */
export function shiftMask(m: Mask, dx: number, dy: number): void {
  dx = Math.round(dx); dy = Math.round(dy);
  if (!dx && !dy) return;
  const w = m.width, h = m.height, src = m.data.slice(), d = m.writable();
  d.fill(m.outside);
  for (let y = 0; y < h; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= h) continue;
    const x0 = Math.max(0, dx), x1 = Math.min(w, w + dx);
    if (x1 > x0) d.set(src.subarray(sy * w + x0 - dx, sy * w + x1 - dx), y * w + x0);
  }
}

/** A shifted copy of a mask (new array). */
export function shiftedMask(m: Mask, dx: number, dy: number): Mask {
  const out = new Mask(m.width, m.height);
  out.outside = m.outside;
  const w = m.width, h = m.height;
  dx = Math.round(dx); dy = Math.round(dy);
  for (let y = 0; y < h; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= h) continue;
    const x0 = Math.max(0, dx), x1 = Math.min(w, w + dx);
    if (x1 > x0) out.data.set(m.data.subarray(sy * w + x0 - dx, sy * w + x1 - dx), y * w + x0);
  }
  return out;
}

/**
 * Move a layer (and its children) by whole pixels: raster offsets, shape and vector-mask paths, text frames, artboard
 * rectangles; linked layer masks too unless `masks` is false (a drag shifts masks once at the end).
 */
export function translateLayer(l: Layer, dx: number, dy: number, masks = true): void {
  dx = Math.round(dx); dy = Math.round(dy);
  if (!dx && !dy) return;
  const m = [1, 0, 0, 1, dx, dy];
  for (const [x] of walk([l])) {
    if (hasRaster(x)) { x.raster.ox += dx; x.raster.oy += dy; x.raster.version++; }
    if (x.kind === "shape") x.path = transformPath(x.path, m);
    if (x.kind === "text") {
      const f = x.text.frame;
      if (f.type === "path") x.text.frame = { ...f, path: transformPath(f.path, m) };
      else x.text.frame = { ...f, x: f.x + dx, y: f.y + dy };
    }
    if (x.kind === "smart") {
      // T · M: rows 0 and 1 gain dx / dy times row 2 (projective placement)
      const k = [...x.matrix];
      for (let c = 0; c < 3; c++) { k[c] = (k[c] ?? 0) + dx * (k[6 + c] ?? (c === 2 ? 1 : 0)); k[3 + c] = (k[3 + c] ?? 0) + dy * (k[6 + c] ?? (c === 2 ? 1 : 0)); }
      x.matrix = k;
    }
    if (x.kind === "artboard") x.rect = { ...x.rect, x: x.rect.x + dx, y: x.rect.y + dy };
    if (x.vectorMask?.linked) x.vectorMask = { ...x.vectorMask, path: transformPath(x.vectorMask.path, m) };
    if (masks && x.mask?.linked) shiftMask(x.mask.mask, dx, dy);
  }
}

/** The layers a move acts on: the selected layers (the active one when none), without locked ones or nested repeats. */
export function moveTargets(doc: ImageDocument): Layer[] {
  const ids = doc.selected.length ? doc.selected : doc.activeId ? [doc.activeId] : [];
  const set = new Set(ids), out: Layer[] = [];
  const visit = (list: Layer[], covered: boolean): void => {
    for (const l of list) {
      const take = !covered && set.has(l.id) && !l.locks.position;
      if (take) out.push(l);
      if (isContainer(l)) visit(l.children, covered || take);
    }
  };
  visit(doc.layers, false);
  return out;
}

/** The topmost layer with a visible pixel at (x, y): `group` returns its outermost group instead. */
export function layerAt(doc: ImageDocument, x: number, y: number, target: "layer" | "group" = "layer", threshold = 0.02): Layer | null {
  const all = [...walk(doc.layers)].reverse();
  const xi = Math.floor(x), yi = Math.floor(y);
  for (const [l] of all) {
    if (isContainer(l) || l.kind === "adjustment" || !doc.visibleInTree(l.id)) continue;
    let a = 1;
    if (hasRaster(l)) a = l.raster.get(xi, yi)[3] * l.opacity;
    if (l.mask?.enabled) { const v = l.mask.mask.get(xi, yi) / 255; a *= 1 - l.mask.density * (1 - (l.mask.invert ? 1 - v : v)); }
    if (a <= threshold) continue;
    if (target === "group") {
      let loc = doc.locate(l.id), top: Layer = l;
      while (loc?.parent) { top = loc.parent; loc = doc.locate(loc.parent.id); }
      return top;
    }
    return l;
  }
  return null;
}

// ——— smart guides ———

export interface SnapOptions {
  /** Snap distance in document pixels. */
  threshold: number;
  edges?: boolean | undefined;
  layers?: boolean | undefined;
  guides?: boolean | undefined;
  grid?: boolean | undefined;
}
export interface SnapResult { dx: number; dy: number; overlay: OverlayShape[] }

/** Candidate rectangles for snapping (computed once per drag). */
export function snapTargets(doc: ImageDocument, exclude: Set<string>): Rect[] {
  const out: Rect[] = [];
  for (const l of doc.layers) {
    if (exclude.has(l.id) || !l.visible || doc.isBackground(l)) continue;
    const b = layerBounds(doc, l);
    if (b) out.push(b);
  }
  return out;
}

const GUIDE_COLOR = "#ff3ea5";

/** Snap a moving rectangle: the offset to add, plus smart guide lines and distance labels. */
export function snapRect(doc: ImageDocument, r: Rect, targets: Rect[], o: SnapOptions): SnapResult {
  const xs: { v: number; r: Rect | null }[] = [], ys: { v: number; r: Rect | null }[] = [];
  if (o.edges !== false) {
    const D = doc.bounds;
    for (const v of [0, doc.width / 2, doc.width]) xs.push({ v, r: D });
    for (const v of [0, doc.height / 2, doc.height]) ys.push({ v, r: D });
  }
  if (o.layers !== false) for (const t of targets) {
    for (const v of [t.x, t.x + t.w / 2, t.x + t.w]) xs.push({ v, r: t });
    for (const v of [t.y, t.y + t.h / 2, t.y + t.h]) ys.push({ v, r: t });
  }
  if (o.guides !== false) for (const g of doc.guides) (g.axis === "x" ? xs : ys).push({ v: g.pos, r: null });
  const best = (edges: number[], cands: { v: number; r: Rect | null }[]): { d: number; v: number; r: Rect | null } | null => {
    let b: { d: number; v: number; r: Rect | null } | null = null;
    for (const e of edges) for (const c of cands) {
      const d = c.v - e;
      if (Math.abs(d) <= o.threshold && (!b || Math.abs(d) < Math.abs(b.d))) b = { d, v: c.v, r: c.r };
    }
    return b;
  };
  let bx = best([r.x, r.x + r.w / 2, r.x + r.w], xs), by = best([r.y, r.y + r.h / 2, r.y + r.h], ys);
  if (o.grid && doc.grid.visible) {
    const step = doc.grid.every / Math.max(1, doc.grid.subdivisions);
    const g = (v: number): number => Math.round(v / step) * step - v;
    if (!bx) { const d = g(r.x); if (Math.abs(d) <= o.threshold) bx = { d, v: r.x + d, r: null }; }
    if (!by) { const d = g(r.y); if (Math.abs(d) <= o.threshold) by = { d, v: r.y + d, r: null }; }
  }
  const dx = bx ? bx.d : 0, dy = by ? by.d : 0;
  const m: Rect = { x: r.x + dx, y: r.y + dy, w: r.w, h: r.h };
  const overlay: OverlayShape[] = [];
  if (bx) {
    const y0 = Math.min(m.y, bx.r ? bx.r.y : 0), y1 = Math.max(m.y + m.h, bx.r ? bx.r.y + bx.r.h : doc.height);
    overlay.push({ type: "line", x1: bx.v, y1: y0, x2: bx.v, y2: y1, color: GUIDE_COLOR });
  }
  if (by) {
    const x0 = Math.min(m.x, by.r ? by.r.x : 0), x1 = Math.max(m.x + m.w, by.r ? by.r.x + by.r.w : doc.width);
    overlay.push({ type: "line", x1: x0, y1: by.v, x2: x1, y2: by.v, color: GUIDE_COLOR });
  }
  // distance labels to the nearest neighbours that overlap on the other axis
  let left: Rect | null = null, right: Rect | null = null, above: Rect | null = null, below: Rect | null = null;
  for (const t of targets) {
    const vOverlap = t.y < m.y + m.h && t.y + t.h > m.y, hOverlap = t.x < m.x + m.w && t.x + t.w > m.x;
    if (vOverlap && t.x + t.w <= m.x && (!left || t.x + t.w > left.x + left.w)) left = t;
    if (vOverlap && t.x >= m.x + m.w && (!right || t.x < right.x)) right = t;
    if (hOverlap && t.y + t.h <= m.y && (!above || t.y + t.h > above.y + above.h)) above = t;
    if (hOverlap && t.y >= m.y + m.h && (!below || t.y < below.y)) below = t;
  }
  const cy = m.y + m.h / 2, cx = m.x + m.w / 2;
  const hLabel = (a: number, b: number): void => { overlay.push({ type: "line", x1: a, y1: cy, x2: b, y2: cy, color: GUIDE_COLOR }, { type: "label", x: (a + b) / 2, y: cy, text: `${Math.round(b - a)} px` }); };
  const vLabel = (a: number, b: number): void => { overlay.push({ type: "line", x1: cx, y1: a, x2: cx, y2: b, color: GUIDE_COLOR }, { type: "label", x: cx, y: (a + b) / 2, text: `${Math.round(b - a)} px` }); };
  if (left) hLabel(left.x + left.w, m.x);
  if (right) hLabel(m.x + m.w, right.x);
  if (above) vLabel(above.y + above.h, m.y);
  if (below) vLabel(m.y + m.h, below.y);
  return { dx, dy, overlay };
}

/** Constrain a drag vector to 0 / 45 / 90° (Shift). */
export function constrain45(dx: number, dy: number): [number, number] {
  const a = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(dx, dy) * Math.cos(Math.atan2(dy, dx) - a);
  return [Math.round(Math.cos(a) * len), Math.round(Math.sin(a) * len)];
}

// ——— floating selection ———

/** Cut (or copy, `keep`) the selected pixels of a raster layer into a float. Call inside a change. */
interface Float { layer: Layer & { raster: import("../tiles.ts").TiledRaster }; sel: Mask; bounds: Rect; px: Float32Array; at: Rect | null; under: Float32Array | null }

function cutFloat(doc: ImageDocument, layer: Float["layer"], keep: boolean, bg: number[]): Float | null {
  const sel = doc.selection;
  if (!sel) return null;
  const b = sel.bounds();
  if (!b) return null;
  const src = layer.raster.read(b.x, b.y, b.w, b.h), px = new Float32Array(src.length);
  const isBg = doc.isBackground(layer);
  for (let y = 0; y < b.h; y++) for (let x = 0; x < b.w; x++) {
    const p = y * b.w + x, i = p * 4, c = sel.data[(b.y + y) * sel.width + b.x + x]! / 255;
    px[i] = src[i]!; px[i + 1] = src[i + 1]!; px[i + 2] = src[i + 2]!; px[i + 3] = src[i + 3]! * c;
    if (!keep) {
      if (isBg) for (let k = 0; k < 3; k++) src[i + k] = src[i + k]! * (1 - c) + bg[k]! * c;
      else src[i + 3] = src[i + 3]! * (1 - c);
    }
  }
  if (!keep) layer.raster.write(b.x, b.y, b.w, b.h, src);
  return { layer, sel, bounds: b, px, at: null, under: null };
}

/** Place the float at an offset (restoring what it covered at its previous place). */
function placeFloat(f: Float, dx: number, dy: number): Rect {
  const r = f.layer.raster;
  if (f.at && f.under) r.write(f.at.x, f.at.y, f.at.w, f.at.h, f.under);
  const at: Rect = { x: f.bounds.x + dx, y: f.bounds.y + dy, w: f.bounds.w, h: f.bounds.h };
  const under = r.read(at.x, at.y, at.w, at.h), out = under.slice(), s = f.px;
  for (let i = 0; i < out.length; i += 4) {
    const fa = s[i + 3]!;
    if (fa <= 0) continue;
    const ua = out[i + 3]!, oa = fa + ua * (1 - fa);
    for (let k = 0; k < 3; k++) out[i + k] = (s[i + k]! * fa + out[i + k]! * ua * (1 - fa)) / oa;
    out[i + 3] = oa;
  }
  r.write(at.x, at.y, at.w, at.h, out);
  const prev = f.at;
  f.at = at; f.under = under;
  return rectUnion(prev, at)!;
}

/** Move the selected pixels of the active layer by (dx, dy) as one step (nudge, scripts). */
export function moveSelectedPixels(doc: ImageDocument, dx: number, dy: number, o: { duplicate?: boolean; bg?: number[] } = {}): boolean {
  const l = doc.active;
  if (!l || !hasRaster(l) || !doc.selection || l.locks.pixels) return false;
  doc.change(o.duplicate ? "Duplicate Selection" : "Move Selection", () => {
    const f = cutFloat(doc, l, !!o.duplicate, o.bg ?? [1, 1, 1]);
    if (!f) return;
    placeFloat(f, Math.round(dx), Math.round(dy));
    doc.selection = shiftedMask(f.sel, dx, dy);
  });
  return true;
}

/** Move the target layers by (dx, dy) as one step. */
export function nudgeLayers(doc: ImageDocument, dx: number, dy: number): void {
  const t = moveTargets(doc);
  if (!t.length) return;
  doc.change("Nudge", () => { for (const l of t) translateLayer(l, dx, dy); });
}

// ——— align and distribute ———

export type AlignEdge = "left" | "hcenter" | "right" | "top" | "vcenter" | "bottom";
export type DistributeHow = AlignEdge | "hspace" | "vspace";

/** Layer › Align: to the selection when there is one, to the canvas for a single layer, else to the layers' bounds. */
export function alignLayers(doc: ImageDocument, ids: string[], edge: AlignEdge, to?: "selection" | "canvas" | "layers"): void {
  const layers = ids.map((id) => doc.find(id)).filter((l): l is Layer => !!l && !l.locks.position);
  const boxes = layers.map((l) => [l, layerBounds(doc, l)] as const).filter((x): x is readonly [Layer, Rect] => !!x[1]);
  if (!boxes.length) return;
  const mode = to ?? (doc.selection ? "selection" : boxes.length === 1 ? "canvas" : "layers");
  let T: Rect | null = null;
  if (mode === "selection") T = doc.selection?.bounds() ?? null;
  else if (mode === "canvas") T = doc.bounds;
  else for (const [, b] of boxes) T = rectUnion(T, b);
  if (!T) return;
  const target = T;
  doc.change("Align", () => {
    for (const [l, b] of boxes) {
      let dx = 0, dy = 0;
      if (edge === "left") dx = target.x - b.x;
      else if (edge === "right") dx = target.x + target.w - (b.x + b.w);
      else if (edge === "hcenter") dx = target.x + target.w / 2 - (b.x + b.w / 2);
      else if (edge === "top") dy = target.y - b.y;
      else if (edge === "bottom") dy = target.y + target.h - (b.y + b.h);
      else dy = target.y + target.h / 2 - (b.y + b.h / 2);
      translateLayer(l, dx, dy);
    }
  });
}

/** Layer › Distribute: edges / centers evenly between the outermost two, or equal spacing (hspace / vspace). */
export function distributeLayers(doc: ImageDocument, ids: string[], how: DistributeHow): void {
  const boxes = ids.map((id) => doc.find(id)).filter((l): l is Layer => !!l && !l.locks.position)
    .map((l) => ({ l, b: layerBounds(doc, l)! })).filter((x) => !!x.b);
  if (boxes.length < 3) return;
  const horiz = how === "left" || how === "hcenter" || how === "right" || how === "hspace";
  const key = (b: Rect): number => {
    switch (how) {
      case "left": return b.x; case "right": return b.x + b.w; case "hcenter": case "hspace": return b.x + b.w / 2;
      case "top": return b.y; case "bottom": return b.y + b.h; default: return b.y + b.h / 2;
    }
  };
  boxes.sort((a, b) => key(a.b) - key(b.b));
  const first = boxes[0]!, last = boxes[boxes.length - 1]!;
  doc.change("Distribute", () => {
    if (how === "hspace" || how === "vspace") {
      const start = horiz ? first.b.x + first.b.w : first.b.y + first.b.h, end = horiz ? last.b.x : last.b.y;
      const total = boxes.slice(1, -1).reduce((n, x) => n + (horiz ? x.b.w : x.b.h), 0);
      const gap = (end - start - total) / (boxes.length - 1);
      let at = start + gap;
      for (const x of boxes.slice(1, -1)) {
        const d = at - (horiz ? x.b.x : x.b.y);
        translateLayer(x.l, horiz ? d : 0, horiz ? 0 : d);
        at += (horiz ? x.b.w : x.b.h) + gap;
      }
      return;
    }
    const a = key(first.b), z = key(last.b), n = boxes.length - 1;
    boxes.forEach((x, i) => {
      if (i === 0 || i === n) return;
      const d = a + ((z - a) * i) / n - key(x.b);
      translateLayer(x.l, horiz ? d : 0, horiz ? 0 : d);
    });
  });
}

// ——— the tool ———

interface Drag {
  start: [number, number];
  applied: [number, number];
  layers: Layer[];
  bounds: Rect | null;
  targets: Rect[];
  float: Float | null;
  overlay: OverlayShape[];
}

export function moveTool(): Tool {
  let d: Drag | null = null;
  const snapOn = (ctx: ToolContext, p: PointerSample): boolean => ctx.options.snap !== false && !p.ctrl;
  const handles = (ctx: ToolContext): OverlayShape[] => {
    if (!ctx.options.showTransform) return [];
    let b: Rect | null = null;
    for (const l of moveTargets(ctx.doc)) b = rectUnion(b, layerBounds(ctx.doc, l));
    if (!b) return [];
    const { x, y, w, h } = b, pts: [string, number, number][] = [["nw", x, y], ["n", x + w / 2, y], ["ne", x + w, y], ["e", x + w, y + h / 2], ["se", x + w, y + h], ["s", x + w / 2, y + h], ["sw", x, y + h], ["w", x, y + h / 2]];
    return [{ type: "rect", rect: b }, ...pts.map(([id, hx, hy]) => ({ type: "handle" as const, id, x: hx, y: hy }))];
  };
  return {
    id: "move", group: "move", label: "Move Tool", icon: "move", key: "V",
    options: [
      { key: "autoSelect", label: "Auto-Select", kind: "boolean", default: false },
      { key: "autoTarget", label: "Auto-Select Target", kind: "choice", default: "layer", options: [{ value: "layer", label: "Layer" }, { value: "group", label: "Group" }] },
      { key: "showTransform", label: "Show Transform Controls", kind: "boolean", default: false },
      { key: "snap", label: "Smart Guides", kind: "boolean", default: true },
    ],
    cursor: (_c, p) => (p?.alt ? "copy" : "move"),
    down(ctx, p) {
      const doc = ctx.doc;
      if (ctx.options.autoSelect || p.ctrl) {
        const hit = layerAt(doc, p.x, p.y, ctx.options.autoTarget === "group" ? "group" : "layer");
        if (hit && !(doc.selected.includes(hit.id) && doc.selected.length > 1)) doc.setActive(hit.id, p.shift);
      }
      const active = doc.active;
      const pixels = !!doc.selection && !!active && hasRaster(active) && !active.locks.pixels;
      doc.begin(pixels ? (p.alt ? "Duplicate Selection" : "Move Selection") : p.alt ? "Duplicate" : "Move");
      let layers: Layer[] = [], float: Float | null = null;
      if (pixels && active && hasRaster(active)) float = cutFloat(doc, active, p.alt, ctx.bg);
      else {
        layers = moveTargets(doc);
        if (p.alt && layers.length) {
          const copies: Layer[] = [];
          for (const l of layers) { const c = doc.duplicate(l.id); if (c) copies.push(c); }
          doc.selected = copies.map((c) => c.id);
          if (copies.length) doc.activeId = copies[copies.length - 1]!.id;
          layers = copies;
        }
      }
      let bounds: Rect | null = float ? float.bounds : null;
      if (!float) for (const l of layers) bounds = rectUnion(bounds, layerBounds(doc, l));
      const exclude = new Set(layers.map((l) => l.id));
      d = { start: [p.x, p.y], applied: [0, 0], layers, bounds, targets: snapOn(ctx, p) ? snapTargets(doc, exclude) : [], float, overlay: [] };
      if (float) placeFloat(float, 0, 0);
    },
    move(ctx, p) {
      if (!d) return;
      let dx = p.x - d.start[0], dy = p.y - d.start[1];
      if (p.shift) [dx, dy] = constrain45(dx, dy);
      d.overlay = [];
      if (d.bounds && snapOn(ctx, p)) {
        const s = snapRect(ctx.doc, { ...d.bounds, x: d.bounds.x + dx, y: d.bounds.y + dy }, d.targets, { threshold: 6 / ctx.zoom, grid: true });
        if (!p.shift || s.dx === 0 || s.dy === 0) { dx += s.dx; dy += s.dy; }
        d.overlay = s.overlay;
      }
      dx = Math.round(dx); dy = Math.round(dy);
      if (dx === d.applied[0] && dy === d.applied[1]) return;
      if (d.float) {
        const dirty = placeFloat(d.float, dx, dy);
        ctx.shared.selectionOffset = [dx, dy];
        ctx.doc.invalidate(dirty, false, true);
      } else {
        for (const l of d.layers) translateLayer(l, dx - d.applied[0], dy - d.applied[1], false);
        ctx.doc.invalidate(null, false, true);
      }
      d.applied = [dx, dy];
    },
    up(ctx) {
      if (!d) return;
      const [dx, dy] = d.applied;
      if (d.float) {
        if (dx || dy) ctx.doc.selection = shiftedMask(d.float.sel, dx, dy);
        delete ctx.shared.selectionOffset;
      } else for (const l of d.layers) for (const [x] of walk([l])) if (x.mask?.linked) shiftMask(x.mask.mask, dx, dy);
      d = null;
      ctx.doc.commit();
    },
    cancel(ctx) { if (d) { d = null; delete ctx.shared.selectionOffset; ctx.doc.cancel(); } },
    pending: () => !!d,
    key_(ctx, e) {
      if (e.type !== "down") return false;
      const step = e.shift ? 10 : 1;
      const v: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
      const m = v[e.key];
      if (!m) return false;
      if (!moveSelectedPixels(ctx.doc, m[0], m[1], { duplicate: e.alt, bg: ctx.bg })) nudgeLayers(ctx.doc, m[0], m[1]);
      return true;
    },
    overlay: (ctx) => [...handles(ctx), ...(d?.overlay ?? [])],
  };
}
