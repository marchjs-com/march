// Table filtering and sorting primitives: locale folding, per-type filter predicates, chip text, value comparison.
import { toDate } from "../core/pipes.ts";
import { t } from "../core/i18n.ts";
import { fold, collator } from "../core/text.ts";
import type { Column as SchemaColumn } from "../schema/index.ts";

export { fold };

/** Default row type: a plain record. */
export type Row = Record<string, unknown>;
export type FilterKind = "text" | "range" | "dateRange" | "select" | "bool";
export interface FilterOption { value: unknown; label: string }
/** `[value, …]` or `[{ value, label? }, …]`, or a function returning one. */
export type OptionsInput = readonly unknown[] | (() => readonly unknown[]);
/** Cell format: a function, a pipe name or `[pipe, ...args]`. */
export type CellFormat<R> = string | readonly [string, ...unknown[]] | ((value: unknown, row: R) => unknown);
export type SortDir = "asc" | "desc";
export interface SortSpec { key: string; dir: SortDir }
export type Pin = "left" | "right";

/** Column definition. `key` is a field of R (or any string for computed columns). */
export interface Column<R = Row> {
  key?: (keyof R & string) | (string & {});
  label?: string;
  /** Field type (inline edit input type): number, date, email, bool… */
  type?: string;
  /** Raw value of the cell (default: `row[key]`). */
  value?(row: R): unknown;
  format?: CellFormat<R>;
  render?(row: R): unknown;
  headerRender?(): unknown;
  headerClass?: unknown;
  cellClass?: unknown;
  options?: OptionsInput;
  /** `true` means "text". */
  filter?: FilterKind | boolean | null;
  filterFn?(row: R, value: unknown): boolean;
  filterValue?(row: R): unknown;
  filterMultiple?: boolean;
  searchable?: boolean;
  searchValue?(row: R): unknown;
  sortable?: boolean;
  sortValue?(row: R): unknown;
  align?: "start" | "center" | "end";
  width?: number;
  minWidth?: number;
  maxWidth?: number;
  pin?: Pin | null;
  hidden?: boolean;
  resizable?: boolean;
  editable?: boolean;
  /** Inline edit validation: message or null. */
  validate?(value: unknown, row: R): string | null | undefined;
  /** `false` leaves the column out of CSV / JSON export. */
  export?: boolean;
  exportValue?(row: R): unknown;
}
/** A column as accepted by `columns`: a definition, a key, or a schema column (`schema.columns()`). */
export type ColumnInput<R = Row> = Column<R> | (keyof R & string) | (string & {}) | SchemaColumn;
/** Normalized column (see `column()`). */
export interface TableColumn<R = Row> extends Column<R> {
  label: string;
  sortable: boolean;
  searchable: boolean;
  align: "start" | "center" | "end";
  minWidth: number;
  filter: FilterKind | false | null;
}

type Dict = Record<string, unknown>;
/** Property `k` of an object-like value (an undefined key reads "undefined", as plain JS does). */
export const prop = (o: unknown, k: string | undefined): unknown => (o as Dict | null | undefined)?.[String(k)];

/** Read a cell's raw value. */
export const valueOf = <R>(row: R, col: Pick<Column<R>, "key" | "value">): unknown => (col.value ? col.value(row) : prop(row, col.key));

/** Normalize column `options` to [{ value, label }]. */
export function optionsOf(col: { options?: OptionsInput | undefined }): FilterOption[] {
  const o = typeof col.options === "function" ? col.options() : col.options ?? [];
  return o.map((x) => (x && typeof x === "object" ? { value: prop(x, "value"), label: (prop(x, "label") as string | undefined) ?? String(prop(x, "value")) } : { value: x, label: String(x) }));
}

/** True when a filter value means "no filter". */
export function isEmptyFilter(v: unknown): boolean {
  if (v == null || v === "") return true;
  if (Array.isArray(v)) return !v.length;
  if (typeof v === "object") return Object.values(v).every((x) => x == null || x === "");
  return false;
}

const pad = (n: number): string => String(n).padStart(2, "0");
/** Local calendar date "YYYY-MM-DD" of any date-like value, or null. */
export function dayOf(v: unknown): string | null {
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v)) return v;
  const d = toDate(v);
  return d ? `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` : null;
}
const num = (v: unknown): number | null => (v == null || v === "" ? null : Number(v));
const list = (f: unknown): unknown[] => ([] as unknown[]).concat(f);
interface RangeValue { min?: unknown; max?: unknown; from?: unknown; to?: unknown }

/** Does `row` pass the filter `f` on column `col`? (One row; for many rows use filterFn(col, f) once.) */
export function matchFilter<R>(row: R, col: Column<R>, f: unknown): boolean { return filterFn(col, f)(row); }

/** Label of each option value (first wins), or null when the column has no options. */
export function optionLabels(col: { options?: OptionsInput | undefined }): Map<unknown, string> | null {
  if (!col.options) return null;
  const m = new Map<unknown, string>();
  for (const o of optionsOf(col)) if (!m.has(o.value)) m.set(o.value, o.label);
  return m;
}

/**
 * The filter `f` of column `col` as a row predicate. Everything that depends only on the filter (bounds, the folded
 * text, the wanted values, the option labels) is worked out here once, not again for every row.
 */
export function filterFn<R>(col: Column<R>, f: unknown): (row: R) => boolean {
  const own = col.filterFn;
  if (own) return (row) => own(row, f);
  const get = col.filterValue ?? ((row: R) => valueOf(row, col));
  const r = f as RangeValue;
  switch (col.filter === true ? "text" : col.filter) {
    case "range": {
      const min = num(r.min), max = num(r.max);
      return (row) => { const n = num(get(row)); return n != null && !Number.isNaN(n) && (min == null || n >= min) && (max == null || n <= max); };
    }
    case "dateRange": {
      const from = r.from ? dayOf(r.from) as string : null, to = r.to ? dayOf(r.to) as string : null;
      return (row) => { const d = dayOf(get(row)); return !!d && (from == null || d >= from) && (to == null || d <= to); };
    }
    case "select": {
      // a value matches a wanted one when equal or equal as text
      const want = new Set<unknown>();
      for (const w of list(f)) { want.add(w); want.add(String(w)); }
      const one = (x: unknown): boolean => want.has(x) || want.has(String(x));
      return (row) => { const v = get(row); if (!Array.isArray(v)) return one(v); for (const x of v) if (one(x)) return true; return false; };
    }
    case "bool": { const on = f === true || f === "true"; return (row) => !!get(row) === on; }
    default: {
      const q = fold(f), labels = optionLabels(col);
      return (row) => { const v = get(row); const label = labels?.get(v); return fold(label ?? (Array.isArray(v) ? v.join(" ") : v)).includes(q); };
    }
  }
}

/** Human text for a filter chip. */
export function describeFilter(col: { filter?: Column["filter"] | undefined; options?: OptionsInput | undefined }, f: unknown): string {
  const r = f as RangeValue;
  switch (col.filter) {
    case "range": case "dateRange": {
      const [a, b] = col.filter === "range" ? [r.min, r.max] : [r.from, r.to];
      const has = (x: unknown): boolean => x != null && x !== "";
      return has(a) && has(b) ? `${a} – ${b}` : has(a) ? `≥ ${a}` : `≤ ${b}`;
    }
    case "select": {
      const opts = optionsOf(col);
      return list(f).map((x) => opts.find((o) => o.value === x || String(o.value) === String(x))?.label ?? String(x)).join(", ");
    }
    case "bool": return f === true || f === "true" ? t`Yes` : t`No`;
    default: return `“${f}”`;
  }
}

type SortKey = number | string | null;
/** Sortable key of a value: numbers, dates (time), booleans, strings; null stays null. */
export function sortKey(v: unknown): SortKey {
  if (v == null || v === "") return null;
  if (typeof v === "number" || typeof v === "string") return v;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v instanceof Date) return v.getTime();
  const d = typeof v === "object" ? toDate(v) : null;
  return d ? d.getTime() : String(v);
}

/** Stable multi-column sort. Nulls always last. `sort` = [{ key, dir }]. */
export function sortRows<R>(rows: readonly R[], sort: readonly SortSpec[], columns: readonly Column<R>[], locale?: string): readonly R[] {
  const specs: { get: (r: R) => unknown; dir: number }[] = [];
  for (const s of sort) {
    const c = columns.find((x) => x.key === s.key);
    if (c) { const sv = c.sortValue; specs.push({ get: sv ?? ((r) => valueOf(r, c)), dir: s.dir === "desc" ? -1 : 1 }); }
  }
  if (!specs.length) return rows;
  // keys read once per row (flat: row i's keys at i*ns…), then an index permutation is sorted: no object per row
  const n = rows.length, ns = specs.length, keys: SortKey[] = new Array(n * ns), idx = new Array<number>(n);
  for (let i = 0; i < n; i++) { idx[i] = i; const r = rows[i] as R; for (let j = 0; j < ns; j++) keys[i * ns + j] = sortKey((specs[j] as (typeof specs)[0]).get(r)); }
  const text = collator(locale), dirs = specs.map((s) => s.dir);
  idx.sort((a, b) => {
    for (let j = 0; j < ns; j++) {
      const x = keys[a * ns + j] as SortKey, y = keys[b * ns + j] as SortKey;
      if (x === y) continue;
      if (x == null) return 1;
      if (y == null) return -1;
      const c = typeof x === "string" || typeof y === "string" ? text.compare(String(x), String(y)) : x < y ? -1 : x > y ? 1 : 0;
      if (c) return c * (dirs[j] as number);
    }
    return a - b;
  });
  const out = new Array<R>(n);
  for (let i = 0; i < n; i++) out[i] = rows[idx[i] as number] as R;
  return out;
}

/** URL encoding of filter values: strings stay readable, everything else is JSON. */
export const encodeFilter = (v: unknown): string => (typeof v === "string" ? v : JSON.stringify(v));
export function decodeFilter(s: string): unknown {
  if (/^[[{]/.test(s) || s === "true" || s === "false") { try { return JSON.parse(s) as unknown; } catch { /* plain text */ } }
  return s;
}
