// Character and paragraph styles and run editing. Named styles live in the document (doc.meta.textStyles, so they are
// saved and undone with it); runs and paragraphs refer to them by `styleRef` and keep local overrides in `style`.
// Resolution order: text defaults ← paragraph style's character part ← character style (with basedOn chain) ← run
// overrides. The run helpers edit a TextData in place by plain-text index (UTF-16, paragraphs joined by "\n"); call
// them inside doc.change() (or a type session) so they are one history step.

import type { ImageDocument } from "../document.ts";
import { DEFAULT_CHAR, DEFAULT_PARA, type CharStyle, type ParaStyle, type TextData, type TextParagraph, type TextRun } from "../text-model.ts";

export interface NamedCharStyle { name: string; style: Partial<CharStyle>; basedOn?: string | undefined }
export interface NamedParaStyle { name: string; style: Partial<ParaStyle>; char?: Partial<CharStyle> | undefined; basedOn?: string | undefined }
export interface StyleSheet { char: Record<string, NamedCharStyle>; para: Record<string, NamedParaStyle> }

export const emptySheet = (): StyleSheet => ({ char: {}, para: {} });

/** The document's style sheet (empty when none is defined yet). */
export function styleSheet(doc: ImageDocument): StyleSheet {
  const s = doc.meta.textStyles as StyleSheet | undefined;
  return s && s.char && s.para ? s : emptySheet();
}

function writableSheet(doc: ImageDocument): StyleSheet {
  const s = styleSheet(doc);
  const copy: StyleSheet = { char: { ...s.char }, para: { ...s.para } };
  doc.meta = { ...doc.meta, textStyles: copy };
  return copy;
}

/** Define or redefine a character style (one history step). Returns its id. */
export function defineCharStyle(doc: ImageDocument, id: string, name: string, style: Partial<CharStyle>, basedOn?: string): string {
  doc.change("Character Style", () => { writableSheet(doc).char[id] = { name, style: { ...style }, basedOn }; }, "text");
  return id;
}

/** Define or redefine a paragraph style (one history step). */
export function defineParaStyle(doc: ImageDocument, id: string, name: string, style: Partial<ParaStyle>, char?: Partial<CharStyle>, basedOn?: string): string {
  doc.change("Paragraph Style", () => { writableSheet(doc).para[id] = { name, style: { ...style }, char: char ? { ...char } : undefined, basedOn }; }, "text");
  return id;
}

/** Delete a named style; references to it fall back to the defaults. */
export function deleteStyle(doc: ImageDocument, kind: "char" | "para", id: string): void {
  doc.change("Delete Style", () => { delete writableSheet(doc)[kind][id]; }, "text");
}

function chain<T>(map: Record<string, { style: Partial<T>; basedOn?: string | undefined }>, id: string | undefined): Partial<T> {
  const seen = new Set<string>(), parts: Partial<T>[] = [];
  while (id && map[id] && !seen.has(id)) { seen.add(id); parts.unshift(map[id]!.style); id = map[id]!.basedOn; }
  return Object.assign({}, ...parts) as Partial<T>;
}
function paraChain(map: Record<string, NamedParaStyle>, id: string | undefined): Partial<CharStyle> {
  const seen = new Set<string>(), parts: Partial<CharStyle>[] = [];
  while (id && map[id] && !seen.has(id)) { seen.add(id); if (map[id]!.char) parts.unshift(map[id]!.char!); id = map[id]!.basedOn; }
  return Object.assign({}, ...parts) as Partial<CharStyle>;
}

const strip = <T extends object>(o: T): Partial<T> => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)) as Partial<T>;

/** The full character style of a run. */
export function resolveChar(t: TextData, p: TextParagraph, run: TextRun, sheet: StyleSheet = emptySheet()): CharStyle {
  return { ...DEFAULT_CHAR, ...strip(t.char), ...strip(paraChain(sheet.para, p.styleRef)), ...strip(chain(sheet.char, run.styleRef)), ...strip(run.style) } as CharStyle;
}

/** The full paragraph style of a paragraph. */
export function resolvePara(t: TextData, p: TextParagraph, sheet: StyleSheet = emptySheet()): ParaStyle {
  return { ...DEFAULT_PARA, ...strip(t.para), ...strip(chain(sheet.para, p.styleRef)), ...strip(p.style) } as ParaStyle;
}

// ——— run editing ———

const paraLen = (p: TextParagraph): number => p.runs.reduce((n, r) => n + r.text.length, 0);

/** Length of the plain text (paragraph breaks count one). */
export const textLength = (t: TextData): number => t.paragraphs.reduce((n, p) => n + paraLen(p), 0) + Math.max(0, t.paragraphs.length - 1);

/** Paragraph and offset of a plain-text index. */
export function locateIndex(t: TextData, index: number): { para: number; offset: number } {
  let i = Math.max(0, index);
  for (let p = 0; p < t.paragraphs.length; p++) {
    const n = paraLen(t.paragraphs[p]!);
    if (i <= n) return { para: p, offset: i };
    i -= n + 1;
  }
  const last = t.paragraphs.length - 1;
  return { para: last, offset: paraLen(t.paragraphs[last]!) };
}

/** Plain-text index of the start of paragraph p. */
export function paraStart(t: TextData, p: number): number {
  let n = 0;
  for (let i = 0; i < p; i++) n += paraLen(t.paragraphs[i]!) + 1;
  return n;
}

const sameStyle = (a: TextRun, b: TextRun): boolean => a.styleRef === b.styleRef && JSON.stringify(a.style) === JSON.stringify(b.style);
const cloneRun = (r: TextRun, text: string): TextRun => { const n: TextRun = { text, style: { ...r.style } }; if (r.styleRef) n.styleRef = r.styleRef; return n; };

/** Split runs so a run boundary falls at `offset` inside paragraph p; returns the index of the run starting there. */
function splitRunAt(p: TextParagraph, offset: number): number {
  let o = 0;
  for (let i = 0; i < p.runs.length; i++) {
    const r = p.runs[i]!;
    if (offset === o) return i;
    if (offset < o + r.text.length) {
      const k = offset - o;
      p.runs.splice(i, 1, cloneRun(r, r.text.slice(0, k)), cloneRun(r, r.text.slice(k)));
      return i + 1;
    }
    o += r.text.length;
  }
  return p.runs.length;
}

/** Merge neighbouring runs with the same style; keep one (maybe empty) run per paragraph. */
export function normalizeRuns(t: TextData): void {
  for (const p of t.paragraphs) {
    const out: TextRun[] = [];
    for (const r of p.runs) {
      if (!r.text.length) continue;
      const last = out[out.length - 1];
      if (last && sameStyle(last, r)) last.text += r.text;
      else out.push(r);
    }
    p.runs = out.length ? out : [cloneRun(p.runs[0] ?? { text: "", style: {} }, "")];
  }
}

/** The run (style carrier) a caret at `index` types with: the run before it, else the one after. */
export function runAt(t: TextData, index: number): TextRun {
  const { para, offset } = locateIndex(t, index);
  const p = t.paragraphs[para]!;
  let o = 0;
  for (const r of p.runs) {
    if (offset > o && offset <= o + r.text.length) return r;
    o += r.text.length;
  }
  return p.runs[0] ?? { text: "", style: {} };
}

/** Insert text at a plain-text index ("\n" starts a new paragraph with the same paragraph style). */
export function insertText(t: TextData, index: number, s: string, style?: { style: Partial<CharStyle>; styleRef?: string | undefined }): number {
  if (!s) return index;
  const carrier = style ?? runAt(t, index);
  const { para, offset } = locateIndex(t, index);
  const p = t.paragraphs[para]!;
  const lines = s.split("\n");
  const at = splitRunAt(p, offset);
  const mk = (text: string): TextRun => { const r: TextRun = { text, style: { ...carrier.style } }; if (carrier.styleRef) r.styleRef = carrier.styleRef; return r; };
  if (lines.length === 1) {
    p.runs.splice(at, 0, mk(s));
  } else {
    const tail = p.runs.splice(at);
    p.runs.push(mk(lines[0]!));
    const added: TextParagraph[] = [];
    for (let i = 1; i < lines.length; i++) {
      const np: TextParagraph = { runs: [mk(lines[i]!)], style: { ...p.style } };
      if (p.styleRef) np.styleRef = p.styleRef;
      added.push(np);
    }
    added[added.length - 1]!.runs.push(...tail);
    t.paragraphs.splice(para + 1, 0, ...added);
  }
  normalizeRuns(t);
  return index + s.length;
}

/** Delete the plain text between a and b (paragraphs join when a break is deleted). */
export function deleteRange(t: TextData, a: number, b: number): number {
  if (a > b) [a, b] = [b, a];
  const len = textLength(t);
  a = Math.max(0, Math.min(len, a)); b = Math.max(0, Math.min(len, b));
  if (a === b) return a;
  const s = locateIndex(t, a), e = locateIndex(t, b);
  const ps = t.paragraphs[s.para]!, pe = t.paragraphs[e.para]!;
  const eAt = splitRunAt(pe, e.offset);
  const tail = pe.runs.slice(eAt);
  const sAt = splitRunAt(ps, s.offset);
  ps.runs.splice(sAt);
  if (s.para === e.para) {
    // the end split happened before the start split: recompute the tail from the original
    ps.runs.push(...tail);
  } else {
    ps.runs.push(...tail);
    t.paragraphs.splice(s.para + 1, e.para - s.para);
  }
  if (!ps.runs.length) ps.runs.push({ text: "", style: {} });
  normalizeRuns(t);
  return a;
}

/** Make run boundaries at a and b, returning the runs between (with their paragraph). */
function runsBetween(t: TextData, a: number, b: number): TextRun[] {
  if (a > b) [a, b] = [b, a];
  const s = locateIndex(t, a), e = locateIndex(t, b), out: TextRun[] = [];
  for (let p = s.para; p <= e.para; p++) {
    const par = t.paragraphs[p]!;
    const from = p === s.para ? s.offset : 0, to = p === e.para ? e.offset : paraLen(par);
    splitRunAt(par, from);
    splitRunAt(par, to);
    let o = 0;
    for (const r of par.runs) {
      if (o >= from && o + r.text.length <= to && r.text.length) out.push(r);
      o += r.text.length;
    }
  }
  return out;
}

/** Character overrides on a range (font, size, color, tracking…). */
export function applyChar(t: TextData, a: number, b: number, patch: Partial<CharStyle>): void {
  if (a === b) return;
  for (const r of runsBetween(t, a, b)) r.style = { ...r.style, ...patch };
  normalizeRuns(t);
}

/** Apply a named character style to a range (clears those runs' overrides unless `keepOverrides`). */
export function applyCharStyle(t: TextData, a: number, b: number, ref: string | null, keepOverrides = false): void {
  for (const r of runsBetween(t, a, b)) {
    if (ref) r.styleRef = ref; else delete r.styleRef;
    if (!keepOverrides) r.style = {};
  }
  normalizeRuns(t);
}

/** Paragraph indices a range touches. */
export function parasBetween(t: TextData, a: number, b: number): number[] {
  const s = locateIndex(t, Math.min(a, b)).para, e = locateIndex(t, Math.max(a, b)).para, out: number[] = [];
  for (let p = s; p <= e; p++) out.push(p);
  return out;
}

/** Paragraph overrides on every paragraph the range touches. */
export function applyPara(t: TextData, a: number, b: number, patch: Partial<ParaStyle>): void {
  for (const p of parasBetween(t, a, b)) t.paragraphs[p]!.style = { ...t.paragraphs[p]!.style, ...patch };
}

/** Apply a named paragraph style to the paragraphs of a range. */
export function applyParaStyle(t: TextData, a: number, b: number, ref: string | null, keepOverrides = false): void {
  for (const i of parasBetween(t, a, b)) {
    const p = t.paragraphs[i]!;
    if (ref) p.styleRef = ref; else delete p.styleRef;
    if (!keepOverrides) p.style = {};
  }
}

/** Plain text of a range. */
export function textBetween(t: TextData, a: number, b: number): string {
  const s = t.paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n");
  return s.slice(Math.min(a, b), Math.max(a, b));
}
