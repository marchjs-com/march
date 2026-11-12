// Grouping and aggregation over plain rows (pure, no DOM): DataGrid group rows and footers, charts, reports.
//   aggregate(rows, value, "sum")          → number
//   groupRows(rows, [{ key, value }], …)   → flat list of group headers and rows (collapsed groups skip their rows)

/** Built-in aggregates, or your own `(values, rows) => result`. */
export type AggregateKind = "sum" | "avg" | "min" | "max" | "count" | "distinct";
export type Aggregate<R> = AggregateKind | ((values: unknown[], rows: readonly R[]) => unknown);

const num = (v: unknown): number | null => {
  if (v == null || v === "") return null;
  const n = v instanceof Date ? v.getTime() : typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** Aggregate the values `value(row)` of `rows`. Numeric aggregates skip empty and non-numeric values; empty → null. */
export function aggregate<R>(rows: readonly R[], value: (row: R) => unknown, kind: Aggregate<R>): unknown {
  if (typeof kind === "function") return kind(rows.map(value), rows);
  if (kind === "count") return rows.length;
  if (kind === "distinct") return new Set(rows.map(value)).size;
  let n = 0, sum = 0, min = Infinity, max = -Infinity;
  for (const r of rows) {
    const v = num(value(r));
    if (v == null) continue;
    n++; sum += v; if (v < min) min = v; if (v > max) max = v;
  }
  if (!n) return null;
  return kind === "sum" ? sum : kind === "avg" ? sum / n : kind === "min" ? min : max;
}

/** One grouping level: a key (for ids / labels) and how to read a row's group value. */
export interface GroupLevel<R> { key: string; value: (row: R) => unknown; label?: ((value: unknown) => unknown) | undefined }
/** An aggregated column: key and how to aggregate it. */
export interface GroupAggregate<R> { key: string; value: (row: R) => unknown; aggregate: Aggregate<R> }

export interface GroupHeader<R> {
  kind: "group";
  /** Stable id: the path of group values ("Sales/2026"). */
  id: string;
  level: string;
  depth: number;
  value: unknown;
  /** Rows in this group (all depths below). */
  rows: readonly R[];
  count: number;
  /** key → aggregate result. */
  aggregates: Record<string, unknown>;
  open: boolean;
}
export interface GroupRow<R> { kind: "row"; row: R; depth: number }
export type GroupItem<R> = GroupHeader<R> | GroupRow<R>;

export interface GroupOptions<R> {
  aggregates?: readonly GroupAggregate<R>[] | undefined;
  /** Is group `id` collapsed? */
  collapsed?: ((id: string) => boolean) | undefined;
}

/** Aggregates of a row set by key. */
export function aggregates<R>(rows: readonly R[], list: readonly GroupAggregate<R>[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const a of list) out[a.key] = aggregate(rows, a.value, a.aggregate);
  return out;
}

/**
 * Group `rows` by `levels` (in order, stable: groups appear in the order of their first row, rows keep their order —
 * sort first to order the groups). Returns the visible flat list: headers, then (when open) sub-groups or rows.
 */
export function groupRows<R>(rows: readonly R[], levels: readonly GroupLevel<R>[], o: GroupOptions<R> = {}): GroupItem<R>[] {
  const out: GroupItem<R>[] = [];
  const walk = (list: readonly R[], depth: number, path: string): void => {
    const level = levels[depth];
    if (!level) { for (const row of list) out.push({ kind: "row", row, depth }); return; }
    const buckets = new Map<unknown, R[]>();
    for (const r of list) {
      const v = level.value(r), k = v instanceof Date ? v.getTime() : v;
      let b = buckets.get(k);
      if (!b) { b = []; buckets.set(k, b); }
      b.push(r);
    }
    for (const [k, b] of buckets) {
      const id = `${path}${path ? "/" : ""}${String(k ?? "")}`;
      const open = !o.collapsed?.(id);
      out.push({ kind: "group", id, level: level.key, depth, value: level.value(b[0] as R), rows: b, count: b.length, aggregates: aggregates(b, o.aggregates), open });
      if (open) walk(b, depth + 1, id);
    }
  };
  walk(rows, 0, "");
  return out;
}
