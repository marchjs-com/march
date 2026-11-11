// Table filtering and sorting primitives: locale folding, per-type filter predicates, chip text, value comparison.
import { toDate } from "../core/pipes.js";
import { t } from "../core/i18n.js";
import { fold, compareText } from "../core/text.js";

export { fold };

/** Read a cell's raw value. */
export const valueOf = (row, col) => (col.value ? col.value(row) : row?.[col.key]);

/** Normalize column `options` to [{ value, label }]. */
export function optionsOf(col) {
  const o = typeof col.options === "function" ? col.options() : col.options ?? [];
  return o.map((x) => (x && typeof x === "object" ? { value: x.value, label: x.label ?? String(x.value) } : { value: x, label: String(x) }));
}

/** True when a filter value means "no filter". */
export function isEmptyFilter(v) {
  if (v == null || v === "") return true;
  if (Array.isArray(v)) return !v.length;
  if (typeof v === "object") return Object.values(v).every((x) => x == null || x === "");
  return false;
}

const pad = (n) => String(n).padStart(2, "0");
/** Local calendar date "YYYY-MM-DD" of any date-like value, or null. */
export function dayOf(v) {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = toDate(v);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : null;
}
const num = (v) => (v == null || v === "" ? null : Number(v));

/** Does `row` pass the filter `f` on column `col`? */
export function matchFilter(row, col, f) {
  if (col.filterFn) return col.filterFn(row, f);
  const v = col.filterValue ? col.filterValue(row) : valueOf(row, col);
  switch (col.filter === true ? "text" : col.filter) {
    case "range": {
      const n = num(v), min = num(f.min), max = num(f.max);
      if (n == null || Number.isNaN(n)) return false;
      return (min == null || n >= min) && (max == null || n <= max);
    }
    case "dateRange": {
      const d = dayOf(v);
      if (!d) return false;
      return (!f.from || d >= dayOf(f.from)) && (!f.to || d <= dayOf(f.to));
    }
    case "select": {
      const want = [].concat(f), have = Array.isArray(v) ? v : [v];
      return have.some((x) => want.some((w) => w === x || String(w) === String(x)));
    }
    case "bool": return !!v === (f === true || f === "true");
    default: {
      const label = col.options ? optionsOf(col).find((o) => o.value === v)?.label : null;
      return fold(label ?? (Array.isArray(v) ? v.join(" ") : v)).includes(fold(f));
    }
  }
}

/** Human text for a filter chip. */
export function describeFilter(col, f) {
  switch (col.filter) {
    case "range": case "dateRange": {
      const [a, b] = col.filter === "range" ? [f.min, f.max] : [f.from, f.to];
      const has = (x) => x != null && x !== "";
      return has(a) && has(b) ? `${a} – ${b}` : has(a) ? `≥ ${a}` : `≤ ${b}`;
    }
    case "select": {
      const opts = optionsOf(col);
      return [].concat(f).map((x) => opts.find((o) => o.value === x || String(o.value) === String(x))?.label ?? String(x)).join(", ");
    }
    case "bool": return f === true || f === "true" ? t`Yes` : t`No`;
    default: return `“${f}”`;
  }
}

/** Sortable key of a value: numbers, dates (time), booleans, strings; null stays null. */
export function sortKey(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  const d = typeof v === "object" ? toDate(v) : null;
  return d ? d.getTime() : String(v);
}

/** Stable multi-column sort. Nulls always last. `sort` = [{ key, dir }]. */
export function sortRows(rows, sort, columns, locale) {
  const specs = [];
  for (const s of sort) {
    const c = columns.find((x) => x.key === s.key);
    if (c) specs.push({ get: c.sortValue ?? ((r) => valueOf(r, c)), dir: s.dir === "desc" ? -1 : 1 });
  }
  if (!specs.length) return rows;
  const dec = rows.map((r, i) => ({ r, i, k: specs.map((s) => sortKey(s.get(r))) }));
  dec.sort((a, b) => {
    for (let j = 0; j < specs.length; j++) {
      const x = a.k[j], y = b.k[j];
      if (x === y) continue;
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === "string" || typeof y === "string" ? compareText(x, y, locale) : x < y ? -1 : x > y ? 1 : 0;
      if (c) return c * specs[j].dir;
    }
    return a.i - b.i;
  });
  return dec.map((d) => d.r);
}

/** URL encoding of filter values: strings stay readable, everything else is JSON. */
export const encodeFilter = (v) => (typeof v === "string" ? v : JSON.stringify(v));
export function decodeFilter(s) {
  if (/^[[{]/.test(s) || s === "true" || s === "false") { try { return JSON.parse(s); } catch { /* plain text */ } }
  return s;
}
