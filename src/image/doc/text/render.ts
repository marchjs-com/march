// Text rendering and type commands. A text layer's raster is a cache: renderHooks.prepare (kind "text") re-renders
// it when the TextData (or the style sheet, dpi, loaded fonts) changes; the last key is kept per raster in a WeakMap.
// With a canvas, glyphs are drawn with fillText (one call per glyph, LTR; whole runs for RTL paragraphs so joining
// scripts shape); in Node every glyph is a filled box (cap height × advance) so tests can check positions.
// Anti-alias modes: none = threshold at 50 %, sharp / crisp = steeper alpha ramps, strong = heavier alpha, smooth =
// as rasterized. Warp and the placement matrix are applied after drawing with a triangle mesh (smart/sample.ts).
// Commands: create point / box text, edit text (one history step), convert point ↔ box, rasterize type, create a
// work path / shape from text. Glyph outlines need a font parser (textEnv.glyphOutline); without one the outlines are
// approximated with one box per glyph (the result says `approximate: true`).

import type { ImageDocument } from "../document.ts";
import { baseLayer, type PixelLayer, type RGBA, type ShapeLayer, type TextLayer } from "../layers.ts";
import { fillPolygons, transformPath, type Anchor, type PathData, type SubPath } from "../paths.ts";
import { Mask, TiledRaster, type Rect } from "../tiles.ts";
import { plainText, textData, type CharStyle, type ParaStyle, type TextData } from "../text-model.ts";
import { addPrepare, markShown, replaceRaster, stableKey, upToDate } from "../shapes/prepare.ts";
import { meshMap, premul, unpremul } from "../smart/sample.ts";
import { applyFont, canvas2d, currentMeasurer, glyphQuad, layoutText, textEnv, textTransform, type Glyph, type TextLayout } from "./layout.ts";
import { deleteRange, insertText, styleSheet } from "./styles.ts";

/** Layout of a text layer in its document (style sheet and dpi from the document). */
export function layoutOf(doc: ImageDocument, t: TextData): TextLayout {
  return layoutText(t, { dpi: doc.dpi, sheet: styleSheet(doc) });
}

type Poly = [number, number][];

/** Local (along, up) box of a glyph → world polygon. */
function localPoly(g: Glyph, a0: number, a1: number, u0: number, u1: number): Poly {
  const c = Math.cos(g.angle), s = Math.sin(g.angle);
  const P = (a: number, up: number): [number, number] => [g.x + c * a + s * up, g.y + s * a - c * up];
  return [P(a0, u1), P(a1, u1), P(a1, u0), P(a0, u0)];
}

/** The ink box of a glyph in the headless renderer: cap height (0.7 em × vscale) over the baseline, inset 5 %. */
export function glyphBox(g: Glyph): Poly {
  const inset = Math.min(g.size * 0.05, g.adv * 0.1);
  if (g.upright) {
    // centered on the column, 0.7 em wide, the advance tall
    const half = g.size * 0.35 * g.style.hscale;
    return localPoly(g, inset, g.adv - inset, -half, half);
  }
  return localPoly(g, inset, g.adv - inset, 0, g.size * 0.7 * g.style.vscale);
}

/** Underline / strikethrough bars of a glyph. */
function decorations(g: Glyph): Poly[] {
  const out: Poly[] = [], th = Math.max(1, g.size * 0.06);
  if (g.upright) return out;
  if (g.style.underline) out.push(localPoly(g, 0, g.adv, -g.size * 0.1 - th, -g.size * 0.1));
  if (g.style.strike) out.push(localPoly(g, 0, g.adv, g.size * 0.3, g.size * 0.3 + th));
  return out;
}

/** Composite a color over a straight-alpha buffer through a coverage polygon set. */
function fillInto(buf: Float32Array, r: Rect, polys: Poly[], color: RGBA): void {
  fillPolygons(polys, "nonzero", r, (x, y, c) => {
    const k = ((y - r.y) * r.w + (x - r.x)) * 4, sa = color[3] * c, da = buf[k + 3]!, oa = sa + da * (1 - sa);
    if (oa <= 0) return;
    for (let ch = 0; ch < 3; ch++) buf[k + ch] = (color[ch]! * sa + buf[k + ch]! * da * (1 - sa)) / oa;
    buf[k + 3] = oa;
  });
}

function cssColor(c: RGBA): string {
  const b = (v: number): number => Math.round(Math.max(0, Math.min(1, v)) * 255);
  return `rgba(${b(c[0])}, ${b(c[1])}, ${b(c[2])}, ${Math.max(0, Math.min(1, c[3]))})`;
}

/** Draw glyphs with a canvas (fillText); returns straight float RGBA over r, or null without a canvas. */
function drawWithCanvas(L: TextLayout, r: Rect): Float32Array | null {
  const cv = canvas2d(r.w, r.h);
  if (!cv) return null;
  const { ctx } = cv;
  const c = ctx as typeof ctx & { direction?: string; letterSpacing?: string };
  const gs = L.glyphs.filter((g) => !g.hidden && !g.space);
  let k = 0;
  while (k < gs.length) {
    const g = gs[k]!;
    ctx.save();
    applyFont(ctx, g.font, g.style.kerning !== 0 && typeof g.style.kerning !== "number");
    ctx.fillStyle = cssColor(g.style.color);
    if (g.rtl && !g.upright && "direction" in c) {
      // an RTL run (same style, same line, unrotated): one call so the script joins
      let e = k + 1;
      while (e < gs.length && gs[e]!.rtl && gs[e]!.line === g.line && gs[e]!.style === g.style && gs[e]!.angle === 0 && gs[e]!.i === gs[e - 1]!.i - gs[e]!.len) e++;
      const run = gs.slice(k, e), right = Math.max(...run.map((q) => q.x + q.adv));
      c.direction = "rtl";
      ctx.textAlign = "right";
      ctx.translate(right - r.x, g.y - r.y);
      ctx.scale(g.style.hscale, g.style.vscale);
      ctx.fillText(run.slice().reverse().map((q) => q.text).join(""), 0, 0);
      ctx.restore();
      k = e;
      continue;
    }
    if (g.upright) {
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.translate(g.x - r.x, g.y + g.adv / 2 - r.y);
      ctx.scale(g.style.hscale, g.style.vscale);
    } else {
      ctx.translate(g.x - r.x, g.y - r.y);
      if (g.angle) ctx.rotate(g.angle);
      ctx.scale(g.style.hscale, g.style.vscale);
    }
    ctx.fillText(g.text, 0, 0);
    ctx.restore();
    k++;
  }
  const img = ctx.getImageData(0, 0, r.w, r.h).data, out = new Float32Array(r.w * r.h * 4);
  for (let i = 0; i < img.length; i++) out[i] = img[i]! / 255;
  return out;
}

/** Alpha curve of an anti-alias mode. */
export function antialiasCurve(mode: CharStyle["antialias"]): ((a: number) => number) | null {
  const clamp = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
  switch (mode) {
    case "none": return (a) => (a >= 0.5 ? 1 : 0);
    case "sharp": return (a) => clamp((a - 0.5) * 1.8 + 0.5);
    case "crisp": return (a) => clamp((a - 0.5) * 1.35 + 0.5);
    case "strong": return (a) => clamp(a * 1.35);
    default: return null;
  }
}

/** Render a text model: straight RGBA over a document-geometry rect (warp and matrix applied). */
export function renderTextPixels(t: TextData, L: TextLayout, clip?: Rect): { rect: Rect; px: Float32Array } | null {
  const b = L.bounds;
  if (!b) return null;
  const maxSize = L.glyphs.reduce((m, g) => Math.max(m, g.size), 0);
  const pad = Math.ceil(maxSize * 0.35) + 2;
  const r: Rect = { x: Math.floor(b.x) - pad, y: Math.floor(b.y) - pad, w: Math.ceil(b.x + b.w) - Math.floor(b.x) + pad * 2, h: Math.ceil(b.y + b.h) - Math.floor(b.y) + pad * 2 };
  let px = currentMeasurer().canvas ? drawWithCanvas(L, r) : null;
  const headless = !px;
  px ??= new Float32Array(r.w * r.h * 4);
  for (const g of L.glyphs) {
    if (g.hidden) continue;
    const polys = headless && !g.space ? [glyphBox(g)] : [];
    polys.push(...decorations(g));
    if (polys.length) fillInto(px, r, polys, g.style.color);
  }
  const curve = antialiasCurve(t.char.antialias);
  if (curve) for (let i = 3; i < px.length; i += 4) px[i] = curve(px[i]!);
  const T = textTransform(t, L);
  if (!T) return { rect: r, px };
  premul(px);
  const cols = Math.max(1, Math.min(256, Math.ceil(r.w / 6))), rows = Math.max(1, Math.min(256, Math.ceil(r.h / 6)));
  const m = meshMap(px, r, cols, rows, (i, j) => T(r.x + (i * r.w) / cols, r.y + (j * r.h) / rows), clip);
  return { rect: m.rect, px: unpremul(m.px) };
}

const keyOf = (doc: ImageDocument, l: TextLayer): string => stableKey([l.text, doc.dpi, doc.meta.textStyles ?? null, textEnv.fontsVersion, currentMeasurer().canvas]);

/** Bring a text layer's raster up to date (the prepare hook). */
export function prepareText(doc: ImageDocument, l: TextLayer): void {
  const key = keyOf(doc, l);
  if (upToDate(l.raster, key)) return;
  const L = layoutOf(doc, l.text);
  const res = renderTextPixels(l.text, L);
  replaceRaster(l.raster, res?.rect ?? null, res?.px ?? null);
  markShown(l.raster, key);
}

/** Register the text renderer (renderHooks.prepare for kind "text"). */
export function installTextRenderer(): () => void {
  return addPrepare("text", (doc, l) => { if (l.kind === "text") prepareText(doc, l); });
}

/** A text model's coverage as a document-size mask (type mask tools, Ctrl+click a text thumbnail). */
export function textMask(doc: ImageDocument, t: TextData, offset: [number, number] = [0, 0]): Mask {
  const m = new Mask(doc.width, doc.height);
  const res = renderTextPixels(t, layoutOf(doc, t), { x: -offset[0], y: -offset[1], w: doc.width, h: doc.height });
  if (!res) return m;
  const { rect, px } = res, d = m.data;
  for (let y = 0; y < rect.h; y++) {
    const dy = rect.y + y + offset[1];
    if (dy < 0 || dy >= doc.height) continue;
    for (let x = 0; x < rect.w; x++) {
      const dx = rect.x + x + offset[0];
      if (dx < 0 || dx >= doc.width) continue;
      d[dy * doc.width + dx] = Math.round(Math.max(0, Math.min(1, px[(y * rect.w + x) * 4 + 3]!)) * 255);
    }
  }
  return m;
}

// ——— commands ———

const layerName = (t: TextData): string => plainText(t).split("\n")[0]!.trim().slice(0, 40) || "Text";

/** A new text layer object (not yet in the tree). */
export function newTextLayer(doc: ImageDocument, t: TextData, name?: string): TextLayer {
  return { ...baseLayer("text", name ?? layerName(t)), text: t, raster: new TiledRaster(doc.depth) };
}

/** Point text at a baseline anchor (one history step). */
export function createPointText(doc: ImageDocument, x: number, y: number, text: string, char: Partial<CharStyle> = {}, para: Partial<ParaStyle> = {}, vertical = false): TextLayer {
  return doc.change("Type Tool", () => {
    const t = textData(text, { type: "point", x, y }, char, para);
    if (vertical) t.orientation = "vertical";
    return doc.add(newTextLayer(doc, t));
  }, "type");
}

/** Box (paragraph) text in a frame (one history step). */
export function createBoxText(doc: ImageDocument, frame: Rect, text: string, char: Partial<CharStyle> = {}, para: Partial<ParaStyle> = {}, vertical = false): TextLayer {
  return doc.change("Type Tool", () => {
    const t = textData(text, { type: "box", x: frame.x, y: frame.y, w: frame.w, h: frame.h }, char, para);
    if (vertical) t.orientation = "vertical";
    return doc.add(newTextLayer(doc, t));
  }, "type");
}

/** Text on a path (one history step). */
export function createPathText(doc: ImageDocument, path: PathData, text: string, char: Partial<CharStyle> = {}, offset = 0, side: "above" | "below" = "above"): TextLayer {
  return doc.change("Type Tool", () => doc.add(newTextLayer(doc, textData(text, { type: "path", path, offset, side }, char))), "type");
}

/** Fold the raster offset (a Move tool move) into the frame. Call inside a change. */
export function bakeTextOffset(l: TextLayer): void {
  const ox = l.raster.ox, oy = l.raster.oy;
  if (!ox && !oy) return;
  const f = l.text.frame;
  // the offset applies after the placement matrix: fold it there when there is one
  if (l.text.matrix && l.text.matrix.length >= 6) { const m = l.text.matrix.slice(); m[4] = m[4]! + ox; m[5] = m[5]! + oy; l.text.matrix = m; }
  else if (f.type === "path") l.text.frame = { ...f, path: transformPath(f.path, [1, 0, 0, 1, ox, oy]) };
  else l.text.frame = { ...f, x: f.x + ox, y: f.y + oy };
  l.raster.ox = 0; l.raster.oy = 0;
}

/** Edit a text layer's model as one history step (the type tool uses begin / commit for a whole session). */
export function editText(doc: ImageDocument, id: string, fn: (t: TextData) => void, label = "Edit Type"): void {
  const l = doc.find(id);
  if (!l || l.kind !== "text") return;
  doc.change(label, () => {
    bakeTextOffset(l);
    fn(l.text);
    l.name = l.data?.autoName === false ? l.name : layerName(l.text);
  }, "type");
}

/** Replace all of a text layer's text keeping the first run's style. */
export function setText(doc: ImageDocument, id: string, text: string): void {
  editText(doc, id, (t) => {
    const first = t.paragraphs[0]?.runs[0];
    t.paragraphs = [{ runs: [{ text: "", style: { ...(first?.style ?? {}) } }], style: { ...(t.paragraphs[0]?.style ?? {}) } }];
    insertText(t, 0, text, first ? { style: first.style, styleRef: first.styleRef } : undefined);
  });
}

/** Point ↔ box (paragraph) text. Box → point keeps each wrapped line by inserting line breaks. One history step. */
export function convertPointBox(doc: ImageDocument, id: string): void {
  const l = doc.find(id);
  if (!l || l.kind !== "text" || l.text.frame.type === "path") return;
  const L = layoutOf(doc, l.text);
  doc.change(l.text.frame.type === "point" ? "Convert to Paragraph Text" : "Convert to Point Text", () => {
    bakeTextOffset(l);
    const t = l.text, f = t.frame;
    const vertical = t.orientation === "vertical";
    if (f.type === "point") {
      const b = L.bounds ?? { x: f.x, y: f.y, w: 1, h: 1 };
      const first = L.lines[0];
      const top = vertical ? f.y : f.y - (first?.asc ?? 0);
      const right = vertical ? f.x + (first?.lead ?? 0) / 2 : 0;
      t.frame = vertical
        ? { type: "box", x: Math.floor(b.x), y: top, w: Math.ceil(right - Math.floor(b.x)), h: Math.ceil(b.y + b.h - top) + 1 }
        : { type: "box", x: Math.floor(b.x), y: top, w: Math.ceil(b.w) + 2, h: Math.ceil(b.y + b.h - top) + 1 };
    } else if (f.type === "box") {
      // hard breaks where lines wrapped (from the end, so indices stay valid)
      const breaks = L.lines.filter((ln) => !ln.lastInPara && !ln.overflow).map((ln) => ln.end).sort((a, b) => b - a);
      for (const at of breaks) {
        // the space that ended a wrapped line becomes the break
        if (at > 0 && plainText(t)[at - 1] === " ") { deleteRange(t, at - 1, at); insertText(t, at - 1, "\n"); }
        else insertText(t, at, "\n");
      }
      const first = L.lines[0];
      const align = t.para.align;
      const x = vertical ? f.x + f.w - (first?.lead ?? 0) / 2 : align === "center" || align === "justify-center" ? f.x + f.w / 2 : align === "right" || align === "justify-right" ? f.x + f.w : f.x;
      t.frame = { type: "point", x, y: vertical ? f.y : f.y + (first?.baseline ?? 0) };
    }
  }, "type");
}

/** Text → pixel layer (Rasterize Type). One history step. */
export function rasterizeType(doc: ImageDocument, id: string): PixelLayer | null {
  const l = doc.find(id);
  if (!l || l.kind !== "text") return null;
  prepareText(doc, l);
  return doc.change("Rasterize Type", () => {
    const loc = doc.locate(id)!;
    const { text: _t, raster, kind: _k, ...rest } = l;
    const px: PixelLayer = { ...rest, kind: "pixel", raster: raster.clone() };
    loc.list.splice(loc.index, 1, px);
    doc.activeId = px.id;
    return px;
  }, "rasterize");
}

/** Outlines of a text (document space): glyph outlines from textEnv.glyphOutline, else one box per glyph. */
export function textOutlines(doc: ImageDocument, t: TextData, offset: [number, number] = [0, 0]): { path: PathData; approximate: boolean } {
  const L = layoutOf(doc, t), T = textTransform(t, L);
  const subs: SubPath[] = [];
  let approximate = false;
  const map = (x: number, y: number): [number, number] => { const p = T ? T(x, y) : [x, y] as [number, number]; return [p[0] + offset[0], p[1] + offset[1]]; };
  for (const g of L.glyphs) {
    if (g.hidden || g.space) continue;
    const outline = textEnv.glyphOutline?.(g.text, g.font) ?? null;
    if (outline) {
      const c = Math.cos(g.angle), s = Math.sin(g.angle), hs = g.style.hscale, vs = g.style.vscale;
      const placed = transformPath(outline, [c * hs, s * hs, -s * vs, c * vs, g.x, g.y]);
      for (const sp of placed.subpaths) subs.push({ ...sp, anchors: sp.anchors.map((a) => mapAnchor(a, map)) });
    } else {
      approximate = true;
      subs.push({ closed: true, anchors: glyphBox(g).map(([x, y]) => { const [X, Y] = map(x, y); return { x: X, y: Y, ix: X, iy: Y, ox: X, oy: Y, type: "corner" as const }; }) });
    }
  }
  return { path: { subpaths: subs, fillRule: "nonzero" }, approximate };
}

function mapAnchor(a: Anchor, f: (x: number, y: number) => [number, number]): Anchor {
  const [x, y] = f(a.x, a.y), [ix, iy] = f(a.ix, a.iy), [ox, oy] = f(a.ox, a.oy);
  return { ...a, x, y, ix, iy, ox, oy };
}

/** Type › Create Work Path. Returns whether the outlines are approximate (boxes). One history step. */
export function textToWorkPath(doc: ImageDocument, id: string): { approximate: boolean } {
  const l = doc.find(id);
  if (!l || l.kind !== "text") return { approximate: false };
  const { path, approximate } = textOutlines(doc, l.text, [l.raster.ox, l.raster.oy]);
  doc.change("Create Work Path", () => {
    const others = doc.paths.filter((p) => !p.work);
    doc.paths = [...others, { id: `p${Date.now().toString(36)}`, name: "Work Path", path, work: true }];
  }, "path");
  return { approximate };
}

/** Type › Convert to Shape: the text layer becomes a shape layer filled with the first character's color. */
export function textToShape(doc: ImageDocument, id: string): { layer: ShapeLayer | null; approximate: boolean } {
  const l = doc.find(id);
  if (!l || l.kind !== "text") return { layer: null, approximate: false };
  const { path, approximate } = textOutlines(doc, l.text, [l.raster.ox, l.raster.oy]);
  const L = layoutOf(doc, l.text);
  const color = L.glyphs[0]?.style.color ?? l.text.char.color;
  const layer = doc.change("Convert to Shape", () => {
    const loc = doc.locate(id)!;
    const { text: _t, raster: _r, kind: _k, ...rest } = l;
    const s: ShapeLayer = { ...rest, kind: "shape", path, fillPaint: { type: "solid", color: [...color] as RGBA }, stroke: null, raster: new TiledRaster(doc.depth) };
    loc.list.splice(loc.index, 1, s);
    doc.activeId = s.id;
    return s;
  }, "shape");
  return { layer, approximate };
}
