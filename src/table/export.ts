// CSV / JSON export and file download (Blob + object URL, revoked right after).
import { valueOf, type Column, type Row } from "./filters.ts";

/** Raw value → plain export value. */
export function rawValue(v: unknown): unknown {
  if (v == null) return "";
  if (v instanceof Date) return isNaN(v.getTime()) ? "" : v.toISOString();
  if (Array.isArray(v)) return v.map(rawValue).join("; ");
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

/** Quote one CSV field (RFC 4180). With `safe`, text starting with = + - @ is prefixed so spreadsheets do not run it. */
export function csvField(v: unknown, separator = ",", safe = true): string {
  let s = String(v ?? "");
  if (safe && /^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
  return /["\r\n]/.test(s) || s.includes(separator) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

type CellFormatter<R> = (row: R, col: Column<R>) => unknown;
export interface CSVOptions<R = Row> { bom?: boolean; formatted?: boolean; separator?: string; eol?: string; header?: boolean; safe?: boolean; format?: CellFormatter<R> }
export interface JSONOptions<R = Row> { formatted?: boolean; space?: number | string; format?: CellFormatter<R> }

const exportable = <R>(columns: readonly Column<R>[]): Column<R>[] => columns.filter((c) => c.export !== false && (c.key != null || c.exportValue));
function cell<R>(row: R, c: Column<R>, formatted: boolean, format: CellFormatter<R>): unknown {
  if (c.exportValue) return c.exportValue(row);
  return formatted ? format(row, c) : rawValue(valueOf(row, c));
}

/** Rows to CSV text with the table's columns (formula-safe, optional BOM, formatted or raw values). */
export function toCSV<R>(rows: readonly R[], columns: readonly Column<R>[], opts: CSVOptions<R> = {}): string {
  const { bom = false, formatted = false, separator = ",", eol = "\r\n", header = true, safe = true, format = (r: R, c: Column<R>) => rawValue(valueOf(r, c)) } = opts;
  const cols = exportable(columns);
  const lines: string[] = [];
  if (header) lines.push(cols.map((c) => csvField(c.label ?? c.key, separator, safe)).join(separator));
  for (const r of rows) lines.push(cols.map((c) => csvField(cell(r, c, formatted, format), separator, safe)).join(separator));
  return (bom ? String.fromCharCode(0xfeff) : "") + lines.join(eol);
}

/** JSON array of objects keyed by column key (raw values unless `formatted`). */
export function toJSON<R>(rows: readonly R[], columns: readonly Column<R>[], opts: JSONOptions<R> = {}): string {
  const { formatted = false, format = (r: R, c: Column<R>) => rawValue(valueOf(r, c)), space = 2 } = opts;
  const cols = exportable(columns);
  const out = rows.map((r) => {
    const o: Record<string, unknown> = {};
    for (const c of cols) { const v = c.exportValue ? c.exportValue(r) : formatted ? format(r, c) : valueOf(r, c); o[String(c.key)] = v === undefined ? null : v; }
    return o;
  });
  return JSON.stringify(out, null, space);
}

/** Save text as a file through a temporary object URL. */
export function download(filename: string, text: string, type = "text/plain;charset=utf-8"): string {
  const doc = globalThis.document;
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = doc.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("download", filename);
  // a detached link is enough for click(): nothing is added to the page
  try { a.click(); } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return url;
}
