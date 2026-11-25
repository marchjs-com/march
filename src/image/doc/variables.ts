// Variables and data sets (data-driven graphics): a layer variable drives a layer's visibility, its text or its pixels;
// a data set gives every variable a value. Data sets come from CSV (RFC 4180, quoted fields, Turkish and other UTF-8
// text, a BOM, ";" "," or tab separators detected), are applied as one undo step, and can be exported one file each.

import type { DataSet, ImageDocument } from "./document.ts";
import { newId, walk, type Layer, type TextLayer } from "./layers.ts";
import type { Rect } from "./tiles.ts";
import { exportImage, fileSafe, EXTENSIONS, resampleRGBA, type ExportOptions } from "./export/index.ts";

export type VariableKind = "visibility" | "text" | "pixels";
export interface Variable { name: string; kind: VariableKind; layerId: string }

/** A variable name as data sets use it (letters, digits, _ . -; must not start with a digit). */
export function validVariableName(s: string): boolean { return /^[\p{L}_][\p{L}\p{N}_.-]*$/u.test(s); }

/** Bind a variable to a layer (call inside doc.change). Text variables need a text layer. */
export function defineVariable(doc: ImageDocument, layerId: string, name: string, kind: VariableKind): void {
  const l = doc.find(layerId);
  if (!l) throw new Error(`No layer ${layerId}`);
  if (!validVariableName(name)) throw new Error(`Invalid variable name "${name}"`);
  if (kind === "text" && l.kind !== "text") throw new Error("Text replacement needs a text layer");
  if (kind === "pixels" && l.kind !== "pixel") throw new Error("Pixel replacement needs a pixel layer");
  for (const v of variables(doc)) if (v.name === name && v.layerId !== layerId) throw new Error(`Variable "${name}" is already used`);
  l.variable = { name, kind };
}

/** Remove a layer's variable (inside doc.change). */
export function removeVariable(doc: ImageDocument, layerId: string): void { const l = doc.find(layerId); if (l) delete l.variable; }

/** Every variable of the document. */
export function variables(doc: ImageDocument): Variable[] {
  const out: Variable[] = [];
  for (const [l] of walk(doc.layers)) if (l.variable) out.push({ name: l.variable.name, kind: l.variable.kind, layerId: l.id });
  return out;
}

// ——— CSV ———

/** Guess the separator from the first record (outside quotes): ";", tab or ",". */
export function detectSeparator(text: string): string {
  const counts: Record<string, number> = { ",": 0, ";": 0, "\t": 0 };
  let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i]!;
    if (c === '"') q = !q;
    else if (!q && (c === "\n" || c === "\r")) break;
    else if (!q && c in counts) counts[c]!++;
  }
  return counts[";"]! > counts[","]! && counts[";"]! >= counts["\t"]! ? ";" : counts["\t"]! > counts[","]! ? "\t" : ",";
}

/** Parse CSV (RFC 4180: quotes, doubled quotes, separators and line breaks inside quotes, CRLF / LF / CR). */
export function parseCsv(text: string, opts: { separator?: string } = {}): string[][] {
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1);
  const sep = opts.separator ?? detectSeparator(text);
  const rows: string[][] = [];
  let row: string[] = [], field = "", q = false, i = 0, quoted = false;
  const endField = (): void => { row.push(quoted ? field : field.trim()); field = ""; quoted = false; };
  const endRow = (): void => { endField(); if (row.length > 1 || row[0] !== "") rows.push(row); row = []; };
  while (i < text.length) {
    const c = text[i]!;
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { field += '"'; i += 2; continue; } q = false; i++; continue; }
      field += c; i++; continue;
    }
    if (c === '"' && field.trim() === "") { q = true; quoted = true; field = ""; i++; continue; }
    if (c === sep) { endField(); i++; continue; }
    if (c === "\r") { endRow(); i += text[i + 1] === "\n" ? 2 : 1; continue; }
    if (c === "\n") { endRow(); i++; continue; }
    if (quoted && (c === " " || c === "	")) { i++; continue; } // spaces after a closing quote
    field += c; i++;
  }
  if (field !== "" || quoted || row.length) endRow();
  return rows;
}

const TRUE = new Set(["true", "1", "yes", "visible", "on", "evet", "doğru", "görünür"]);
const FALSE = new Set(["false", "0", "no", "invisible", "hidden", "off", "hayır", "yanlış", "gizli"]);
/** Visibility values: true / false, 1 / 0, yes / no, visible / invisible (Turkish words too). */
export function parseVisibility(v: string | boolean): boolean | null {
  if (typeof v === "boolean") return v;
  const s = v.trim().toLocaleLowerCase("tr");
  return TRUE.has(s) ? true : FALSE.has(s) ? false : null;
}

/**
 * Data sets from CSV: the first row names the variables, every next row is a data set. A column named "name" (or
 * "Data Set") names the set. Visibility variables get booleans.
 */
export function dataSetsFromCsv(doc: ImageDocument, csv: string, opts: { separator?: string } = {}): DataSet[] {
  const rows = parseCsv(csv, opts);
  if (rows.length < 2) return [];
  const head = rows[0]!.map((h) => h.trim());
  const kinds = new Map(variables(doc).map((v) => [v.name, v.kind]));
  const nameCol = head.findIndex((h) => /^(name|data ?set|veri ?kümesi)$/i.test(h));
  return rows.slice(1).map((r, i) => {
    const values: Record<string, string | boolean> = {};
    head.forEach((h, k) => {
      if (k === nameCol || !h) return;
      const v = r[k] ?? "";
      values[h] = kinds.get(h) === "visibility" ? parseVisibility(v) ?? v : v;
    });
    return { id: newId("ds"), name: nameCol >= 0 && r[nameCol] ? r[nameCol]! : `Data Set ${i + 1}`, values };
  });
}

/** Import CSV data sets into the document (one undo step); returns the new sets. */
export function importDataSets(doc: ImageDocument, csv: string, opts: { separator?: string; replace?: boolean } = {}): DataSet[] {
  const sets = dataSetsFromCsv(doc, csv, opts);
  doc.change("Import Data Sets", () => { doc.dataSets = opts.replace ? sets : [...doc.dataSets, ...sets]; });
  return sets;
}

/** Data sets as CSV (UTF-8, quoted where needed). */
export function dataSetsToCsv(doc: ImageDocument, separator = ","): string {
  const names = [...new Set([...variables(doc).map((v) => v.name), ...doc.dataSets.flatMap((d) => Object.keys(d.values))])];
  const q = (s: string): string => (/[",;\t\r\n]/.test(s) || s !== s.trim() ? `"${s.replace(/"/g, '""')}"` : s);
  const lines = [["name", ...names].map(q).join(separator)];
  for (const d of doc.dataSets) lines.push([d.name, ...names.map((n) => String(d.values[n] ?? ""))].map(q).join(separator));
  return lines.join("\r\n") + "\r\n";
}

// ——— applying ———

/** Pixels for a pixel-replacement value (a file path, URL or key): straight RGBA floats. */
export type PixelLoader = (value: string) => Promise<{ width: number; height: number; data: Float32Array }>;

export interface ApplyOptions {
  /** Loads images for pixel variables (required when the set has any). */
  loadPixels?: PixelLoader | undefined;
  /** How replaced pixels fit the layer's box: fit inside (default), fill (crop), as is, or stretch. */
  fit?: "fit" | "fill" | "as-is" | "stretch" | undefined;
}

/** Replace a text layer's text, keeping the first run's style on every line. */
export function replaceText(l: TextLayer, value: string): void {
  const firstPara = l.text.paragraphs[0];
  const style = firstPara?.runs[0]?.style ?? {};
  const pstyle = firstPara?.style ?? {};
  l.text = { ...l.text, paragraphs: value.split(/\r\n?|\n/).map((line) => ({ runs: [{ text: line, style: { ...style } }], style: { ...pstyle } })) };
}

/** Apply a data set: visibility, text and pixels change in one undo step. */
export async function applyDataSet(doc: ImageDocument, set: DataSet | string, o: ApplyOptions = {}): Promise<void> {
  const ds = typeof set === "string" ? doc.dataSets.find((d) => d.id === set || d.name === set) : set;
  if (!ds) throw new Error(`No data set ${String(set)}`);
  const vars = variables(doc);
  // load images first: the change itself is synchronous
  const images = new Map<string, { width: number; height: number; data: Float32Array }>();
  for (const v of vars) {
    const val = ds.values[v.name];
    if (v.kind !== "pixels" || typeof val !== "string" || !val) continue;
    if (!o.loadPixels) throw new Error("Pixel variables need a loadPixels function");
    images.set(v.name, await o.loadPixels(val));
  }
  doc.change(`Apply Data Set "${ds.name}"`, () => {
    for (const v of vars) {
      const val = ds.values[v.name];
      if (val === undefined) continue;
      const l = doc.find(v.layerId);
      if (!l) continue;
      if (v.kind === "visibility") { const b = parseVisibility(val); if (b !== null) l.visible = b; }
      else if (v.kind === "text" && l.kind === "text") replaceText(l, String(val));
      else if (v.kind === "pixels" && l.kind === "pixel") { const img = images.get(v.name); if (img) placePixels(l, img, o.fit ?? "fit"); }
    }
  }, "data-set");
}

/** Put an image into a pixel layer's current box (or the image size at the layer's origin when it is empty). */
function placePixels(l: Layer & { kind: "pixel" }, img: { width: number; height: number; data: Float32Array }, fit: NonNullable<ApplyOptions["fit"]>): void {
  const box: Rect = l.raster.bounds() ?? { x: l.raster.ox, y: l.raster.oy, w: img.width, h: img.height };
  let w = img.width, h = img.height;
  if (fit === "stretch") { w = box.w; h = box.h; }
  else if (fit !== "as-is") {
    const k = fit === "fit" ? Math.min(box.w / img.width, box.h / img.height) : Math.max(box.w / img.width, box.h / img.height);
    w = Math.max(1, Math.round(img.width * k)); h = Math.max(1, Math.round(img.height * k));
  }
  let px = img.data;
  if (w !== img.width || h !== img.height) {
    const pm = img.data.slice();
    for (let i = 0; i < pm.length; i += 4) { const a = pm[i + 3]!; pm[i] = pm[i]! * a; pm[i + 1] = pm[i + 1]! * a; pm[i + 2] = pm[i + 2]! * a; }
    px = resampleRGBA(pm, img.width, img.height, w, h); // fallback until march/image lands
    for (let i = 0; i < px.length; i += 4) { const a = px[i + 3]!; if (a > 0) { px[i] = px[i]! / a; px[i + 1] = px[i + 1]! / a; px[i + 2] = px[i + 2]! / a; } }
  }
  const x = Math.round(box.x + (box.w - w) / 2), y = Math.round(box.y + (box.h - h) / 2);
  l.raster.clear();
  if (fit === "fill") {
    // crop to the box
    const cx = Math.max(x, box.x), cy = Math.max(y, box.y), cw = Math.min(x + w, box.x + box.w) - cx, ch = Math.min(y + h, box.y + box.h) - cy;
    const out = new Float32Array(cw * ch * 4);
    for (let yy = 0; yy < ch; yy++) out.set(px.subarray(((cy - y + yy) * w + (cx - x)) * 4, ((cy - y + yy) * w + (cx - x) + cw) * 4), yy * cw * 4);
    l.raster.write(cx, cy, cw, ch, out);
  } else l.raster.write(x, y, w, h, px);
}

/** Export every data set as a file (each applied, exported, then undone). Returns { name, bytes } per set. */
export async function exportDataSets(doc: ImageDocument, o: ExportOptions & ApplyOptions & { fileName?: (set: DataSet, index: number) => string }): Promise<{ name: string; bytes: Uint8Array; mime: string }[]> {
  const out: { name: string; bytes: Uint8Array; mime: string }[] = [];
  for (let i = 0; i < doc.dataSets.length; i++) {
    const ds = doc.dataSets[i]!;
    const before = doc.history.index;
    await applyDataSet(doc, ds, o);
    const r = await exportImage(doc, o);
    out.push({ name: o.fileName?.(ds, i) ?? `${fileSafe(ds.name)}.${EXTENSIONS[o.format]}`, bytes: r.bytes, mime: r.mime });
    while (doc.history.index > before) doc.undo();
  }
  return out;
}
