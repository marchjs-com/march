// CSV / JSON export and file download (Blob + object URL, revoked right after).
import { valueOf } from "./filters.js";

/** Raw value → plain export value. */
export function rawValue(v) {
  if (v == null) return "";
  if (v instanceof Date) return isNaN(v) ? "" : v.toISOString();
  if (Array.isArray(v)) return v.map(rawValue).join("; ");
  if (typeof v === "object") return JSON.stringify(v);
  return v;
}

/** Quote one CSV field (RFC 4180). With `safe`, text starting with = + - @ is prefixed so spreadsheets do not run it. */
export function csvField(v, separator = ",", safe = true) {
  let s = String(v ?? "");
  if (safe && /^[=+\-@\t\r]/.test(s) && !/^[+-]?\d+([.,]\d+)?$/.test(s)) s = `'${s}`;
  return /["\r\n]/.test(s) || s.includes(separator) || /^\s|\s$/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const exportable = (columns) => columns.filter((c) => c.export !== false && (c.key != null || c.exportValue));
function cell(row, c, formatted, format) {
  if (c.exportValue) return c.exportValue(row);
  return formatted ? format(row, c) : rawValue(valueOf(row, c));
}

/**
 * @param {any[]} rows @param {any[]} columns
 * @param {{ bom?: boolean, formatted?: boolean, separator?: string, eol?: string, header?: boolean, safe?: boolean,
 *           format?: (row:any, col:any) => string }} [opts]
 */
export function toCSV(rows, columns, opts = {}) {
  const { bom = false, formatted = false, separator = ",", eol = "\r\n", header = true, safe = true, format = (r, c) => rawValue(valueOf(r, c)) } = opts;
  const cols = exportable(columns);
  const lines = [];
  if (header) lines.push(cols.map((c) => csvField(c.label ?? c.key, separator, safe)).join(separator));
  for (const r of rows) lines.push(cols.map((c) => csvField(cell(r, c, formatted, format), separator, safe)).join(separator));
  return (bom ? String.fromCharCode(0xfeff) : "") + lines.join(eol);
}

/** JSON array of objects keyed by column key (raw values unless `formatted`). */
export function toJSON(rows, columns, opts = {}) {
  const { formatted = false, format = (r, c) => rawValue(valueOf(r, c)), space = 2 } = opts;
  const cols = exportable(columns);
  const out = rows.map((r) => {
    const o = {};
    for (const c of cols) { const v = c.exportValue ? c.exportValue(r) : formatted ? format(r, c) : valueOf(r, c); o[c.key] = v === undefined ? null : v; }
    return o;
  });
  return JSON.stringify(out, null, space);
}

/** Save text as a file through a temporary object URL. */
export function download(filename, text, type = "text/plain;charset=utf-8") {
  const doc = globalThis.document;
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = doc.createElement("a");
  a.setAttribute("href", url);
  a.setAttribute("download", filename);
  a.className = "hm-sr-only";
  doc.body.appendChild(a);
  try { a.click(); } finally {
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return url;
}
