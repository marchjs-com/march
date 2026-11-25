// Text layout: runs → clusters → lines → positioned glyphs, for point, box and path text, horizontal or vertical,
// plus the caret / selection model the UI uses for inline editing (index ↔ point hit testing, line boxes, caret
// moves) and the warp mapping.
//
// Measuring: with a canvas 2D context (OffscreenCanvas, or a document canvas) each cluster is measured with
// measureText under ctx.font (style, weight, size, family); `fontKerning` and `fontStretch` are set where the context
// has them (Chromium 99+, Safari 16.4+, Firefox 115+ for fontStretch / fontKerning). Pair kerning ("metrics") is
// width(ab) − width(a) − width(b) with kerning on, cached per font and pair. "optical" kerning is approximated with a
// pair table on top of the metrics. Tracking, horizontal / vertical scale, small caps (synthetic, 75 %), super- and
// subscript (58.3 % size, 33.3 % shift) are applied here, so they work the same on every platform; letterSpacing is
// only used when drawing whole runs (render.ts). OpenType features and variable axes need the font's source: register
// it with registerFontSource(), and runs with `features` / `axes` get an alias family loaded through FontFace with
// featureSettings / variationSettings descriptors (honored by Firefox; Chromium and Safari ignore featureSettings on
// FontFace at the time of writing, `wght` still works through the weight and `wdth` through fontStretch keywords).
// Without a canvas (Node, tests) a deterministic model is used: every cluster advances 0.55 em, ascent 0.8 em,
// descent 0.2 em, no kerning — so layouts are testable headless.

import { flatten, type PathData } from "../paths.ts";
import type { Rect } from "../tiles.ts";
import type { CharStyle, ParaStyle, TextData, TextWarp } from "../text-model.ts";
import { hyphenPoints, upper, type HyphenMin } from "./hyphen-tr.ts";
import { emptySheet, resolveChar, resolvePara, type StyleSheet } from "./styles.ts";

// ——— measuring ———

export interface FontSpec {
  family: string; weight: number; style: "normal" | "italic";
  /** Size in pixels. */
  size: number;
  stretch?: string | undefined;
  features?: Record<string, boolean | number> | undefined;
  axes?: Record<string, number> | undefined;
}

export interface Measurer {
  /** True when backed by a real font engine (canvas). */
  canvas: boolean;
  /** Advance of a cluster in pixels (no tracking, no scale). */
  advance(cluster: string, f: FontSpec): number;
  /** Pair kerning adjustment in pixels between two clusters. */
  kern(a: string, b: string, f: FontSpec): number;
  /** Ascent and descent in pixels. */
  metrics(f: FontSpec): { ascent: number; descent: number };
}

/** The deterministic model used without a canvas: 0.55 em advances, 0.8 / 0.2 em ascent / descent. */
export const fallbackMeasurer: Measurer = {
  canvas: false,
  advance: (_c, f) => f.size * 0.55,
  kern: () => 0,
  metrics: (f) => ({ ascent: f.size * 0.8, descent: f.size * 0.2 }),
};

type Ctx2D = OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D;

/** A 2D context for measuring / drawing, or null in Node. */
export function canvas2d(w = 1, h = 1): { ctx: Ctx2D; canvas: OffscreenCanvas | HTMLCanvasElement } | null {
  const g = globalThis as { OffscreenCanvas?: typeof OffscreenCanvas; document?: Document };
  try {
    if (g.OffscreenCanvas) { const c = new g.OffscreenCanvas(w, h), ctx = c.getContext("2d"); if (ctx) return { ctx, canvas: c }; }
    if (g.document?.createElement) { const c = g.document.createElement("canvas"); c.width = w; c.height = h; const ctx = c.getContext("2d"); if (ctx) return { ctx, canvas: c }; }
  } catch { /* no canvas */ }
  return null;
}

// font sources for OpenType features / variable axes (FontFace aliases)
const sources = new Map<string, string | ArrayBuffer>();
const aliases = new Map<string, "loading" | "ready" | "failed">();

/** Where to load a family from, so runs with OpenType features or variable axes can use them (see header). */
export function registerFontSource(family: string, source: string | ArrayBuffer): void { sources.set(family, source); }

function aliasFor(f: FontSpec): string | null {
  if (!f.features && !f.axes) return null;
  const src = sources.get(f.family);
  const FF = (globalThis as { FontFace?: typeof FontFace }).FontFace;
  if (!src || !FF) return null;
  const feat = f.features ? Object.entries(f.features).map(([k, v]) => `"${k}" ${v === true ? 1 : v === false ? 0 : v}`).join(", ") : "";
  const vars = f.axes ? Object.entries(f.axes).map(([k, v]) => `"${k}" ${v}`).join(", ") : "";
  const alias = `${f.family}__${hashStr(feat + "|" + vars + "|" + f.weight + f.style)}`;
  const st = aliases.get(alias);
  if (st === "ready") return alias;
  if (!st) {
    aliases.set(alias, "loading");
    try {
      const desc: Record<string, string> = { weight: String(f.weight), style: f.style };
      if (feat) desc.featureSettings = feat;
      if (vars) desc.variationSettings = vars;
      const face = new FF(alias, typeof src === "string" ? `url(${JSON.stringify(src)})` : src, desc as FontFaceDescriptors);
      const set = (globalThis as { document?: Document }).document?.fonts ?? (globalThis as unknown as { fonts?: FontFaceSet }).fonts;
      void face.load().then(() => { set?.add(face); aliases.set(alias, "ready"); textEnv.fontsVersion++; textEnv.onFontsChanged?.(); }, () => aliases.set(alias, "failed"));
    } catch { aliases.set(alias, "failed"); }
  }
  return null;
}

function hashStr(s: string): string { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0).toString(36); }

/** The CSS font shorthand of a spec (for ctx.font). */
export function fontString(f: FontSpec): string {
  const fam = aliasFor(f) ?? f.family;
  const family = /^[\w-]+$/.test(fam) && !/^\d/.test(fam) ? fam : JSON.stringify(fam);
  return `${f.style === "italic" ? "italic " : ""}${Math.round(f.weight)} ${f.size}px ${family}`;
}

/** Apply a font spec to a context (font, kerning, stretch where supported). */
export function applyFont(ctx: Ctx2D, f: FontSpec, kerning = true): void {
  ctx.font = fontString(f);
  const c = ctx as Ctx2D & { fontKerning?: string; fontStretch?: string };
  if ("fontKerning" in c) c.fontKerning = kerning ? "normal" : "none";
  if (f.stretch && "fontStretch" in c) c.fontStretch = f.stretch as never;
}

function canvasMeasurer(): Measurer | null {
  const cv = canvas2d();
  if (!cv) return null;
  const { ctx } = cv;
  const widths = new Map<string, number>(), kerns = new Map<string, number>(), mets = new Map<string, { ascent: number; descent: number }>();
  const width = (s: string, f: FontSpec): number => {
    const key = fontString(f) + "\u0000" + s;
    let w = widths.get(key);
    if (w == null) { applyFont(ctx, f); w = ctx.measureText(s).width; widths.set(key, w); }
    return w;
  };
  return {
    canvas: true,
    advance: (c, f) => width(c, f),
    kern: (a, b, f) => {
      const key = fontString(f) + "\u0000" + a + "\u0000" + b;
      let k = kerns.get(key);
      if (k == null) { k = width(a + b, f) - width(a, f) - width(b, f); if (Math.abs(k) < 1e-3) k = 0; kerns.set(key, k); }
      return k;
    },
    metrics: (f) => {
      const key = fontString(f);
      let m = mets.get(key);
      if (!m) {
        applyFont(ctx, f);
        const tm = ctx.measureText("Hg") as TextMetrics & { fontBoundingBoxAscent?: number; fontBoundingBoxDescent?: number };
        m = { ascent: tm.fontBoundingBoxAscent ?? f.size * 0.8, descent: tm.fontBoundingBoxDescent ?? f.size * 0.2 };
        mets.set(key, m);
      }
      return m;
    },
  };
}

/** Text environment: measurer, warp preset and outline providers can be injected; fontsVersion bumps when fonts load. */
export const textEnv: {
  measurer: Measurer | null;
  /** Use the deterministic model even when a canvas exists (tests in a browser). */
  forceFallback: boolean;
  /** A warp from transform/warp.ts: forward map for a text bounds. */
  warpPreset?: ((w: TextWarp, bounds: Rect) => ((x: number, y: number) => [number, number]) | null) | undefined;
  /** Glyph outlines (a font parser): a path for one glyph at the origin, em-sized to `size`. */
  glyphOutline?: ((text: string, font: FontSpec) => PathData | null) | undefined;
  fontsVersion: number;
  onFontsChanged?: (() => void) | undefined;
} = { measurer: null, forceFallback: false, fontsVersion: 0 };

let autoMeasurer: Measurer | null | undefined;
export function currentMeasurer(): Measurer {
  if (textEnv.measurer) return textEnv.measurer;
  if (textEnv.forceFallback) return fallbackMeasurer;
  if (autoMeasurer === undefined) autoMeasurer = canvasMeasurer();
  return autoMeasurer ?? fallbackMeasurer;
}

/** Optical kerning: classic tight pairs, 1/1000 em (an approximation of shape-based kerning). */
const OPTICAL: Record<string, number> = {
  AV: -80, AW: -60, AY: -80, AT: -70, VA: -80, WA: -60, YA: -80, TA: -70, LT: -80, LY: -80, LV: -70, LW: -60,
  To: -80, Te: -70, Ta: -70, Tr: -50, Ty: -50, Yo: -80, Ya: -70, Ye: -70, Vo: -50, Va: -60, Ve: -50, Wo: -40, Wa: -40,
  Fa: -40, Fo: -40, "F.": -80, "P.": -90, "T.": -80, "V.": -80, "Y.": -90, "W.": -60, "T,": -80, "Y,": -90, "V,": -80,
  "r.": -40, "r,": -40, "y.": -50, "y,": -50, "v.": -50, "w.": -40, LO: -30, OV: -30, OA: -20, AO: -20,
};

// ——— layout data ———

export interface Glyph {
  /** Plain-text index (UTF-16) and length of the source cluster. */
  i: number; len: number;
  /** Source and displayed text (casing applied). */
  ch: string; text: string;
  /** Baseline start point (document geometry space, before warp / matrix) and direction angle in radians. */
  x: number; y: number; angle: number;
  /** Advance along the direction (scale, tracking, kerning and justification included). */
  adv: number;
  /** Pixel size, ascent / descent (vscale included), baseline shift (up positive). */
  size: number; asc: number; desc: number; shift: number;
  style: CharStyle;
  font: FontSpec;
  line: number;
  space: boolean;
  /** An inserted hyphen at a line break (not part of the text). */
  hyphen?: boolean | undefined;
  /** Vertical text: drawn upright, centered on the column. */
  upright?: boolean | undefined;
  /** Past the end of a path or below a box: not drawn. */
  hidden?: boolean | undefined;
  rtl?: boolean | undefined;
}

export interface Line {
  index: number; para: number;
  /** Plain-text range [start, end). */
  start: number; end: number;
  /** Glyph range [from, to) in layout.glyphs. */
  from: number; to: number;
  /** Baseline position along the block axis and the line's ascent / descent / leading. */
  baseline: number; asc: number; desc: number; lead: number;
  /** Inline width without trailing spaces. */
  width: number;
  lastInPara: boolean;
  rtl: boolean;
  overflow: boolean;
  /** Caret top-left point for an empty line. */
  ex: number; ey: number;
}

export interface TextLayout {
  text: string;
  glyphs: Glyph[];
  lines: Line[];
  /** Bounds of the glyph boxes (geometry space), null when empty. */
  bounds: Rect | null;
  vertical: boolean;
  path: boolean;
  /** Box text that did not fit (the overflow sign on the frame). */
  overflow: boolean;
  /** Pixels per point. */
  scale: number;
  frame: TextData["frame"];
  /** Carets per plain-text index (computed on demand). */
  carets?: Caret[] | undefined;
}

export interface LayoutOptions {
  dpi?: number | undefined;
  sheet?: StyleSheet | undefined;
  measurer?: Measurer | undefined;
}

interface Cluster { i: number; len: number; ch: string; text: string; adv: number; size: number; asc: number; desc: number; shift: number; lead: number; style: CharStyle; font: FontSpec; space: boolean; breakAfter: boolean; hyphen?: boolean | undefined }

const segmenter = (() => {
  const S = (Intl as { Segmenter?: new (l?: string, o?: { granularity: string }) => { segment(s: string): Iterable<{ segment: string; index: number }> } }).Segmenter;
  return S ? new S(undefined, { granularity: "grapheme" }) : null;
})();
function clustersOf(s: string): [string, number][] {
  if (segmenter) return [...segmenter.segment(s)].map((x) => [x.segment, x.index]);
  const out: [string, number][] = [];
  let i = 0;
  for (const c of s) { out.push([c, i]); i += c.length; }
  return out;
}

const isSpace = (c: string): boolean => /^\s+$/u.test(c) && c !== " ";

/** Kerning between two clusters in pixels for a style. */
function kernPair(m: Measurer, a: Cluster, b: Cluster): number {
  const k = b.style.kerning;
  if (a.space || b.space) return 0;
  if (typeof k === "number") return (k / 1000) * b.size;
  if (a.font.family !== b.font.family || a.size !== b.size) return 0;
  const metrics = m.kern(a.text, b.text, b.font) * b.style.hscale;
  if (k === "optical") { const t = OPTICAL[a.text + b.text]; return t != null ? Math.min(metrics, (t / 1000) * b.size) : metrics; }
  return metrics;
}

/** Characters of one paragraph as measured clusters. */
function measureParagraph(t: TextData, pi: number, start: number, sheet: StyleSheet, m: Measurer, scale: number, vertical: boolean): Cluster[] {
  const p = t.paragraphs[pi]!, out: Cluster[] = [];
  let at = start;
  for (const run of p.runs) {
    const cs = resolveChar(t, p, run, sheet);
    const full = cs.size * scale, pos = cs.position ?? "normal";
    for (const [c, off] of clustersOf(run.text)) {
      let text = c, size = full * (pos === "normal" ? 1 : 0.583);
      const lang = cs.lang;
      if (cs.caps === "all") text = upper(c, lang);
      else if (cs.caps === "small") { const u = upper(c, lang); if (u !== c) { text = u; size *= 0.75; } }
      const font: FontSpec = { family: cs.font, weight: cs.axes?.wght ?? cs.weight, style: cs.style, size, stretch: cs.axes?.wdth ? stretchKeyword(cs.axes.wdth) : undefined, features: cs.features, axes: cs.axes };
      const met = m.metrics(font);
      const space = isSpace(c);
      const adv = (vertical ? size * cs.vscale : m.advance(text, font) * cs.hscale) + (cs.tracking / 1000) * full;
      const asc = vertical ? (full * cs.hscale) / 2 : met.ascent * cs.vscale, desc = vertical ? (full * cs.hscale) / 2 : met.descent * cs.vscale;
      const shift = cs.baseline * scale + (pos === "super" ? full * 0.333 : pos === "sub" ? -full * 0.333 : 0);
      const lead = cs.leading != null ? cs.leading * scale : full * 1.2;
      out.push({ i: at + off, len: c.length, ch: c, text, adv, size, asc, desc, shift, lead, style: cs, font, space, breakAfter: space || c === "-" || c === "­" || c === "/" });
    }
    at += run.text.length;
  }
  for (let k = 1; k < out.length; k++) out[k - 1]!.adv += vertical ? 0 : kernPair(m, out[k - 1]!, out[k]!);
  return out;
}

function stretchKeyword(w: number): string {
  const k: [number, string][] = [[50, "ultra-condensed"], [62.5, "extra-condensed"], [75, "condensed"], [87.5, "semi-condensed"], [100, "normal"], [112.5, "semi-expanded"], [125, "expanded"], [150, "extra-expanded"], [200, "ultra-expanded"]];
  let best = k[4]!;
  for (const x of k) if (Math.abs(x[0] - w) < Math.abs(best[0] - w)) best = x;
  return best[1];
}

interface RawLine { clusters: Cluster[]; first: boolean; last: boolean; start: number; end: number }

const widthOf = (cs: Cluster[]): number => { let w = 0; for (const c of cs) w += c.adv; return w; };
const trimmedWidth = (cs: Cluster[]): number => { let n = cs.length; while (n > 0 && cs[n - 1]!.space) n--; return widthOf(cs.slice(0, n)); };

/** Break a paragraph's clusters into lines no wider than `avail(first)` (Infinity = no wrapping). */
function breakLines(cl: Cluster[], para: ParaStyle, avail: (first: boolean) => number, pStart: number, pEnd: number, m: Measurer): RawLine[] {
  const lines: RawLine[] = [];
  // tokens: a word and the spaces after it
  const tokens: Cluster[][] = [];
  let cur: Cluster[] = [];
  for (let k = 0; k < cl.length; k++) {
    const c = cl[k]!;
    cur.push(c);
    const next = cl[k + 1];
    if (c.breakAfter && (!next || !next.space) && !(c.space && next?.space)) { tokens.push(cur); cur = []; }
  }
  if (cur.length) tokens.push(cur);
  let line: Cluster[] = [];
  const push = (last: boolean): void => {
    const start = line.find((c) => !c.hyphen)?.i ?? pStart;
    lines.push({ clusters: line, first: lines.length === 0, last, start, end: last ? pEnd : 0 });
    line = [];
  };
  const min: HyphenMin = para.hyphenMin ?? [5, 2, 2];
  for (let ti = 0; ti < tokens.length; ti++) {
    let tok = tokens[ti]!;
    for (;;) {
      const W = avail(lines.length === 0);
      const used = widthOf(line), wordW = trimmedWidth(tok);
      if (!line.length && wordW <= W || line.length && used + wordW <= W || W === Infinity) { line.push(...tok); break; }
      // hyphenate the word into the remaining space
      const word = tok.filter((c) => !c.space);
      if (para.hyphenate && word.length) {
        const text = word.map((c) => c.ch).join("");
        const pts = hyphenPoints(text, word[0]!.style.lang, min);
        // code point index → cluster index
        const cpToCluster = new Map<number, number>();
        let cp = 0;
        word.forEach((c, k) => { cpToCluster.set(cp, k); cp += Array.from(c.ch).length; });
        let done = false;
        for (let q = pts.length - 1; q >= 0; q--) {
          const k = cpToCluster.get(pts[q]!);
          if (k == null) continue;
          const head = word.slice(0, k), ref = head[head.length - 1]!;
          const hy: Cluster = { ...ref, i: word[k]!.i, len: 0, ch: "-", text: "-", adv: m.advance("-", ref.font) * ref.style.hscale + (ref.style.tracking / 1000) * ref.size, space: false, breakAfter: true, hyphen: true };
          if (used + widthOf(head) + hy.adv <= W) {
            line.push(...head, hy);
            push(false);
            tok = tok.slice(k);
            done = true;
            break;
          }
        }
        if (done) continue;
      }
      if (line.length) { push(false); continue; }
      // a word longer than the line: break between clusters
      let k = 0, w = 0;
      while (k < tok.length && (k === 0 || w + tok[k]!.adv <= W)) { w += tok[k]!.adv; k++; }
      line.push(...tok.slice(0, k));
      tok = tok.slice(k);
      if (!tok.length) break;
      push(false);
    }
  }
  push(true);
  // line ends: the next line's start
  for (let k = 0; k < lines.length - 1; k++) lines[k]!.end = lines[k + 1]!.start;
  return lines;
}

/** Lay out a text model. */
export function layoutText(t: TextData, o: LayoutOptions = {}): TextLayout {
  const m = o.measurer ?? currentMeasurer();
  const sheet = o.sheet ?? emptySheet();
  const scale = (o.dpi ?? 72) / 72;
  const vertical = t.orientation === "vertical";
  const frame = t.frame;
  const isBox = frame.type === "box", isPath = frame.type === "path";
  const glyphs: Glyph[] = [], lines: Line[] = [];
  const plain = t.paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n");
  // block axis cursor
  const boxInline = isBox ? (vertical ? frame.h : frame.w) : Infinity;
  const boxBlock = isBox ? (vertical ? frame.w : frame.h) : Infinity;
  let blockPos = 0, firstLine = true, overflow = false, pStart = 0;
  t.paragraphs.forEach((p, pi) => {
    const ps = resolvePara(t, p, sheet);
    const rtl = ps.direction === "rtl";
    const cl = measureParagraph(t, pi, pStart, sheet, m, scale, vertical);
    const pLen = p.runs.reduce((n, r) => n + r.text.length, 0);
    const indentFirst = ps.indentFirst * scale, indentL = ps.indentLeft * scale, indentR = ps.indentRight * scale;
    const avail = (first: boolean): number => isBox && !isPath ? Math.max(1, boxInline - indentL - indentR - (first ? indentFirst : 0)) : Infinity;
    const raw = breakLines(cl, ps, avail, pStart, pStart + pLen, m);
    if (!firstLine) blockPos += ps.spaceBefore * scale;
    // metrics of an empty paragraph come from its first run
    const emptyStyle = resolveChar(t, p, p.runs[0] ?? { text: "", style: {} }, sheet);
    const emptySize = emptyStyle.size * scale;
    const emptyMet = vertical ? { ascent: emptySize / 2, descent: emptySize / 2 } : m.metrics({ family: emptyStyle.font, weight: emptyStyle.weight, style: emptyStyle.style, size: emptySize });
    raw.forEach((rl) => {
      const cs = rl.clusters;
      let asc = 0, desc = 0, lead = 0;
      for (const c of cs) { asc = Math.max(asc, c.asc + c.shift); desc = Math.max(desc, c.desc - c.shift); lead = Math.max(lead, c.lead); }
      if (!cs.length) { asc = emptyMet.ascent * emptyStyle.vscale; desc = emptyMet.descent * emptyStyle.vscale; lead = emptyStyle.leading != null ? emptyStyle.leading * scale : emptySize * 1.2; }
      if (vertical) { asc = lead / 2; desc = lead / 2; }
      const baseline = firstLine ? (isBox ? asc : 0) : blockPos + lead;
      blockPos = baseline;
      firstLine = false;
      const lineOverflow = isBox && baseline + desc > boxBlock + 0.5;
      if (lineOverflow) overflow = true;
      // inline placement
      const W = avail(rl.first);
      const width = trimmedWidth(cs);
      let align = ps.align;
      const justify = align.startsWith("justify") && (align === "justify-all" || !rl.last) && isBox;
      if (align.startsWith("justify") && !justify) align = align === "justify-center" ? "center" : align === "justify-right" ? "right" : "left";
      if (rtl) align = align === "left" ? "right" : align === "right" ? "left" : align;
      const ind = indentL + (rl.first ? indentFirst : 0);
      const advs = cs.map((c) => c.adv);
      let trail = cs.length;
      while (trail > 0 && cs[trail - 1]!.space) trail--;
      if (justify && W !== Infinity && width < W) {
        const gaps: number[] = [];
        for (let k = 0; k < trail; k++) if (cs[k]!.space) gaps.push(k);
        const extra = W - width;
        if (gaps.length) for (const k of gaps) advs[k]! += extra / gaps.length;
        else if (trail > 1) for (let k = 0; k < trail - 1; k++) advs[k]! += extra / (trail - 1);
      }
      const used = justify ? Math.max(width, W) : width;
      let u0: number;
      if (W === Infinity) u0 = ind + (align === "center" ? -used / 2 : align === "right" ? -used : 0) - (align === "right" ? indentR : 0);
      else u0 = ind + (align === "center" ? (W - used) / 2 : align === "right" ? W - used : 0);
      // positions along the inline axis
      const us: number[] = [];
      let u = 0;
      for (let k = 0; k < cs.length; k++) { us.push(u); u += advs[k]!; }
      const lineIndex = lines.length, from = glyphs.length;
      for (let k = 0; k < cs.length; k++) {
        const c = cs[k]!;
        let uu = us[k]!;
        if (rtl) uu = used - (uu + advs[k]!);
        const g: Glyph = { i: c.i, len: c.len, ch: c.ch, text: c.text, x: 0, y: 0, angle: 0, adv: advs[k]!, size: c.size, asc: c.asc, desc: c.desc, shift: c.shift, style: c.style, font: c.font, line: lineIndex, space: c.space, hyphen: c.hyphen, rtl, hidden: lineOverflow };
        place(g, u0 + uu, baseline);
        glyphs.push(g);
      }
      const L: Line = { index: lineIndex, para: pi, start: rl.start, end: rl.last ? pStart + pLen : rl.end, from, to: glyphs.length, baseline, asc, desc, lead, width, lastInPara: rl.last, rtl, overflow: lineOverflow, ex: 0, ey: 0 };
      // empty line caret point
      const e = { x: 0, y: 0, angle: 0, shift: 0, upright: false } as Glyph;
      place(e, rtl ? u0 + used : u0, baseline);
      L.ex = e.x; L.ey = e.y;
      lines.push(L);
    });
    blockPos += ps.spaceAfter * scale;
    pStart += pLen + 1;
  });

  /** Map inline u / block v to geometry space for the frame. */
  function place(g: Glyph, u: number, v: number): void {
    if (frame.type === "path") { g.x = u; g.y = v; return; } // positioned along the path below
    if (vertical) {
      const right = frame.type === "box" ? frame.x + frame.w : frame.x;
      const top = frame.y;
      // columns from the right; the first column's center sits half a column in (box) or on the anchor (point)
      g.x = right - v + g.shift; g.y = top + u; g.angle = Math.PI / 2; g.upright = true;
      return;
    }
    g.x = frame.x + u; g.y = frame.y + v - g.shift;
  }

  if (frame.type === "path") placeOnPath(glyphs, frame, vertical);

  const layout: TextLayout = { text: plain, glyphs, lines, bounds: null, vertical, path: isPath, overflow, scale, frame };
  layout.bounds = glyphBounds(glyphs);
  return layout;
}

/** Glyphs along a path: the line's inline position becomes the distance along the path. */
function placeOnPath(glyphs: Glyph[], frame: Extract<TextData["frame"], { type: "path" }>, _vertical: boolean): void {
  let pts: [number, number][] = [];
  for (const sp of frame.path.subpaths) { const f = flatten(sp, 0.25); if (sp.closed && f.length) f.push(f[0]!); pts = pts.concat(f); }
  if (frame.side === "below") pts.reverse();
  const cum: number[] = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1]! + Math.hypot(pts[k]![0] - pts[k - 1]![0], pts[k]![1] - pts[k - 1]![1]));
  const total = cum[cum.length - 1] ?? 0;
  const at = (s: number): [number, number, number] => {
    if (pts.length < 2) return [pts[0]?.[0] ?? 0, pts[0]?.[1] ?? 0, 0];
    let k = 1;
    while (k < cum.length - 1 && cum[k]! < s) k++;
    const a = pts[k - 1]!, b = pts[k]!, l = cum[k]! - cum[k - 1]! || 1, t = (s - cum[k - 1]!) / l;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, Math.atan2(b[1] - a[1], b[0] - a[0])];
  };
  for (const g of glyphs) {
    const mid = frame.offset + g.x + g.adv / 2;
    if (mid < 0 || mid > total || g.y !== glyphs[0]!.y) { g.hidden = true; }
    const [px, py, ang] = at(Math.max(0, Math.min(total, mid)));
    // baseline start: back half an advance along the tangent; baseline shift along the normal (up)
    const ux = Math.sin(ang), uy = -Math.cos(ang);
    g.x = px - Math.cos(ang) * g.adv / 2 + ux * g.shift;
    g.y = py - Math.sin(ang) * g.adv / 2 + uy * g.shift;
    g.angle = ang;
  }
}

/** Corners of a glyph's box (advance × ascent+descent), in geometry space. */
export function glyphQuad(g: Glyph, inset = 0): [number, number][] {
  const c = Math.cos(g.angle), s = Math.sin(g.angle);
  // local (along, up) → world; up = (sin, −cos)
  const P = (a: number, up: number): [number, number] => [g.x + c * a + s * up, g.y + s * a - c * up];
  const a0 = inset, a1 = g.adv - inset;
  return [P(a0, g.asc), P(a1, g.asc), P(a1, -g.desc), P(a0, -g.desc)];
}

function glyphBounds(glyphs: Glyph[]): Rect | null {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const g of glyphs) {
    if (g.hidden) continue;
    for (const [x, y] of glyphQuad(g)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  }
  return x1 < x0 ? null : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

// ——— caret and selection ———

export interface Caret { index: number; line: number; /** top and bottom of the caret bar */ x1: number; y1: number; x2: number; y2: number }

/** Caret bars for every plain-text index 0 … length. */
export function carets(L: TextLayout): Caret[] {
  if (L.carets) return L.carets;
  const out: Caret[] = new Array(L.text.length + 1);
  for (const line of L.lines) {
    const gs = L.glyphs.slice(line.from, line.to).filter((g) => !g.hyphen);
    for (const g of gs) {
      const [bx, by] = edge(g, false);
      for (let k = 0; k < g.len; k++) out[g.i + k] ??= barAt(line, bx, by, g.angle, g.i + k);
    }
    if (line.lastInPara) {
      const last = gs[gs.length - 1];
      if (last) { const [bx, by] = edge(last, true); out[line.end] = barAt(line, bx, by, last.angle, line.end); }
      else out[line.end] = barAt(line, line.ex, line.ey, L.vertical ? Math.PI / 2 : 0, line.end);
    }
  }
  // indices inside a cluster or otherwise missing take the previous bar
  for (let k = 0; k < out.length; k++) if (!out[k]) out[k] = { ...(out[k - 1] ?? { index: 0, line: 0, x1: 0, y1: 0, x2: 0, y2: 0 }), index: k };
  L.carets = out;
  return out;
}

/** The caret bar at an index. */
export const caretAt = (L: TextLayout, index: number): Caret => carets(L)[Math.max(0, Math.min(L.text.length, index))]!;

/** Axis-aligned box of a line (caret bars and glyph boxes). */
export function lineBox(L: TextLayout, line: number): Rect {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const add = (x: number, y: number): void => { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); };
  for (const c of carets(L)) if (c.line === line) { add(c.x1, c.y1); add(c.x2, c.y2); }
  const ln = L.lines[line]!;
  for (let k = ln.from; k < ln.to; k++) for (const [x, y] of glyphQuad(L.glyphs[k]!)) add(x, y);
  return x1 < x0 ? { x: ln.ex, y: ln.ey, w: 0, h: 0 } : { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}

/** Boxes of every line (selection highlight, overflow checks, tests). */
export const lineBoxes = (L: TextLayout): Rect[] => L.lines.map((_, i) => lineBox(L, i));

const distToRect = (r: Rect, x: number, y: number): number => Math.hypot(Math.max(r.x - x, 0, x - (r.x + r.w)), Math.max(r.y - y, 0, y - (r.y + r.h)));

/** The plain-text index nearest to a point (click to place the caret). */
export function hitTest(L: TextLayout, x: number, y: number): number {
  if (!L.lines.length) return 0;
  let best = 0, bd = Infinity;
  L.lines.forEach((_, i) => { const d = distToRect(lineBox(L, i), x, y); if (d < bd - 1e-9) { bd = d; best = i; } });
  let idx = 0, cd = Infinity;
  for (const c of carets(L)) {
    if (c.line !== best) continue;
    const d = Math.hypot((c.x1 + c.x2) / 2 - x, (c.y1 + c.y2) / 2 - y);
    if (d < cd - 1e-9) { cd = d; idx = c.index; }
  }
  return idx;
}

/** A caret-like bar at a baseline point of a line. */
function barAt(line: Line, x: number, y: number, angle: number, index: number): Caret {
  const s = Math.sin(angle), c = Math.cos(angle);
  return { index, line: line.index, x1: x + s * line.asc, y1: y - c * line.asc, x2: x - s * line.desc, y2: y + c * line.desc };
}

/** Baseline point of a glyph's leading (or trailing) edge, on the line's baseline. */
function edge(g: Glyph, trailing: boolean): [number, number] {
  const along = (g.rtl ? !trailing : trailing) ? g.adv : 0;
  const c = Math.cos(g.angle), s = Math.sin(g.angle);
  return [g.x + c * along - (g.upright ? g.shift : s * g.shift), g.y + s * along + (g.upright ? 0 : c * g.shift)];
}

/** Selection highlight quads between two indices (one per line piece). */
export function selectionQuads(L: TextLayout, a: number, b: number): [number, number][][] {
  if (a > b) [a, b] = [b, a];
  const out: [number, number][][] = [];
  const cs = carets(L);
  for (const line of L.lines) {
    const s = Math.max(a, line.start), e = Math.min(b, line.end);
    if (s >= e && !(s === e && line.lastInPara && a < line.end && b > line.end)) continue;
    const p = cs[s]!;
    let q = cs[e]!;
    if (q.line !== line.index) {
      const last = L.glyphs.slice(line.from, line.to).filter((g) => !g.hyphen).pop();
      if (!last) continue;
      const [tx, ty] = edge(last, true);
      q = barAt(line, tx, ty, last.angle, e);
    }
    out.push([[p.x1, p.y1], [q.x1, q.y1], [q.x2, q.y2], [p.x2, p.y2]]);
  }
  return out;
}

const WORD = /[\p{L}\p{N}_]/u;

/** Move the caret: left / right / up / down / line start / line end / word left / word right / text start / end. */
export function moveCaret(L: TextLayout, index: number, how: "left" | "right" | "up" | "down" | "home" | "end" | "wordLeft" | "wordRight" | "start" | "finish"): number {
  const n = L.text.length, cs = carets(L), cur = cs[Math.max(0, Math.min(n, index))]!;
  switch (how) {
    case "left": return Math.max(0, index - 1);
    case "right": return Math.min(n, index + 1);
    case "start": return 0;
    case "finish": return n;
    case "home": return L.lines[cur.line]?.start ?? 0;
    case "end": { const ln = L.lines[cur.line]!; return ln.lastInPara ? ln.end : Math.max(ln.start, ln.end - 1); }
    case "wordLeft": { let i = index; while (i > 0 && !WORD.test(L.text[i - 1]!)) i--; while (i > 0 && WORD.test(L.text[i - 1]!)) i--; return i; }
    case "wordRight": { let i = index; while (i < n && !WORD.test(L.text[i]!)) i++; while (i < n && WORD.test(L.text[i]!)) i++; return i; }
    case "up": case "down": {
      const target = cur.line + (how === "up" ? -1 : 1);
      if (target < 0) return 0;
      if (target >= L.lines.length) return n;
      const mx = (cur.x1 + cur.x2) / 2, my = (cur.y1 + cur.y2) / 2;
      let best = index, bd = Infinity;
      for (const c of cs) {
        if (c.line !== target) continue;
        const d = L.vertical ? Math.abs((c.y1 + c.y2) / 2 - my) : Math.abs((c.x1 + c.x2) / 2 - mx);
        if (d < bd) { bd = d; best = c.index; }
      }
      return best;
    }
  }
}

// ——— warp ———

/**
 * The warp of a text as a forward map over its bounds. Uses `textEnv.warpPreset` (transform/warp.ts) when injected;
 * otherwise a minimal built-in mapping — TO BE REPLACED by transform/warp.ts — that follows the classic styles
 * closely enough for previews: arc is a true polar arc, the others displace or scale columns / rows.
 */
export function warpMap(w: TextWarp | undefined, b: Rect | null): ((x: number, y: number) => [number, number]) | null {
  if (!w || w.style === "none" || !b || b.w <= 0 || b.h <= 0) return null;
  const injected = textEnv.warpPreset?.(w, b);
  if (injected) return injected;
  const f = (v: number): number => (Math.abs(v) > 1 ? v / 100 : v);
  const B = f(w.bend), hd = f(w.hDistort), vd = f(w.vDistort);
  const cx = b.x + b.w / 2, cy = b.y + b.h / 2, H = b.h, Wd = b.w;
  const core = (x: number, y: number): [number, number] => {
    const u = ((x - b.x) / Wd) * 2 - 1, v = (y - b.y) / H; // u −1…1, v 0 (top) … 1 (bottom)
    const bell = 1 - u * u;
    switch (w.style) {
      case "arc": {
        if (Math.abs(B) < 1e-4) return [x, y];
        const th = (u * B * Math.PI) / 2, R = Wd / 2 / Math.abs((B * Math.PI) / 2);
        if (B > 0) { const r = R + H - (y - b.y); return [cx + r * Math.sin(th), b.y + H + R - r * Math.cos(th)]; }
        const r = R + (y - b.y); return [cx + r * Math.sin(-th), b.y - R + r * Math.cos(th)];
      }
      case "arc-lower": return [x, y + B * H * 0.5 * bell * v];
      case "arc-upper": return [x, y - B * H * 0.5 * bell * (1 - v)];
      case "arch": return [x, y - B * H * 0.5 * bell];
      case "bulge": return [x, cy + (y - cy) * (1 + B * bell)];
      case "shell-lower": return [x, y + B * H * 0.5 * u * u * v];
      case "shell-upper": return [x, y - B * H * 0.5 * u * u * (1 - v)];
      case "flag": return [x, y + B * H * 0.35 * Math.sin(Math.PI * u)];
      case "wave": return [x, y + B * H * 0.35 * Math.sin(Math.PI * u) * (2 * v - 1)];
      case "fish": return [x, cy + (y - cy) * (1 + B * (0.5 - 0.5 * u))];
      case "rise": return [x, y - B * H * 0.5 * u];
      case "fisheye": { const vv = 2 * v - 1, r2 = Math.min(1, u * u + vv * vv), k = 1 + B * 0.5 * (1 - r2); return [cx + (x - cx) * k, cy + (y - cy) * k]; }
      case "inflate": { const vv = 2 * v - 1; return [cx + (x - cx) * (1 + B * 0.3 * (1 - vv * vv)), cy + (y - cy) * (1 + B * 0.3 * bell)]; }
      case "squeeze": { const vv = 2 * v - 1; return [cx + (x - cx) * (1 - B * 0.4 * (1 - vv * vv)), cy + (y - cy) * (1 + B * 0.3 * bell)]; }
      case "twist": { const a = B * (Math.PI / 4) * u, dx = x - cx, dy = y - cy; return [cx + dx * Math.cos(a) - dy * Math.sin(a), cy + dx * Math.sin(a) + dy * Math.cos(a)]; }
      default: return [x, y];
    }
  };
  return (x, y) => {
    let [X, Y] = core(x, y);
    if (hd || vd) {
      const u = ((x - b.x) / Wd) * 2 - 1, v = ((y - b.y) / H) * 2 - 1;
      Y = cy + (Y - cy) * (1 + hd * u * 0.5);
      X = cx + (X - cx) * (1 + vd * v * 0.5);
    }
    return [X, Y];
  };
}

/** Geometry → document: warp then the placement matrix. Null when the text is not transformed. */
export function textTransform(t: TextData, L: TextLayout): ((x: number, y: number) => [number, number]) | null {
  const warp = warpMap(t.warp, L.bounds);
  const m = t.matrix && t.matrix.length >= 6 && !(t.matrix[0] === 1 && t.matrix[1] === 0 && t.matrix[2] === 0 && t.matrix[3] === 1 && t.matrix[4] === 0 && t.matrix[5] === 0) ? t.matrix : null;
  if (!warp && !m) return null;
  return (x, y) => {
    let p: [number, number] = warp ? warp(x, y) : [x, y];
    if (m) p = [m[0]! * p[0] + m[2]! * p[1] + m[4]!, m[1]! * p[0] + m[3]! * p[1] + m[5]!];
    return p;
  };
}

