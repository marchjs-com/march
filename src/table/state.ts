// createTable(): headless table state — data (client rows or server source), sorting, filtering, search, paging,
// selection, expansion, inline edit, column layout, saved views, URL sync and export. <Table> renders it; you can too.
import { signal, computed, effect, untrack, batch, onCleanup, createRoot, type Accessor, type Signal } from "../core/reactive.ts";
import { applyPipe } from "../core/pipes.ts";
import { t, locale } from "../core/i18n.ts";
import { query as dataQuery, type QueryOptions } from "../data/query.ts";
import { setQuery } from "../router/router.ts";
import type { Schema } from "../schema/index.ts";
import { fold, prop, valueOf, optionsOf, optionLabels, filterFn, isEmptyFilter, describeFilter, sortRows, encodeFilter, decodeFilter } from "./filters.ts";
import type { Column, ColumnInput, TableColumn, FilterOption, Pin, Row, SortDir, SortSpec } from "./filters.ts";
import { toCSV, toJSON, download, type CSVOptions, type JSONOptions } from "./export.ts";
import { clamp, uid, load, save, debounce, type Handler } from "../core/util.ts";
import { createSelection } from "../core/selection.ts";

type MaybeFn<T> = T | (() => T);
const val = <T>(v: MaybeFn<T>): T => (typeof v === "function" ? (v as () => T)() : v);
const titleCase = (k: string): string => String(k).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
const sameList = <T>(a: readonly T[], b: readonly T[]): boolean => a === b || (!!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]));

// numbers, money, sizes, percentages and dates line up on their last digit: end-aligned, tabular digits (header too)
const NUMERIC = new Set(["number", "integer", "int", "float", "decimal", "money", "currency", "bytes", "filesize", "percent", "date", "datetime", "time", "duration"]);
/** Default alignment of a column: "end" for numeric / date types, formats and range filters, else "start". */
export function defaultAlign(d: { type?: string; format?: unknown; filter?: unknown }): "start" | "end" {
  const fmt = typeof d.format === "string" ? d.format : Array.isArray(d.format) ? String(d.format[0]) : "";
  return NUMERIC.has(String(d.type ?? "")) || NUMERIC.has(fmt) || d.filter === "range" || d.filter === "dateRange" ? "end" : "start";
}

/** Normalize one column definition. */
export function column<R = Row>(c: ColumnInput<R>): TableColumn<R> {
  const d = (typeof c === "string" ? { key: c } : c) as Column<R>;
  const filter = d.filter === true ? "text" : d.filter ?? null;
  return { sortable: d.key != null || !!d.sortValue, searchable: d.key != null && filter !== "range" && filter !== "dateRange", minWidth: 48, ...d, align: d.align ?? defaultAlign({ ...d, filter }), filter, label: d.label ?? titleCase(d.key ?? "") };
}

/** Display text of a cell: `format` (fn | pipe name | [pipe, ...args]), option labels, Yes/No, lists. */
export function formatValue<R>(row: R, col: Column<R>): unknown {
  const v = valueOf(row, col), f = col.format;
  if (typeof f === "function") return f(v, row);
  if (typeof f === "string") return applyPipe(f, v);
  if (Array.isArray(f)) { const [name, ...args] = f as readonly [string, ...unknown[]]; return applyPipe(name, v, ...args); }
  if (col.options) { const o = optionsOf(col).find((x) => x.value === v); if (o) return o.label; }
  if (typeof v === "boolean") return v ? t`Yes` : t`No`;
  if (Array.isArray(v)) return v.join(", ");
  if (v instanceof Date) return applyPipe("date", v);
  return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
}

/** Server request parameters before `paramNames` (see mapParams). */
export interface TableQuery { page: number; size: number; offset: number; cursor: string | null; sort: SortSpec[]; filters: Record<string, unknown>; search: string }
/** What `source` receives: the TableQuery fields, renamed / dropped / transformed by `paramNames`. */
export interface TableParams extends Partial<TableQuery> { [param: string]: unknown }
/** One server page. */
export interface TablePage<R> { items: R[]; total?: number | null | undefined; nextCursor?: string | null | undefined }
export type ParamNames =
  | ((p: Record<string, unknown>) => Record<string, unknown>)
  | { [param: string]: string | null | false | ((value: unknown, params: Record<string, unknown>) => Record<string, unknown>) | undefined };

const DEFAULT_NAMES: Record<string, string> = { page: "page", size: "size", offset: "offset", cursor: "cursor", sort: "sort", filters: "filters", search: "search" };
/** Rename / drop / transform server params: `{ size: "limit", offset: "skip", page: null, sort: (s) => ({ order: … }) }`. */
export function mapParams(p: Record<string, unknown>, names?: ParamNames, cursorMode?: boolean): Record<string, unknown> {
  if (typeof names === "function") return names(p);
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(p)) {
    if ((cursorMode && (k === "page" || k === "offset")) || (!cursorMode && k === "cursor")) continue;
    const m = names?.[k];
    const n = m === undefined ? DEFAULT_NAMES[k] ?? k : m;
    if (n === null || n === false) continue;
    if (typeof n === "function") Object.assign(out, n(p[k], p));
    else out[n] = p[k];
  }
  return out;
}

export interface ColState { order: string[]; hidden: Record<string, boolean>; widths: Record<string, number>; pins: Record<string, Pin | null> }
export interface TableSnapshot { sort: SortSpec[]; filters: Record<string, unknown>; search: string; size: number; columns: ColState }
export interface SavedView { name: string; state: Partial<TableSnapshot> }
export interface EditState<R> { id: unknown; row: R; key: string; draft: unknown; error: string | null; saving: boolean }
export interface ActiveFilter { key: string; label: string; value: unknown; text: string }
export interface ExportFileOptions { download?: boolean; filename?: string }
type VisibleColumns<R> = TableColumn<R>[] & { pins?: string };

/**
 * A table action (bulk or row): an action() object or a plain `{ label, run }`. `A` = the arguments it receives
 * (`[row]` for row actions, `[rows]` for bulk actions).
 */
export interface TableAction<A extends unknown[]> {
  label: string | (() => string);
  run(...args: A): unknown;
  visible?(...args: A): boolean;
  disabled?(...args: A): boolean;
  busy?(): boolean;
  opts?: { readonly danger?: boolean | undefined } | undefined;
}
export type RowAction<R> = TableAction<[row: R]>;
export type BulkAction<R> = TableAction<[rows: R[]]>;

/** createTable() options. `R` is the row type (inferred from rows, source or schema). */
export interface TableOptions<R = Row> {
  /** Client mode: the rows to show (sorted, filtered and paged in the browser). @tr İstemci modu: gösterilecek satırlar (tarayıcıda sıralanır, süzülür, sayfalanır). */
  rows?: MaybeFn<readonly R[] | null | undefined> | undefined;
  /** Server mode: one page for the (mapped) params. A plain array is a page without total. @tr Sunucu modu: (eşlenmiş) parametreler için bir sayfa. Düz bir dizi, toplamı olmayan bir sayfadır. */
  source?: ((params: TableParams, ctx: { signal: AbortSignal }) => Promise<TablePage<R> | R[]>) | undefined;
  /** Column definitions: keys or objects (label, format, filter, width…); default: the schema's columns. @tr Sütun tanımları: anahtarlar ya da nesneler (label, format, filter, width…); varsayılan: şemanın sütunları. */
  columns?: MaybeFn<readonly ColumnInput<R>[] | null | undefined> | undefined;
  /** A schema: gives the columns and validates inline edits. @tr Bir şema: sütunları verir ve satır içi düzenlemeleri doğrular. */
  schema?: Schema<R> | undefined;
  /** Row identity: a field name or `(row) => id` (default "id"). @tr Satır kimliği: bir alan adı ya da `(row) => id` (varsayılan "id"). */
  rowKey?: (keyof R & string) | (string & {}) | ((row: R) => unknown) | undefined;
  /** Rows per page (default 25). @tr Sayfa başına satır (varsayılan 25). */
  pageSize?: number | undefined;
  /** true (default): numbered pages · "cursor": server pages by cursor · false: no paging. @tr true (varsayılan): numaralı sayfalar · "cursor": imleçle sunucu sayfaları · false: sayfalama yok. */
  paging?: boolean | "cursor" | undefined;
  /** Rename, drop or transform the server params: `{ size: "limit", page: null }` or a function. @tr Sunucu parametrelerini yeniden adlandırır, çıkarır ya da dönüştürür: `{ size: "limit", page: null }` ya da bir fonksiyon. */
  paramNames?: ParamNames | undefined;
  /** Initial sorting: a list of `{ key, dir }`. @tr Başlangıç sıralaması: `{ key, dir }` listesi. */
  sort?: MaybeFn<readonly SortSpec[] | null | undefined> | undefined;
  /** Initial filter values by column key. @tr Sütun anahtarına göre başlangıç süzgeç değerleri. */
  filters?: MaybeFn<Record<string, unknown> | null | undefined> | undefined;
  /** Initial search text; `false` hides the search box (<Table>). @tr Başlangıç arama metni; `false` arama kutusunu gizler (<Table>). */
  search?: MaybeFn<string | boolean | null | undefined> | undefined;
  /** Saves views, the default view and the column layout in localStorage under this key. @tr Görünümleri, varsayılan görünümü ve sütun düzenini bu anahtarla localStorage'a kaydeder. */
  storageKey?: string | undefined;
  /** Keeps sort, search, filters, page size and page in the URL query, prefixed with this key. @tr Sıralama, arama, süzgeçler, sayfa boyu ve sayfayı bu önekle URL sorgusunda tutar. */
  urlKey?: string | undefined;
  /** Wait before the URL is updated, ms (default 250; 0: at once). @tr URL güncellenmeden önceki bekleme, ms (varsayılan 250; 0: hemen). */
  urlDelay?: number | undefined;
  /** Client mode: render only the rows near the viewport; "auto" above `virtualThreshold` rows. @tr İstemci modu: yalnız görünür alana yakın satırları çizer; "auto" `virtualThreshold` satırın üstünde. */
  virtual?: boolean | "auto" | undefined;
  /** Row count above which `virtual: "auto"` turns on (default 2000). @tr `virtual: "auto"`'nun devreye girdiği satır sayısı (varsayılan 2000). */
  virtualThreshold?: number | undefined;
  /** Saves an inline edit; a thrown error keeps the editor open with its message. @tr Satır içi düzenlemeyi kaydeder; fırlatılan hata düzenleyiciyi iletisiyle açık tutar. */
  onEdit?: Handler<[row: R, key: string, value: unknown]> | undefined;
  /** Server mode: loads every matching row for export (default: the current page). @tr Sunucu modu: dışa aktarım için eşleşen tüm satırları yükler (varsayılan: geçerli sayfa). */
  exportAll?: ((params: TableQuery) => Promise<readonly R[]> | readonly R[]) | undefined;
  /** Name of exported files, without extension (default "export"). @tr Dışa aktarılan dosyaların uzantısız adı (varsayılan "export"). */
  filename?: string | undefined;
  /** Cache key of the server query and the table's id (default: storageKey, urlKey or a generated id). @tr Sunucu sorgusunun önbellek anahtarı ve tablonun kimliği (varsayılan: storageKey, urlKey ya da üretilen bir kimlik). */
  queryKey?: string | undefined;
  /** Client mode: show the loading state (rows still coming). @tr İstemci modu: yükleniyor durumunu gösterir (satırlar henüz geliyor). */
  loading?: MaybeFn<boolean | null | undefined> | undefined;
  /** Client mode: an error to show instead of the rows. @tr İstemci modu: satırlar yerine gösterilecek hata. */
  error?: MaybeFn<unknown> | undefined;
  /** Server mode: how many times a failed request is retried. @tr Sunucu modu: başarısız isteğin kaç kez yeniden deneneceği. */
  retry?: number | undefined;
  /** Server mode: reload when the window gets focus again (default false). @tr Sunucu modu: pencere yeniden odak alınca yeniden yükler (varsayılan false). */
  refetchOnFocus?: boolean | undefined;
}

/** Headless table state returned by createTable(). */
export interface TableState<R = Row> {
  /** The table's id (queryKey, storageKey, urlKey or generated). @tr Tablonun kimliği (queryKey, storageKey, urlKey ya da üretilmiş). */
  id: string;
  /** "server" with a `source`, else "client". @tr `source` varsa "server", yoksa "client". */
  mode: "server" | "client";
  /** Pages are fetched by cursor (`paging: "cursor"`). @tr Sayfalar imleçle getirilir (`paging: "cursor"`). */
  cursorMode: boolean;
  /** Paging is on (`paging` is not false). @tr Sayfalama açık (`paging` false değil). */
  paged: boolean;
  /** Returns a row's id (from `rowKey`). @tr Bir satırın kimliğini döndürür (`rowKey`'den). */
  idOf: (row: R) => unknown;
  /** Reads a column's raw value from a row. @tr Bir satırdan sütunun ham değerini okur. */
  valueOf: typeof valueOf;
  /** Display text of a cell (column `format`, option labels, Yes/No, lists). @tr Bir hücrenin görünen metni (sütun `format`'ı, seçenek etiketleri, Evet/Hayır, listeler). */
  format: (row: R, col: TableColumn<R> | Column<R> | string) => unknown;
  // columns
  /** Every column, normalized, in definition order. @tr Tüm sütunlar, normalleştirilmiş, tanım sırasıyla. */
  allColumns: Accessor<TableColumn<R>[]>;
  /** Every column in the user's order (hidden ones included). @tr Kullanıcının sırasıyla tüm sütunlar (gizliler dahil). */
  columns: Accessor<TableColumn<R>[]>;
  /** The shown columns in order, pinned ones first and last. @tr Gösterilen sütunlar sırasıyla; sabitlenenler başta ve sonda. */
  visibleColumns: Accessor<VisibleColumns<R>>;
  /** Finds a column by key. @tr Anahtarla bir sütun bulur. */
  column: (key: string) => TableColumn<R> | undefined;
  /** Column layout: order, hidden, widths, pins. @tr Sütun düzeni: sıra, gizli, genişlikler, sabitlemeler. */
  colState: Signal<ColState>;
  /** Whether a column is hidden. @tr Bir sütunun gizli olup olmadığı. */
  isHidden(key: string): boolean;
  /** Hides or shows a column. @tr Bir sütunu gizler ya da gösterir. */
  setHidden(key: string, hide: boolean): void;
  /** Flips a column between hidden and shown. @tr Bir sütunu gizli ile görünür arasında değiştirir. */
  toggleColumn(key: string): void;
  /** Move among visible columns by `delta` positions (hidden columns are skipped). @tr Görünür sütunlar arasında `delta` konum taşır (gizli sütunlar atlanır). */
  moveColumn(key: string, delta: number): void;
  /** Moves a column before another one. @tr Bir sütunu başka bir sütunun önüne taşır. */
  moveColumnTo(key: string, beforeKey: string): void;
  /** A column's set width, px (null: automatic). @tr Bir sütunun ayarlı genişliği, px (null: otomatik). */
  widthOf(key: string): number | null;
  /** Which side a column is pinned to (null: not pinned). @tr Bir sütunun sabitlendiği taraf (null: sabitli değil). */
  pinOf(key: string): Pin | null;
  /** Sets a column's width, px, within its min / max. @tr Bir sütunun genişliğini min / max içinde ayarlar, px. */
  setWidth(key: string, w: number): void;
  /** Pins a column "left" or "right"; null unpins it. @tr Bir sütunu "left" ya da "right" sabitler; null sabitlemeyi kaldırır. */
  pin(key: string, side: string | null | undefined): void;
  /** Restores the default column layout. @tr Varsayılan sütun düzenine döner. */
  resetColumns(): void;
  /** Whether any shown column has a set width. @tr Görünür sütunlardan birinin ayarlı genişliği var mı. */
  hasWidths(): boolean;
  // data
  /** Rows of the current page. @tr Geçerli sayfanın satırları. */
  rows: Accessor<readonly R[]>;
  /** Every row that passes search and filters, sorted (server: the current page). @tr Aramayı ve süzgeçleri geçen tüm satırlar, sıralı (sunucu: geçerli sayfa). */
  filteredRows(): readonly R[];
  /** Every row before search, filters and paging. @tr Arama, süzgeç ve sayfalamadan önceki tüm satırlar. */
  allRows: Accessor<readonly R[]>;
  /** Count of matching rows (null when the server does not tell). @tr Eşleşen satır sayısı (sunucu bildirmezse null). */
  total: Accessor<number | null>;
  /** Whether only the rows near the viewport are rendered. @tr Yalnız görünür alana yakın satırların çizilip çizilmediği. */
  isVirtual: Accessor<boolean>;
  /** Data is loading. @tr Veri yükleniyor. */
  loading(): boolean;
  /** Server data is reloading while the old rows stay. @tr Eski satırlar dururken sunucu verisi yeniden yükleniyor. */
  refreshing(): boolean;
  /** The current error, or null. @tr Geçerli hata ya da null. */
  error(): unknown;
  /** Reloads the server page. @tr Sunucu sayfasını yeniden yükler. */
  refetch(): Promise<void> | undefined;
  /** Query params before `paramNames`: page, size, offset, cursor, sort, filters, search. @tr `paramNames`'ten önceki sorgu parametreleri: page, size, offset, cursor, sort, filters, search. */
  params: Accessor<TableQuery>;
  /** The params as sent to `source` (after `paramNames`). @tr `source`'a gönderildiği hâliyle parametreler (`paramNames`'ten sonra). */
  serverParams: Accessor<Record<string, unknown>>;
  /** What the body shows: "error", "loading", "rows" or "empty". @tr Gövdenin gösterdiği: "error", "loading", "rows" ya da "empty". */
  status: Accessor<"error" | "loading" | "rows" | "empty">;
  // sorting
  /** The sort list. @tr Sıralama listesi. */
  sort: Signal<SortSpec[]>;
  /** Replaces the sort list (back to page 1). @tr Sıralama listesini değiştirir (1. sayfaya döner). */
  setSort(list: readonly SortSpec[]): void;
  /** Position of a column in the sort list (-1: not sorted). @tr Bir sütunun sıralama listesindeki yeri (-1: sıralı değil). */
  sortIndex(key: string): number;
  /** Sort direction of a column, or null. @tr Bir sütunun sıralama yönü ya da null. */
  sortDir(key: string): SortDir | null;
  /** Cycles a column asc → desc → off; `add` keeps the other sorts (multi-sort). @tr Bir sütunu asc → desc → kapalı döndürür; `add` diğer sıralamaları korur (çoklu sıralama). */
  toggleSort(key: string, add?: boolean): void;
  // filters & search
  /** Filter values by column key. @tr Sütun anahtarına göre süzgeç değerleri. */
  filters: Signal<Record<string, unknown>>;
  /** The search text. @tr Arama metni. */
  search: Signal<string>;
  /** Sets a column's filter; an empty value removes it. @tr Bir sütunun süzgecini ayarlar; boş değer onu kaldırır. */
  setFilter(key: string, v: unknown): void;
  /** Removes a column's filter. @tr Bir sütunun süzgecini kaldırır. */
  clearFilter(key: string): void;
  /** Removes every filter and the search text. @tr Tüm süzgeçleri ve arama metnini kaldırır. */
  clearFilters(): void;
  /** Sets the search text (back to page 1). @tr Arama metnini ayarlar (1. sayfaya döner). */
  setSearch(s: string | null | undefined): void;
  /** The filters in use, with label and readable text (for chips). @tr Kullanılan süzgeçler, etiket ve okunur metinle (çipler için). */
  activeFilters(): ActiveFilter[];
  /** Choices for a column's filter: its options, else the distinct values in the rows. @tr Bir sütun süzgecinin seçenekleri: kendi seçenekleri, yoksa satırlardaki farklı değerler. */
  filterOptions(key: string): FilterOption[];
  // paging
  /** The current page, from 1. @tr Geçerli sayfa, 1'den başlar. */
  page: Accessor<number>;
  /** Rows per page. @tr Sayfa başına satır. */
  size: Signal<number>;
  /** Number of pages (null when the total is unknown). @tr Sayfa sayısı (toplam bilinmiyorsa null). */
  pageCount: Accessor<number | null>;
  /** There is a next page. @tr Sonraki sayfa var. */
  hasNext: Accessor<boolean>;
  /** There is a previous page. @tr Önceki sayfa var. */
  hasPrev: Accessor<boolean>;
  /** Goes to a page. @tr Bir sayfaya gider. */
  setPage(n: number | string): void;
  /** Changes rows per page (back to page 1). @tr Sayfa başına satırı değiştirir (1. sayfaya döner). */
  setSize(n: number | string): void;
  /** Goes to the next page. @tr Sonraki sayfaya gider. */
  next(): void;
  /** Goes to the previous page. @tr Önceki sayfaya gider. */
  prev(): void;
  // selection
  /** Selected rows by id. @tr Kimliğe göre seçili satırlar. */
  selected: Signal<Map<unknown, R>>;
  /** Every matching row is selected (not only the loaded ones). @tr Eşleşen tüm satırlar seçili (yalnız yüklenenler değil). */
  allMatching: Signal<boolean>;
  /** Whether the row with this id is selected. @tr Bu kimlikteki satır seçili mi. */
  isSelected(rid: unknown): boolean;
  /** The selected rows. @tr Seçili satırlar. */
  selectedRows(): R[];
  /** Number of selected rows (server, all matching: the total). @tr Seçili satır sayısı (sunucu, tüm eşleşenler: toplam). */
  selectedCount(): number;
  /** Selects or clears a row; `range` extends from the last one (Shift-click). @tr Bir satırı seçer ya da bırakır; `range` sonuncudan itibaren genişletir (Shift-tıklama). */
  toggle(row: R, opts?: { range?: boolean; on?: boolean | undefined }): void;
  /** Selection on this page: "none", "all" or "some". @tr Bu sayfadaki seçim: "none", "all" ya da "some". */
  pageSelection(): "none" | "all" | "some";
  /** Selects (or clears) every row of the page. @tr Sayfanın tüm satırlarını seçer (ya da bırakır). */
  selectPage(on?: boolean): void;
  /** Selects every row that matches the search and filters. @tr Arama ve süzgeçlerle eşleşen tüm satırları seçer. */
  selectAllMatching(): void;
  /** Clears the selection. @tr Seçimi temizler. */
  clearSelection(): void;
  /** Run a bulk action with the selected rows; clears the selection when it ran successfully. Errors are swallowed (the action reports them). @tr Seçili satırlarla toplu bir eylem çalıştırır; başarıyla çalışınca seçimi temizler. Hatalar yutulur (eylem onları bildirir). */
  runBulk(a: BulkAction<R>): Promise<unknown>;
  // expansion
  /** Whether the row with this id is expanded. @tr Bu kimlikteki satır açık mı. */
  isExpanded(rid: unknown): boolean;
  /** Opens or closes a row's detail. @tr Bir satırın ayrıntısını açar ya da kapatır. */
  toggleExpand(row: R, open?: boolean): void;
  // inline edit
  /** The cell being edited: row, key, draft, error, saving. @tr Düzenlenen hücre: satır, anahtar, taslak, hata, kaydediliyor. */
  editing: Signal<EditState<R> | null>;
  /** Starts editing a cell. @tr Bir hücreyi düzenlemeye başlar. */
  startEdit(row: R, key: string): void;
  /** Sets the draft value of the cell being edited. @tr Düzenlenen hücrenin taslak değerini ayarlar. */
  setDraft(v: unknown): void;
  /** Drops the edit. @tr Düzenlemeyi bırakır. */
  cancelEdit(): void;
  /** Validates and saves the draft with `onEdit`; true when it saved. @tr Taslağı doğrular ve `onEdit` ile kaydeder; kaydedince true. */
  commitEdit(): Promise<boolean>;
  // views
  /** The saved views. @tr Kayıtlı görünümler. */
  views: Signal<SavedView[]>;
  /** Name of the applied view, or null. @tr Uygulanan görünümün adı ya da null. */
  activeView: Signal<string | null>;
  /** Name of the view applied at start, or null. @tr Başta uygulanan görünümün adı ya da null. */
  defaultView: Signal<string | null>;
  /** The current sort, filters, search, page size and columns. @tr Geçerli sıralama, süzgeçler, arama, sayfa boyu ve sütunlar. */
  snapshot(): TableSnapshot;
  /** Restores a snapshot (and marks the view `name` as active). @tr Bir anlık görüntüyü geri yükler (ve `name` görünümünü etkin işaretler). */
  applySnapshot(s: Partial<TableSnapshot>, name?: string | null): void;
  saveView(name: string | null | undefined): void;
  applyView(name: string): void;
  deleteView(name: string): void;
  setDefaultView(name: string | null | undefined): void;
  // export
  exportRows(): Promise<readonly R[]>;
  toCSV(opts?: CSVOptions<R>): string;
  toJSON(opts?: JSONOptions<R>): string;
  exportCSV(opts?: CSVOptions<R> & ExportFileOptions): Promise<string>;
  exportJSON(opts?: JSONOptions<R> & ExportFileOptions): Promise<string>;
}

const readStore = (key: string): Record<string, unknown> => load<Record<string, unknown> | null>(key, null) ?? {};
const writeStore = save;
const EMPTY_COLS = (): ColState => ({ order: [], hidden: {}, widths: {}, pins: {} });
const keyStr = (c: { key?: string | undefined }): string => String(c.key);

/**
 * Headless table. Options: rows | source, columns | schema, rowKey ("id"), pageSize (25), pageSizes, paging (true | false |
 * "cursor"), paramNames, sort, filters, search, storageKey, urlKey, urlDelay, virtual (true | "auto"), virtualThreshold,
 * onEdit, exportAll, filename, queryKey, loading, error.
 */
export function createTable<R = Row>(o: TableOptions<R> = {}): TableState<R> {
  const id = o.queryKey ?? o.storageKey ?? o.urlKey ?? uid("t");
  const source = typeof o.source === "function" ? o.source : null;
  const server = !!source;
  const cursorMode = o.paging === "cursor";
  const paged = o.paging !== false;
  const rowKey = o.rowKey ?? "id";
  const idOf = typeof rowKey === "function" ? rowKey : (r: R): unknown => prop(r, rowKey) ?? r;
  const defaultSize = o.pageSize ?? 25;

  // ------------------------------------------------------------------ columns
  const allColumns = computed(() => {
    const cs = val(o.columns) ?? o.schema?.columns?.() ?? [];
    return cs.map((c) => column<R>(c));
  });
  const colState = signal(EMPTY_COLS());
  const colOf = (key: string): TableColumn<R> | undefined => untrack(allColumns).find((c) => c.key === key);
  const isHidden = (c: TableColumn<R>, s = colState()): boolean => (keyStr(c) in s.hidden ? s.hidden[keyStr(c)] as boolean : !!c.hidden);
  const pinOf = (key: string): Pin | null => { const s = colState(), c = allColumns().find((x) => x.key === key); return (key in s.pins ? s.pins[key] : c?.pin) ?? null; };
  const widthOf = (key: string): number | null => { const s = colState(); return s.widths[key] ?? allColumns().find((x) => x.key === key)?.width ?? null; };
  const orderedColumns = computed(() => {
    const cs = allColumns(), order = colState().order;
    const pos = (c: TableColumn<R>, i: number): number => { const j = order.indexOf(c.key as string); return j < 0 ? order.length + i : j; };
    return cs.map((c, i) => [c, pos(c, i)] as const).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  }, { equals: sameList });
  const visibleColumns = computed(() => {
    const s = colState(), shown = orderedColumns().filter((c) => !isHidden(c, s));
    const side = (c: TableColumn<R>): number => { const p = keyStr(c) in s.pins ? s.pins[keyStr(c)] : c.pin; return p === "left" ? 0 : p === "right" ? 2 : 1; };
    const out: VisibleColumns<R> = shown.map((c, i) => [c, i] as const).sort((a, b) => side(a[0]) - side(b[0]) || a[1] - b[1]).map((x) => x[0]);
    out.pins = out.map(side).join(""); // a pin change re-renders cells even when the order stays the same
    return out;
  }, { equals: (a, b) => sameList(a, b) && a.pins === b.pins });
  const setCols = (fn: (s: ColState) => ColState): ColState => colState.set(fn({ ...untrack(colState) }));
  const orderKeys = (): string[] => untrack(orderedColumns).map((c) => c.key as string);

  // ------------------------------------------------------------------ view state
  const sort = signal<SortSpec[]>([...(val(o.sort) ?? [])]);
  const filters = signal<Record<string, unknown>>({ ...(val(o.filters) ?? {}) });
  const search = signal(typeof val(o.search) === "string" ? val(o.search) as string : ""); // `search={false}` hides the box (render), not a query
  const page = signal(1);
  const size = signal(defaultSize);
  const cursor = signal<string | null>(null);
  const cursorStack = signal<(string | null)[]>([]);
  const views = signal<SavedView[]>([]);
  const defaultView = signal<string | null>(null);
  const activeView = signal<string | null>(null);

  // ------------------------------------------------------------------ client pipeline
  const allRows = computed((): readonly R[] => (server ? [] : val(o.rows) ?? []));
  const filtered = computed(() => {
    const rows = allRows();
    const cols = allColumns(), f = filters(), q = fold(search().trim());
    // every active filter as a predicate built once (bounds, folded text, option labels), then one pass over the rows
    // for filters and search together: no intermediate array, no per-row lookup of what does not depend on the row
    const tests: ((r: R) => boolean)[] = [];
    for (const k in f) {
      if (isEmptyFilter(f[k])) continue;
      const c = cols.find((x) => x.key === k);
      if (c) tests.push(filterFn(c, f[k]));
    }
    const sc: { c: TableColumn<R>; labels: Map<unknown, string> | null }[] = [];
    if (q) for (const c of cols) if (c.searchable) sc.push({ c, labels: optionLabels(c) });
    if (!tests.length && !sc.length) return rows;
    const out: R[] = [];
    rows: for (let i = 0, n = rows.length; i < n; i++) {
      const r = rows[i] as R;
      for (const t of tests) if (!t(r)) continue rows;
      if (sc.length) {
        let hit = false;
        for (const { c, labels } of sc) {
          const v = c.searchValue ? c.searchValue(r) : valueOf(r, c);
          const label = labels?.get(v);
          if (fold(label ?? (Array.isArray(v) ? v.join(" ") : v)).includes(q)) { hit = true; break; }
        }
        if (!hit) continue;
      }
      out.push(r);
    }
    return out;
  });
  const sorted = computed(() => sortRows(filtered(), sort(), allColumns(), locale()));

  // ------------------------------------------------------------------ server pipeline
  const params = computed((): TableQuery => ({
    page: page(), size: size(), offset: (page() - 1) * size(), cursor: cursor(),
    sort: sort(), filters: Object.fromEntries(Object.entries(filters()).filter(([, v]) => !isEmptyFilter(v))), search: search().trim(),
  }));
  const serverParams = computed(() => mapParams(params() as unknown as Record<string, unknown>, o.paramNames, cursorMode));
  const q = source ? dataQuery(({ signal: s }) => source(untrack(serverParams), { signal: s }),
    { key: () => ["march.table", id, serverParams()], keep: true, retry: o.retry, refetchOnFocus: o.refetchOnFocus ?? false } as QueryOptions<TablePage<R> | R[]>) : null;
  const response = computed((): TablePage<R> => { const d = q?.(); return Array.isArray(d) ? { items: d } : d ?? { items: [] }; });

  // ------------------------------------------------------------------ paging
  const virtual = computed(() => !server && (o.virtual === true || (o.virtual === "auto" && allRows().length > (o.virtualThreshold ?? 2000))));
  const total = computed(() => (server ? response().total ?? null : sorted().length));
  const pageCount = computed(() => { const n = total(); return n == null ? null : Math.max(1, Math.ceil(n / size())); });
  const curPage = computed(() => (server || !paged || virtual() ? page() : Math.min(page(), pageCount() as number)));
  const rows = computed((): readonly R[] => {
    if (server) return response().items ?? [];
    const all = sorted();
    if (!paged || virtual()) return all;
    const p = curPage(), n = size();
    return all.slice((p - 1) * n, p * n);
  });
  const hasNext = computed(() => {
    if (server && cursorMode) return response().nextCursor != null;
    const pc = pageCount();
    return pc != null ? curPage() < pc : rows().length >= size();
  });
  const hasPrev = computed(() => (cursorMode ? cursorStack().length > 0 : curPage() > 1));
  const resetPaging = (): void => batch(() => { page.set(1); cursor.set(null); cursorStack.set([]); allMatching.set(false); });

  // ------------------------------------------------------------------ selection / expansion / edit
  const selected = signal(new Map<unknown, R>());
  // the shared collection model (core/selection.ts) works on this table's own `selected` store
  const picker = createSelection<unknown, R>({ items: () => rows(), keyOf: idOf, store: selected });
  const allMatching = signal(false);
  const expanded = signal(new Set<unknown>());
  const editing = signal<EditState<R> | null>(null);
  const loadingProp = (): boolean => !!val(o.loading);

  const table: TableState<R> = {
    id, mode: server ? "server" : "client", cursorMode, paged, idOf,
    valueOf, format: (row, col) => formatValue(row, (typeof col === "string" ? colOf(col) : col) as Column<R>),
    // columns
    allColumns, columns: orderedColumns, visibleColumns, column: colOf, colState,
    isHidden: (key) => { const c = allColumns().find((x) => x.key === key); return c ? isHidden(c) : true; },
    setHidden: (key, hide) => setCols((s) => ({ ...s, hidden: { ...s.hidden, [key]: !!hide } })),
    toggleColumn: (key) => table.setHidden(key, !untrack(() => table.isHidden(key))),
    moveColumn(key, delta) {
      const vis = untrack(orderedColumns).filter((c) => !isHidden(c, untrack(colState))).map((c) => c.key);
      const i = vis.indexOf(key), j = clamp(i + delta, 0, vis.length - 1);
      if (i < 0 || i === j) return;
      const ks = orderKeys().filter((k) => k !== key), at = ks.indexOf(vis[j] as string);
      ks.splice(delta < 0 ? at : at + 1, 0, key);
      setCols((s) => ({ ...s, order: ks }));
    },
    moveColumnTo(key, beforeKey) {
      const ks = orderKeys().filter((k) => k !== key), j = ks.indexOf(beforeKey);
      ks.splice(j < 0 ? ks.length : j, 0, key);
      setCols((s) => ({ ...s, order: ks }));
    },
    widthOf, pinOf,
    setWidth(key, w) {
      const c = colOf(key);
      const n = Math.round(Math.max(c?.minWidth ?? 48, c?.maxWidth ? Math.min(c.maxWidth, w) : w));
      setCols((s) => ({ ...s, widths: { ...s.widths, [key]: n } }));
    },
    pin: (key, side) => setCols((s) => ({ ...s, pins: { ...s.pins, [key]: side === "left" || side === "right" ? side : null } })),
    resetColumns: () => colState.set(EMPTY_COLS()),
    hasWidths: () => visibleColumns().some((c) => widthOf(c.key as string) != null),
    // data
    rows, filteredRows: () => (server ? rows() : sorted()), allRows, total, isVirtual: virtual,
    loading: () => (q ? q.loading() : loadingProp()),
    refreshing: () => (q ? q.refreshing() : false),
    error: () => (q ? q.error() : val(o.error) ?? null),
    refetch: () => q?.refetch(),
    params, serverParams,
    status: computed(() => (table.error() ? "error" : table.loading() && !rows().length ? "loading" : rows().length ? "rows" : "empty")),
    // sorting
    sort, setSort: (list) => batch(() => { sort.set([...list]); resetPaging(); }),
    sortIndex: (key) => sort().findIndex((s) => s.key === key),
    sortDir: (key) => sort().find((s) => s.key === key)?.dir ?? null,
    toggleSort(key, add = false) {
      const cur = untrack(sort), i = cur.findIndex((s) => s.key === key);
      const next: SortDir | null = i < 0 ? "asc" : (cur[i] as SortSpec).dir === "asc" ? "desc" : null;
      let list: SortSpec[];
      if (add) { list = cur.filter((s) => s.key !== key); if (next) i < 0 ? list.push({ key, dir: next }) : list.splice(i, 0, { key, dir: next }); }
      else list = next ? [{ key, dir: next }] : [];
      table.setSort(list);
    },
    // filters & search
    filters, search,
    setFilter: (key, v) => batch(() => { const f = { ...untrack(filters) }; if (isEmptyFilter(v)) delete f[key]; else f[key] = v; filters.set(f); resetPaging(); }),
    clearFilter: (key) => table.setFilter(key, null),
    clearFilters: () => batch(() => { filters.set({}); search.set(""); resetPaging(); }),
    setSearch: (s) => batch(() => { if (s !== untrack(search)) { search.set(s ?? ""); resetPaging(); } }),
    activeFilters: () => {
      const f = filters(), cs = allColumns();
      return Object.keys(f).filter((k) => !isEmptyFilter(f[k])).map((k) => { const c = cs.find((x) => x.key === k) ?? column<R>({ key: k }); return { key: k, label: c.label, value: f[k], text: describeFilter(c, f[k]) }; });
    },
    filterOptions(key) {
      const c = allColumns().find((x) => x.key === key);
      if (!c) return [];
      if (c.options) return optionsOf(c);
      const seen = new Set<unknown>();
      for (const r of allRows()) { const v = valueOf(r, c); for (const x of Array.isArray(v) ? v as unknown[] : [v]) if (x != null && x !== "") seen.add(x); if (seen.size > 200) break; }
      return [...seen].sort().map((v) => ({ value: v, label: String(v) }));
    },
    // paging
    page: curPage, size, pageCount, hasNext, hasPrev,
    setPage: (n) => page.set(clamp(untrack(pageCount) ?? Infinity, 1, Number(n) || 1)),
    setSize: (n) => batch(() => { size.set(Number(n) || defaultSize); resetPaging(); }),
    next() {
      if (!untrack(hasNext)) return;
      if (cursorMode) batch(() => { cursorStack.set([...untrack(cursorStack), untrack(cursor)]); cursor.set(untrack(response).nextCursor as string | null); page.set(untrack(page) + 1); });
      else page.set(untrack(curPage) + 1);
    },
    prev() {
      if (!untrack(hasPrev)) return;
      if (cursorMode) batch(() => { const st = [...untrack(cursorStack)]; cursor.set(st.pop() ?? null); cursorStack.set(st); page.set(Math.max(1, untrack(page) - 1)); });
      else page.set(untrack(curPage) - 1);
    },
    // selection
    selected, allMatching,
    isSelected: (rid) => selected().has(rid),
    selectedRows: () => [...selected().values()],
    selectedCount: () => (allMatching() && server ? total() ?? selected().size : selected().size),
    toggle(row, { range = false, on } = {}) {
      const want = on ?? !untrack(selected).has(idOf(row));
      batch(() => { if (range) picker.range(row, true, want, true); else picker.toggle(row, want); if (!want) allMatching.set(false); });
    },
    pageSelection: () => { const rs = rows(), sel = selected(); const n = rs.filter((r) => sel.has(idOf(r))).length; return n === 0 ? "none" : n === rs.length ? "all" : "some"; },
    selectPage(on = true) {
      const next = new Map(untrack(selected));
      for (const r of untrack(rows)) on ? next.set(idOf(r), r) : next.delete(idOf(r));
      batch(() => { selected.set(next); if (!on) allMatching.set(false); });
    },
    selectAllMatching() {
      const next = new Map(untrack(selected));
      for (const r of untrack(table.filteredRows)) next.set(idOf(r), r);
      batch(() => { selected.set(next); allMatching.set(true); });
    },
    clearSelection: () => batch(() => { picker.clear(); allMatching.set(false); }),
    async runBulk(a) {
      const list = untrack(table.selectedRows);
      let ran = typeof a.busy !== "function";
      const stop = ran ? null : createRoot((d) => { effect(() => { if (a.busy?.()) ran = true; }); return d; });
      try {
        const r = await a.run(list);
        if (ran) table.clearSelection();
        return r;
      } catch { return undefined; } finally { stop?.(); }
    },
    // expansion
    isExpanded: (rid) => expanded().has(rid),
    toggleExpand(row, open) {
      const rid = idOf(row), next = new Set(untrack(expanded));
      (open ?? !next.has(rid)) ? next.add(rid) : next.delete(rid);
      expanded.set(next);
    },
    // inline edit
    editing,
    startEdit: (row, key) => editing.set({ id: idOf(row), row, key, draft: valueOf(row, colOf(key) ?? { key }), error: null, saving: false }),
    setDraft: (v) => { const e = untrack(editing); if (e) editing.set({ ...e, draft: v, error: null }); },
    cancelEdit: () => editing.set(null),
    async commitEdit() {
      const e = untrack(editing);
      if (!e || e.saving) return false;
      const c: Column<R> = colOf(e.key) ?? { key: e.key };
      let value = e.draft;
      let msg: string | null | undefined = null;
      if (o.schema?.validateField) {
        msg = o.schema.validateField(e.key, value, { ...(e.row as Row), [e.key]: value });
        if (!msg && o.schema.parse) value = prop(o.schema.parse({ [e.key]: value }), e.key);
      } else if (c.type === "number" && value !== "" && value != null) value = Number(value);
      msg ??= c.validate?.(value, e.row) ?? null;
      if (msg) { editing.set({ ...e, error: msg }); return false; }
      editing.set({ ...e, saving: true });
      try {
        await o.onEdit?.(e.row, e.key, value);
        if (untrack(editing)?.id === e.id) editing.set(null);
        return true;
      } catch (err) {
        if (untrack(editing)?.id === e.id) editing.set({ ...e, saving: false, error: (prop(err, "message") as string | undefined) || t`Could not save` });
        return false;
      }
    },
    // views
    views, activeView, defaultView,
    snapshot: () => untrack(() => ({ sort: sort(), filters: filters(), search: search(), size: size(), columns: colState() })),
    applySnapshot(s, name = null) {
      batch(() => {
        sort.set([...(s.sort ?? [])]); filters.set({ ...(s.filters ?? {}) }); search.set(s.search ?? "");
        size.set(s.size ?? defaultSize); colState.set({ ...EMPTY_COLS(), ...(s.columns ?? {}) });
        activeView.set(name); resetPaging();
      });
    },
    saveView(name) {
      const n = String(name ?? "").trim();
      if (!n) return;
      batch(() => { views.set([...untrack(views).filter((v) => v.name !== n), { name: n, state: table.snapshot() }]); activeView.set(n); });
    },
    applyView(name) { const v = untrack(views).find((x) => x.name === name); if (v) table.applySnapshot(v.state, name); },
    deleteView: (name) => batch(() => { views.set(untrack(views).filter((v) => v.name !== name)); if (untrack(defaultView) === name) defaultView.set(null); if (untrack(activeView) === name) activeView.set(null); }),
    setDefaultView: (name) => defaultView.set(name ?? null),
    // export
    exportRows: async () => (server ? (o.exportAll ? await o.exportAll(untrack(params)) : untrack(rows)) : untrack(sorted)),
    toCSV: (opts = {}) => toCSV(untrack(table.filteredRows), untrack(visibleColumns), { format: formatValue, ...opts }),
    toJSON: (opts = {}) => toJSON(untrack(table.filteredRows), untrack(visibleColumns), { format: formatValue, ...opts }),
    async exportCSV(opts = {}) {
      const text = toCSV(await table.exportRows(), untrack(visibleColumns), { format: formatValue, bom: true, ...opts });
      if (opts.download !== false) download(`${opts.filename ?? o.filename ?? "export"}.csv`, text, "text/csv;charset=utf-8");
      return text;
    },
    async exportJSON(opts = {}) {
      const text = toJSON(await table.exportRows(), untrack(visibleColumns), { format: formatValue, ...opts });
      if (opts.download !== false) download(`${opts.filename ?? o.filename ?? "export"}.json`, text, "application/json");
      return text;
    },
  };

  // ------------------------------------------------------------------ persistence (storageKey)
  const storageKey = o.storageKey;
  if (storageKey) {
    const st = readStore(storageKey);
    untrack(() => batch(() => {
      if (Array.isArray(st["views"])) views.set((st["views"] as unknown[]).filter((v): v is SavedView => !!(v && typeof prop(v, "name") === "string" && prop(v, "state"))));
      if (st["columns"] && typeof st["columns"] === "object") colState.set({ ...EMPTY_COLS(), ...(st["columns"] as Partial<ColState>) });
      if (st["default"]) { defaultView.set(st["default"] as string); table.applyView(st["default"] as string); }
    }));
    effect(() => {
      const v = { views: views(), default: defaultView(), columns: colState() };
      untrack(() => writeStore(storageKey, v));
    });
  }

  // ------------------------------------------------------------------ URL sync (urlKey)
  const urlKey = o.urlKey;
  if (urlKey) {
    const k = (s: string): string => `${urlKey}.${s}`, pre = `${urlKey}.`;
    const sp = new URLSearchParams(globalThis.location?.search ?? "");
    untrack(() => batch(() => {
      if (sp.has(k("s"))) sort.set((sp.get(k("s")) as string).split(",").filter(Boolean).map((x): SortSpec => (x[0] === "-" ? { key: x.slice(1), dir: "desc" } : { key: x, dir: "asc" })));
      if (sp.has(k("q"))) search.set(sp.get(k("q")) as string);
      const f: Record<string, unknown> = {};
      for (const [name, v] of sp) if (name.startsWith(k("f."))) f[name.slice(k("f.").length)] = decodeFilter(v);
      if (Object.keys(f).length) filters.set(f);
      if (sp.has(k("n"))) size.set(Number(sp.get(k("n"))) || defaultSize);
      if (sp.has(k("c"))) cursor.set(sp.get(k("c")));
      if (sp.has(k("p"))) page.set(Math.max(1, Number(sp.get(k("p"))) || 1));
    }));
    const want = computed(() => {
      const w: Record<string, string> = {};
      const s = sort().map((x) => (x.dir === "desc" ? `-${x.key}` : x.key)).join(",");
      if (s) w[k("s")] = s;
      if (search()) w[k("q")] = search();
      for (const [fk, fv] of Object.entries(filters())) if (!isEmptyFilter(fv)) w[k(`f.${fk}`)] = encodeFilter(fv);
      if (size() !== defaultSize) w[k("n")] = String(size());
      if (cursor() != null) w[k("c")] = String(cursor());
      if (page() > 1) w[k("p")] = String(page());
      return w;
    });
    const write = (w: Record<string, string>): void => {
      const cur = new URLSearchParams(globalThis.location?.search ?? "");
      const values: Record<string, string | null> = {};
      for (const name of new Set(cur.keys())) if (name.startsWith(pre) && !(name in w)) values[name] = null;
      let changed = Object.keys(values).length > 0;
      for (const [name, v] of Object.entries(w)) { if (cur.get(name) !== v) changed = true; values[name] = v; }
      if (!changed) return; // always send the full table state: the router's query may lag behind location
      try { void setQuery(values, { replace: true }); } catch {
        for (const [name, v] of Object.entries(values)) v == null ? cur.delete(name) : cur.set(name, v);
        const qs = cur.toString();
        globalThis.history?.replaceState(globalThis.history.state, "", `${globalThis.location.pathname}${qs ? `?${qs}` : ""}${globalThis.location.hash ?? ""}`);
      }
    };
    const delay = o.urlDelay ?? 250;
    const later = debounce(write, delay);
    effect(() => {
      const w = want();
      untrack(() => (delay ? later(w) : write(w)));
    });
    onCleanup(later.cancel);
  }
  return table;
}
