// DataGrid (hadi-march/ui): a spreadsheet-like grid for large data, built on the table engine (createTable: sorting,
// filters, search, column layout, selection, inline edit, CSV) and the shared virtual window (core/virtual.ts) for
// BOTH rows and columns, so 100 000 rows × many columns stay smooth. Adds grouping with aggregates, pinned columns,
// drag to reorder / resize columns, a keyboard cell cursor and a totals footer. Folder: src/components/data/data-grid/.
import "./data-grid.css";
import "../../../css/table.css";
import { signal, computed, effect, untrack, createRoot, onCleanup } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { t, dir } from "../../../core/i18n.ts";
import { val, cx, uid, setStyle, clamp, type MaybeFn, type ClassProp } from "../../../core/util.ts";
import { createAxis, createViewport } from "../../../core/virtual.ts";
import { moveCursor } from "../../../core/selection.ts";
import { applyPipe } from "../../../core/pipes.ts";
import { createTable, formatValue, type TableState, type TableOptions } from "../../../table/state.ts";
import { FilterControl, CellEditor } from "../../../table/controls.ts";
import { valueOf, type Column, type TableColumn, type Row } from "../../../table/filters.ts";
import { groupRows, aggregates, type Aggregate, type GroupItem, type GroupHeader, type GroupRow, type GroupAggregate } from "../../../data/group.ts";
import { animate, stagger } from "../../../motion/animate.ts";
import { pointerDrag } from "../../../behaviors/drag/index.ts";
import { resizeHandle } from "../../../behaviors/resize-handle/index.ts";
import { Menu, type MenuItem } from "../../../ui/menu.ts";
import { Chip } from "../../actions/chip/index.ts";
import { glyph } from "../../../ui/util.ts";
import { chevronRight } from "../../../icons/glyphs/chevronRight.ts";
import { arrowUp } from "../../../icons/glyphs/arrowUp.ts";
import { moreVertical } from "../../../icons/glyphs/moreVertical.ts";
import { download } from "../../../icons/glyphs/download.ts";
import { filter as filterIcon } from "../../../icons/glyphs/filter.ts";
import { layers } from "../../../icons/glyphs/layers.ts";
import { search as searchIcon } from "../../../icons/glyphs/search.ts";

/** A DataGrid column: a table column plus an aggregate (group rows and the totals footer). */
export interface DataGridColumn<R = Row> extends Column<R> {
  /** "sum" | "avg" | "min" | "max" | "count" | "distinct" | (values, rows) => result. */
  aggregate?: Aggregate<R> | undefined;
  /** Allow grouping by this column (default true for keyed columns). */
  groupable?: boolean | undefined;
}

export interface DataGridProps<R = Row> {
  /** Rows (array, signal or getter). Ignored when `table` is given. */
  rows?: MaybeFn<readonly R[] | null | undefined>;
  columns?: readonly (DataGridColumn<R> | (keyof R & string))[] | undefined;
  rowKey?: TableOptions<R>["rowKey"];
  /** Use an existing createTable() state (server data, saved views, URL sync …). */
  table?: TableState<R> | undefined;
  /** Px height of the scroll area (default 480). */
  height?: number | undefined;
  /** Row height in px (default 36). */
  rowHeight?: MaybeFn<number | undefined>;
  /** Column keys to group by (controlled when you also pass onGroupBy). */
  groupBy?: MaybeFn<readonly string[] | undefined>;
  onGroupBy?: ((keys: string[]) => void) | undefined;
  /** Row checkboxes, Space / Shift+arrows / Ctrl+click selection. */
  selectable?: boolean | undefined;
  /** Save an edited cell (columns with `editable: true`). Throw to show the message. */
  onEdit?: TableOptions<R>["onEdit"];
  /** Totals row with each column's aggregate over all filtered rows (default: when a column has `aggregate`). */
  footer?: boolean | undefined;
  /** Toolbar with search, grouping, filters and CSV (default true). */
  toolbar?: boolean | undefined;
  /** CSV file name (without .csv). */
  filename?: string | undefined;
  /** Enter / double-click on a non-editable cell. */
  onActivate?: ((row: R, key: string) => void) | undefined;
  label?: MaybeFn<string | undefined>;
  class?: ClassProp;
}

const SEL_W = 44;
const num = (v: number): string => String(applyPipe("number", v));
const DEFAULT_W = 160;
type Item<R> = GroupItem<R>;
interface Painted { el: HTMLElement; sig: string; dispose: () => void }

/** `<DataGrid rows={rows} columns={[{ key: "amount", aggregate: "sum" }]} groupBy={["region"]} selectable />` */
export function DataGrid<R = Row>(props: DataGridProps<R>): Element {
  const id = uid("hm-dg");
  const table: TableState<R> = props.table ?? createTable<R>({
    rows: props.rows, columns: props.columns as TableOptions<R>["columns"], rowKey: props.rowKey,
    paging: false, virtual: true, onEdit: props.onEdit, filename: props.filename,
  });
  const defs = new Map<string, DataGridColumn<R>>();
  for (const c of props.columns ?? []) if (typeof c === "object" && c.key) defs.set(String(c.key), c);
  const aggOf = (key: string): Aggregate<R> | undefined => defs.get(key)?.aggregate;
  const rowH = (): number => val(props.rowHeight) ?? 36;
  const headH = (): number => rowH() + 4;
  const filterH = 44;

  // ------------------------------------------------------------------ grouping
  const ownGroups = signal<string[]>([...(untrack(() => val(props.groupBy)) ?? [])]);
  const groupKeys = (): string[] => (props.onGroupBy ? [...(val(props.groupBy) ?? [])] : ownGroups());
  const setGroups = (keys: string[]): void => { if (props.onGroupBy) props.onGroupBy(keys); else ownGroups.set(keys); };
  // uncontrolled with an accessor: a new groupBy value replaces the grouping (menus and chips change it in between)
  if (!props.onGroupBy && typeof props.groupBy === "function") effect(() => { ownGroups.set([...(val(props.groupBy) ?? [])]); });
  const collapsed = signal(new Set<string>());
  let justOpened: string | null = null;
  const aggList = computed((): GroupAggregate<R>[] => table.visibleColumns().filter((c) => aggOf(String(c.key)) != null)
    .map((c) => ({ key: String(c.key), value: (r: R) => valueOf(r, c), aggregate: aggOf(String(c.key)) as Aggregate<R> })));
  const grouped = computed((): Item<R>[] | null => {
    const keys = groupKeys().filter((k) => table.column(k));
    if (!keys.length) return null;
    const cs = collapsed();
    return groupRows(table.rows(), keys.map((k) => { const c = table.column(k) as TableColumn<R>; return { key: k, value: (r: R) => valueOf(r, c), label: (v: unknown) => v }; }), { aggregates: aggList(), collapsed: (gid) => cs.has(gid) });
  });
  const count = (): number => grouped()?.length ?? table.rows().length;
  const itemAt = (i: number): Item<R> | undefined => { const g = grouped(); if (g) return g[i]; const r = table.rows()[i]; return r === undefined ? undefined : { kind: "row", row: r, depth: 0 }; };
  const totals = computed(() => aggregates(table.rows(), aggList()));
  const showFooter = (): boolean => props.footer ?? aggList().length > 0;

  // ------------------------------------------------------------------ columns: pinned start | virtual middle | pinned end
  const cols = computed(() => {
    const vis = table.visibleColumns();
    const start = vis.filter((c) => table.pinOf(String(c.key)) === "left"), end = vis.filter((c) => table.pinOf(String(c.key)) === "right");
    const middle = vis.filter((c) => !table.pinOf(String(c.key)));
    return { start, middle, end, nav: [...start, ...middle, ...end] };
  });
  const widthOf = (c: TableColumn<R>): number => table.widthOf(String(c.key)) ?? c.width ?? DEFAULT_W;
  const sum = (list: TableColumn<R>[]): number => list.reduce((a, c) => a + widthOf(c), 0);
  const selW = (): number => (props.selectable ? SEL_W : 0);
  const startW = computed(() => selW() + sum(cols().start));
  const endW = computed(() => sum(cols().end));
  const colAxis = createAxis({ count: () => cols().middle.length, size: (i) => widthOf(cols().middle[i] as TableColumn<R>) });
  const rows = createAxis({ count, size: () => rowH() });
  const vp = createViewport({
    rows, cols: colAxis, height: props.height ?? 480,
    inset: () => ({ top: headH() + (filtersOpen() ? filterH : 0), bottom: showFooter() ? rowH() : 0, start: startW(), end: endW() }),
  });
  const totalW = (): number => startW() + colAxis.total() + endW();

  // ------------------------------------------------------------------ cursor, focus, filters
  const cursor = signal({ r: 0, c: 0 });
  const filtersOpen = signal(false);
  const rtl = (): boolean => dir() === "rtl";
  const cellId = (r: number, c: number): string => `${id}-${r}-${c}`;
  let scroller!: HTMLElement;
  const middleIndex = (c: number): number | null => { const s = cols().start.length; return c >= s && c < s + cols().middle.length ? c - s : null; };
  const go = (r: number, c: number): void => {
    const n = count(), m = cols().nav.length;
    if (!n || !m) return;
    const next = { r: clamp(r, 0, n - 1), c: clamp(c, 0, m - 1) };
    cursor.set(next);
    vp.reveal(next.r, middleIndex(next.c));
  };

  // ------------------------------------------------------------------ editing
  const editableCol = (c: TableColumn<R> | undefined): boolean => !!c?.editable && (!!props.onEdit || !!props.table);
  const startEdit = (r: number, c: number, initial?: string): void => {
    const it = itemAt(r), col = cols().nav[c];
    if (it?.kind !== "row" || !col) return;
    if (!editableCol(col)) { props.onActivate?.(it.row, String(col.key)); return; }
    table.startEdit(it.row, String(col.key));
    if (initial !== undefined) table.setDraft(initial);
  };
  const focusGrid = (): void => scroller?.focus({ preventScroll: true });
  // after a save, flash the cell (motion engine; a soft layer fades out)
  const flash = (r: number, c: number): void => {
    const cell = scroller?.querySelector<HTMLElement>(`#${cellId(r, c)}`);
    if (!cell) return;
    const f = h("span", { class: "hm-dg-flash", "aria-hidden": "true" }) as HTMLElement;
    cell.appendChild(f);
    void animate(f, [{ opacity: 1 }, { opacity: 0 }], { duration: 700, easing: "ease-out" }).finished.then(() => f.remove());
  };
  const commit = async (move: "down" | "next" | "prev" | null): Promise<void> => {
    const { r, c } = untrack(cursor);
    const ok = await table.commitEdit();
    if (!ok) return;
    flash(r, c);
    focusGrid();
    if (move === "down") go(r + 1, c);
    else if (move === "next") go(r, c + 1);
    else if (move === "prev") go(r, c - 1);
  };

  // ------------------------------------------------------------------ cells
  const sortMark = (key: string): Element | null => {
    const d = table.sortDir(key);
    if (!d) return null;
    const multi = table.sort().length > 1;
    return h("span", { class: cx("hm-dg-sort", d === "desc" && "is-desc"), "aria-hidden": "true" }, glyph(arrowUp), multi ? h("small", {}, String(table.sortIndex(key) + 1)) : null);
  };
  const ariaSort = (key: string): string | null => { const d = table.sortDir(key); return d === "asc" ? "ascending" : d === "desc" ? "descending" : null; };

  const headerCell = (col: TableColumn<R>, c: number, pin: string | null): HTMLElement => {
    const key = String(col.key);
    const grouped = groupKeys().includes(key);
    const items: MenuItem[] = [
      { label: () => t`Sort ascending`, onSelect: () => table.setSort([{ key, dir: "asc" }]) },
      { label: () => t`Sort descending`, onSelect: () => table.setSort([{ key, dir: "desc" }]) },
      { label: () => t`Clear sort`, hidden: () => !table.sortDir(key), onSelect: () => table.setSort(table.sort().filter((s) => s.key !== key)) },
      "-",
      { label: () => (grouped ? t`Ungroup` : t`Group by this column`), hidden: () => defs.get(key)?.groupable === false, onSelect: () => setGroups(grouped ? groupKeys().filter((k) => k !== key) : [...groupKeys(), key]) },
      { label: () => t`Pin to start`, hidden: () => pin === "left", onSelect: () => table.pin(key, "left") },
      { label: () => t`Pin to end`, hidden: () => pin === "right", onSelect: () => table.pin(key, "right") },
      { label: () => t`Unpin`, hidden: () => !pin, onSelect: () => table.pin(key, null) },
      "-",
      { label: () => t`Hide column`, onSelect: () => table.setHidden(key, true) },
    ];
    const el = h("div", {
      role: "columnheader", class: cx("hm-dg-cell", "hm-dg-th", `hm-align-${col.align}`, col.sortable && "is-sortable", table.sortDir(key) && "is-sorted"),
      "aria-colindex": String(c + 1 + (props.selectable ? 1 : 0)), "aria-sort": ariaSort(key), "data-key": key, "data-c": String(c),
    },
    h("span", { class: "hm-dg-th-label", title: col.label }, col.label), sortMark(key),
    h("span", { class: "hm-dg-th-menu", "data-no-drag": "" }, h(Menu, { label: () => t`Column ${col.label}`, icon: moreVertical, size: "sm", variant: "ghost", items })),
    col.resizable === false ? null : h("span", {
      class: "hm-dg-resize", tabindex: "-1", "aria-label": t`Resize ${col.label}`, "data-no-drag": "",
      // drag / arrows (RTL mirrored) / double click autosizes: the resize-handle behavior
      ref: (x: HTMLElement) => resizeHandle(x, {
        value: () => widthOf(col), set: (w) => table.setWidth(key, w), min: col.minWidth, reset: () => autosize(col),
        onStart: () => el.classList.add("is-resizing"), onEnd: () => el.classList.remove("is-resizing"),
      }),
    })) as HTMLElement;
    setStyle(el, { width: `${widthOf(col)}px` });
    el.addEventListener("pointerdown", (e) => headerDown(e, col, el));
    return el;
  };

  // click = sort; drag = reorder inside the same pin group (drop indicator, then FLIP slide of the columns)
  const headerDown = (e: PointerEvent, col: TableColumn<R>, el: HTMLElement): void => {
    if (e.button !== 0 || (e.target as Element).closest("[data-no-drag]")) return;
    const key = String(col.key), group = (pin: string | null): TableColumn<R>[] => (pin === "left" ? cols().start : pin === "right" ? cols().end : cols().middle);
    const list = group(table.pinOf(key));
    let target: string | null = null;
    const marker = h("span", { class: "hm-dg-drop", "aria-hidden": "true" }) as HTMLElement;
    pointerDrag(e, {
      scroll: scroller,
      onClick: (ev) => { if (col.sortable) table.toggleSort(key, ev.shiftKey); },
      onStart: () => { el.classList.add("is-dragging"); el.parentElement?.appendChild(marker); },
      onMove: (p) => {
        setStyle(el, { transform: `translateX(${p.dx}px)` });
        const heads = [...(el.parentElement?.parentElement?.querySelectorAll<HTMLElement>(".hm-dg-th") ?? [])].filter((x) => list.some((c) => String(c.key) === x.dataset["key"]));
        let best: HTMLElement | null = null;
        for (const x of heads) { const r = x.getBoundingClientRect(); if (p.clientX >= r.left && p.clientX <= r.right) best = x; }
        target = best && best !== el ? best.dataset["key"] ?? null : null;
        if (best && target) {
          const r = best.getBoundingClientRect(), pr = (el.parentElement as HTMLElement).getBoundingClientRect();
          const after = list.findIndex((c) => String(c.key) === target) > list.findIndex((c) => String(c.key) === key);
          const edge = (after !== rtl() ? r.right : r.left) - pr.left;
          setStyle(marker, { transform: `translateX(${edge}px)`, opacity: "1" });
        } else setStyle(marker, { opacity: "0" });
      },
      onEnd: (_p, cancelled) => {
        el.classList.remove("is-dragging"); marker.remove(); setStyle(el, { transform: null });
        if (cancelled || !target) return;
        const from = list.findIndex((c) => String(c.key) === key), to = list.findIndex((c) => String(c.key) === target);
        const before = to > from ? list[to + 1] : list[to];
        flipColumns(() => (before ? table.moveColumnTo(key, String(before.key)) : table.moveColumn(key, list.length)));
      },
    });
  };
  // FLIP: remember each visible column's x, change the order, slide every cell from its old x
  const flipColumns = (change: () => void): void => {
    const xs = new Map<string, number>();
    for (const x of scroller.querySelectorAll<HTMLElement>(".hm-dg-th")) xs.set(x.dataset["key"] as string, x.getBoundingClientRect().left);
    change();
    paint();
    for (const cell of scroller.querySelectorAll<HTMLElement>(".hm-dg-head .hm-dg-th, .hm-dg-body .hm-dg-cell[data-key]")) {
      const head = [...scroller.querySelectorAll<HTMLElement>(".hm-dg-th")].find((x) => x.dataset["key"] === cell.dataset["key"]);
      const old = xs.get(cell.dataset["key"] as string);
      if (!head || old == null) continue;
      const d = old - head.getBoundingClientRect().left;
      if (Math.abs(d) > 1) void animate(cell, [{ transform: `translateX(${d}px)` }, { transform: "none" }], { duration: 260, easing: "easeOutCubic" });
    }
  };
  // fit a column to its header and the rendered cells (approximate: character count of the visible text)
  const autosize = (col: TableColumn<R>): void => {
    const key = String(col.key);
    let chars = col.label.length + 4;
    const { start, end } = vp.rows();
    for (let i = start; i < end; i++) { const it = itemAt(i); if (it?.kind === "row") chars = Math.max(chars, String(formatValue(it.row, col) ?? "").length); }
    table.setWidth(key, Math.min(480, chars * 8 + 32));
  };

  const cellText = (row: R, col: TableColumn<R>): unknown => (col.render ? col.render(row) : formatValue(row, col));
  const bodyCell = (it: GroupRow<R>, r: number, col: TableColumn<R>, c: number): HTMLElement => {
    const key = String(col.key);
    const ed = table.editing();
    const isEditing = !!ed && ed.id === table.idOf(it.row) && ed.key === key;
    const el = h("div", {
      role: "gridcell", id: cellId(r, c), class: cx("hm-dg-cell", `hm-align-${col.align}`, editableCol(col) && "is-editable", isEditing && "is-editing", col.cellClass as string),
      "aria-colindex": String(c + 1 + (props.selectable ? 1 : 0)), "data-key": key, "data-c": String(c),
    }) as HTMLElement;
    setStyle(el, { width: `${widthOf(col)}px` });
    if (isEditing) { el.append(CellEditor(table, col, it.row, id, editorKey)); return el; }
    const v = cellText(it.row, col);
    if (v instanceof Node) el.append(v);
    else { const s = String(v ?? ""); el.textContent = s; if (s.length > 12) el.title = s; }
    return el;
  };
  // a group row is one sticky bar as wide as the view: name, count and the group's aggregates (never cut off by a column)
  const groupBar = (it: GroupHeader<R>, r: number): HTMLElement => {
    const lvl = table.column(it.level);
    const bar = h("div", {
      role: "gridcell", id: cellId(r, 0), class: "hm-dg-cell hm-dg-group-label", "data-c": "0", "aria-colindex": "1", "aria-colspan": String(cols().nav.length + (props.selectable ? 1 : 0)),
    },
    h("span", { class: cx("hm-dg-chev", it.open && "is-open"), "aria-hidden": "true" }, glyph(chevronRight)),
    h("span", { class: "hm-dg-group-name" }, `${lvl?.label ?? it.level}: `, h("b", {}, String(lvl ? formatValue(it.rows[0] as R, lvl) : it.value ?? "") || t`(empty)`)),
    h("span", { class: "hm-dg-count" }, num(it.count)),
    h("span", { class: "hm-dg-group-aggs" }, aggList().map((a) => { const col = table.column(a.key) as TableColumn<R>; return h("span", { class: "hm-dg-group-agg" }, h("small", {}, col.label), aggText(col, it.aggregates[a.key])); }))) as HTMLElement;
    setStyle(bar, { width: `${Math.max(240, vp.width() - 2)}px` });
    return bar;
  };
  const aggText = (col: TableColumn<R>, v: unknown): Node => {
    const kind = aggOf(String(col.key));
    const shown = v == null ? "" : typeof v === "number" && kind !== "count" && kind !== "distinct" && col.format ? formatValue({ v }, col.format === undefined ? { key: "v" } : { key: "v", format: col.format as Column<{ v: unknown }>["format"] & {} }) : typeof v === "number" ? num(v) : String(v);
    const sym: Record<string, string> = { sum: "Σ", avg: "x̄", min: "↓", max: "↑", count: "#", distinct: "≠" };
    return h("span", { class: "hm-dg-agg", title: typeof kind === "string" ? aggLabel(kind) : "" }, typeof kind === "string" ? h("small", { "aria-hidden": "true" }, sym[kind] ?? "") : null, String(shown)) as Node;
  };
  const aggLabel = (k: string): string => ({ sum: t`Sum`, avg: t`Average`, min: t`Minimum`, max: t`Maximum`, count: t`Count`, distinct: t`Distinct` } as Record<string, string>)[k] ?? k;
  const editorKey = (e: KeyboardEvent): void => {
    if (e.key === "Tab") { e.preventDefault(); void commit(e.shiftKey ? "prev" : "next"); }
    else if (e.key === "Enter") { e.preventDefault(); void commit("down"); }
    else if (e.key === "Escape") { e.preventDefault(); table.cancelEdit(); focusGrid(); }
  };

  // one row (header, data, group or footer): [pinned start] [spacer] [visible middle] [spacer] [pinned end]
  const rowShell = (make: (col: TableColumn<R>, c: number, pin: string | null) => HTMLElement, lead: HTMLElement | null): DocumentFragment => {
    const { start, middle, end } = cols(), range = vp.cols(), s = start.length;
    const frag = document.createDocumentFragment();
    const ps = h("div", { class: "hm-dg-pin hm-dg-pin-start" }) as HTMLElement;
    if (lead) ps.append(lead);
    start.forEach((col, i) => ps.append(make(col, i, "left")));
    setStyle(ps, { width: `${startW()}px` });
    frag.append(ps);
    const pre = h("div", { class: "hm-dg-gap" }) as HTMLElement;
    setStyle(pre, { width: `${range.top}px` });
    frag.append(pre);
    for (let i = range.start; i < range.end; i++) frag.append(make(middle[i] as TableColumn<R>, s + i, null));
    const post = h("div", { class: "hm-dg-gap" }) as HTMLElement;
    setStyle(post, { width: `${range.bottom}px` });
    frag.append(post);
    if (end.length) {
      const pe = h("div", { class: "hm-dg-pin hm-dg-pin-end" }) as HTMLElement;
      end.forEach((col, i) => pe.append(make(col, s + middle.length + i, "right")));
      setStyle(pe, { width: `${endW()}px` });
      frag.append(pe);
    }
    return frag;
  };
  const checkCell = (checked: boolean | "mixed", label: string, onToggle: (e: MouseEvent) => void, role = "gridcell"): HTMLElement => {
    const box = h("input", { type: "checkbox", class: "hm-table-check", tabindex: "-1", "aria-label": label, onClick: (e: MouseEvent) => { e.stopPropagation(); onToggle(e); } }) as HTMLInputElement;
    box.checked = checked === true; box.indeterminate = checked === "mixed";
    const cell = h("div", { role, class: "hm-dg-cell hm-dg-check", "aria-colindex": "1" }, box) as HTMLElement;
    setStyle(cell, { width: `${SEL_W}px` });
    return cell;
  };

  // ------------------------------------------------------------------ DOM
  const headRow = h("div", { role: "row", class: "hm-dg-row hm-dg-head-row", "aria-rowindex": "1" }) as HTMLElement;
  const head = h("div", { role: "rowgroup", class: "hm-dg-head" }, headRow, () => (filtersOpen() ? filterRow() : null)) as HTMLElement;
  const rowsEl = h("div", { role: "rowgroup", class: "hm-dg-body" }) as HTMLElement;
  const footRow = h("div", { role: "row", class: "hm-dg-row hm-dg-foot-row" }) as HTMLElement;
  const foot = h("div", { role: "rowgroup", class: "hm-dg-foot", hidden: () => !showFooter() }, footRow) as HTMLElement;
  const canvas = h("div", { class: "hm-dg-canvas" }, head, rowsEl, foot) as HTMLElement;
  const empty = h("div", { class: "hm-dg-empty", hidden: () => count() > 0 || table.loading() }, () => (table.activeFilters().length || table.search() ? t`No matching rows` : t`No rows`)) as HTMLElement;

  const filterRow = (): Element => {
    const r = h("div", { role: "row", class: "hm-dg-row hm-dg-filter-row" }) as HTMLElement;
    const lead = props.selectable ? h("div", { class: "hm-dg-cell hm-dg-check", role: "gridcell" }) as HTMLElement : null;
    if (lead) setStyle(lead, { width: `${SEL_W}px` });
    effect(() => {
      r.replaceChildren(rowShell((col) => {
        const cell = h("div", { role: "gridcell", class: "hm-dg-cell hm-dg-filter", "data-key": String(col.key) }) as HTMLElement;
        setStyle(cell, { width: `${widthOf(col)}px` });
        if (col.filter) untrack(() => cell.append(FilterControl(table, col) as Node));
        return cell;
      }, lead));
      setStyle(r, { width: `${totalW()}px`, height: `${filterH}px` });
    });
    return r;
  };

  const painted = new Map<string, Painted>();
  let disposeHead = (): void => {};
  let paintedLayout = "";
  let animateNext: "rows" | null = null;
  const keyOf = (it: Item<R>): string => (it.kind === "group" ? `g:${it.id}` : `r:${String(table.idOf(it.row))}`);

  function paint(): void {
    const c = cols(), range = vp.rows(), cr = vp.cols(), h0 = rowH(), cur = cursor(), sel = table.selected(), ed = table.editing();
    const layout = [cr.start, cr.end, h0, startW(), endW(), c.nav.map((x) => `${String(x.key)}:${widthOf(x)}:${table.pinOf(String(x.key)) ?? ""}`).join(","), table.sort().map((s) => s.key + s.dir).join(","), props.selectable].join("|");
    // header
    const st = props.selectable ? table.pageSelection() : "none";
    if (`${layout}|${st}` !== paintedLayout) {
      // the header has menus (their own reactive state): built in a root of its own, disposed when rebuilt
      disposeHead();
      createRoot((d) => {
        disposeHead = d;
        headRow.replaceChildren(rowShell((col, i, pin) => headerCell(col, i, pin), props.selectable ? checkCell(st === "all" ? true : st === "some" ? "mixed" : false, t`Select all rows`, () => table.selectPage(st !== "all"), "columnheader") : null));
      });
      setStyle(headRow, { width: `${totalW()}px`, height: `${headH()}px` });
    }
    setStyle(canvas, { width: `${totalW()}px` });
    setStyle(rowsEl, { height: `${rows.total()}px` });
    // body rows: reuse a painted row while its item, layout, edit and selection state are unchanged
    const keep = new Set<string>();
    const fresh: HTMLElement[] = [];
    for (let r = range.start; r < range.end; r++) {
      const it = itemAt(r);
      if (!it) continue;
      const k = keyOf(it);
      keep.add(k);
      const isSel = it.kind === "row" && sel.has(table.idOf(it.row));
      const edKey = ed && it.kind === "row" && ed.id === table.idOf(it.row) ? `${ed.key}:${ed.error ?? ""}:${ed.saving}` : "";
      const sig = `${layout}|${r}|${isSel}|${edKey}|${it.kind === "group" ? `${it.open}:${it.count}:${vp.width()}:${JSON.stringify(it.aggregates)}` : ""}`;
      let p = painted.get(k);
      const rowObj = it.kind === "row" ? it.row : null;
      if (p && p.sig === sig && (p.el as unknown as { _row?: unknown })._row === rowObj) { setStyle(p.el, { transform: `translateY(${r * h0}px)` }); continue; }
      p?.dispose(); p?.el.remove();
      const el = createRoot((dispose) => {
        const row = h("div", {
          role: "row", class: cx("hm-dg-row", it.kind === "group" ? "hm-dg-group" : "hm-dg-data", isSel && "is-selected", r % 2 && "is-odd"),
          "aria-rowindex": String(r + 2), "aria-selected": props.selectable && it.kind === "row" ? String(isSel) : null,
          "aria-expanded": it.kind === "group" ? String(it.open) : null, "aria-level": it.kind === "group" ? String(it.depth + 1) : null, "data-r": String(r),
        }) as HTMLElement;
        const lead = props.selectable ? (it.kind === "row" ? checkCell(isSel, t`Select row`, (e) => { go(r, untrack(cursor).c); table.toggle(it.row, { range: e.shiftKey }); }) : (() => { const x = h("div", { role: "gridcell", class: "hm-dg-cell hm-dg-check" }) as HTMLElement; setStyle(x, { width: `${SEL_W}px` }); return x; })()) : null;
        if (it.kind === "group") row.append(groupBar(it, r));
        else row.append(rowShell((col, i) => bodyCell(it, r, col, i), lead));
        setStyle(row, { width: `${totalW()}px`, height: `${h0}px`, transform: `translateY(${r * h0}px)`, "--hm-dg-depth": String(it.depth) });
        (row as unknown as { _row?: unknown })._row = rowObj;
        painted.set(k, { el: row, sig, dispose });
        return row;
      });
      rowsEl.append(el);
      if (animateNext || (justOpened && isInside(it, justOpened))) fresh.push(el);
    }
    for (const [k, p] of painted) if (!keep.has(k)) { p.dispose(); p.el.remove(); painted.delete(k); }
    paintedLayout = `${layout}|${st}`;
    // cursor ring + aria-activedescendant
    for (const x of rowsEl.querySelectorAll(".is-cursor")) x.classList.remove("is-cursor");
    const active = scroller?.querySelector<HTMLElement>(`#${cellId(cur.r, cur.c)}`) ?? scroller?.querySelector<HTMLElement>(`#${cellId(cur.r, 0)}`);
    active?.classList.add("is-cursor");
    if (scroller) { if (active) scroller.setAttribute("aria-activedescendant", active.id); else scroller.removeAttribute("aria-activedescendant"); }
    // footer totals
    if (showFooter()) {
      footRow.replaceChildren(rowShell((col, i) => {
        const cell = h("div", { role: "gridcell", class: cx("hm-dg-cell", `hm-align-${col.align}`), "data-key": String(col.key) }) as HTMLElement;
        setStyle(cell, { width: `${widthOf(col)}px` });
        const key = String(col.key);
        if (key in totals()) cell.append(aggText(col, totals()[key]));
        else if (i === 0) cell.append(h("b", {}, t`Total`) as Node);
        return cell;
      }, props.selectable ? (() => { const x = h("div", { class: "hm-dg-cell hm-dg-check", role: "gridcell" }) as HTMLElement; setStyle(x, { width: `${SEL_W}px` }); return x; })() : null));
      setStyle(footRow, { width: `${totalW()}px`, height: `${h0}px` });
    }
    // entrance: rows after a sort / group / filter change and rows revealed by opening a group
    if (fresh.length) {
      const d = stagger(14);
      fresh.slice(0, 40).forEach((el, i) => void animate(el, [{ opacity: 0, translate: "0 -6px" }, { opacity: 1, translate: "0 0" }], { duration: 240, delay: d(i), easing: "easeOutCubic" }));
    }
    animateNext = null; justOpened = null;
  }
  // group path of a row ("Sales/2026"), the same ids groupRows() gives its headers
  const pathOf = (row: R): string => groupKeys().map((k) => { const c = table.column(k); const v = c ? valueOf(row, c) : undefined; return String((v instanceof Date ? v.getTime() : v) ?? ""); }).join("/");
  const isInside = (it: Item<R>, gid: string): boolean => (it.kind === "group" ? it.id.startsWith(`${gid}/`) : `${pathOf(it.row)}/`.startsWith(`${gid}/`));

  // ------------------------------------------------------------------ interaction
  const toggleGroup = (it: Item<R>, open?: boolean): void => {
    if (it.kind !== "group") return;
    const want = open ?? !it.open;
    if (want === it.open) return;
    if (want) justOpened = it.id;
    collapsed.update((s) => { const n = new Set(s); if (want) n.delete(it.id); else n.add(it.id); return n; });
  };
  const onKey = (e: KeyboardEvent): void => {
    if ((e.target as Element) !== scroller) return;
    const { r, c } = untrack(cursor), it = itemAt(r), m = cols().nav.length, ctrl = e.ctrlKey || e.metaKey;
    const page = Math.max(1, Math.floor((scroller.clientHeight - headH()) / rowH()) - 1);
    if (it?.kind === "group" && (e.key === "Enter" || e.key === " " || ((e.key === "ArrowRight" || e.key === "ArrowLeft") && c === 0))) {
      e.preventDefault();
      toggleGroup(it, e.key === "ArrowRight" ? !rtl() : e.key === "ArrowLeft" ? rtl() : undefined);
      return;
    }
    if (e.key === "ArrowLeft" || e.key === "ArrowRight" || ((e.key === "Home" || e.key === "End") && !ctrl)) {
      const nc = moveCursor({ key: e.key, index: c, count: m, columns: m, rtl: rtl() });
      if (nc != null) { e.preventDefault(); go(r, nc); }
      return;
    }
    const nr = moveCursor({ key: e.key, index: r, count: count(), page, ctrl });
    if (nr != null) {
      e.preventDefault();
      go(nr, c);
      const next = itemAt(nr);
      if (props.selectable && e.shiftKey && next?.kind === "row") table.toggle(next.row, { range: true, on: true });
      return;
    }
    if (e.key === "Enter" || e.key === "F2") { e.preventDefault(); startEdit(r, c); }
    else if (e.key === " " && props.selectable && it?.kind === "row") { e.preventDefault(); table.toggle(it.row, { range: e.shiftKey }); }
    else if (ctrl && e.key.toLowerCase() === "a" && props.selectable) { e.preventDefault(); table.selectPage(true); }
    else if (ctrl && e.key.toLowerCase() === "c") { e.preventDefault(); void copy(); }
    else if (e.key === "Escape" && props.selectable) table.clearSelection();
    else if (e.key.length === 1 && !ctrl && !e.altKey && editableCol(cols().nav[c])) { e.preventDefault(); startEdit(r, c, e.key); }
  };
  // Ctrl+C: selected rows as tab-separated lines (with header), else the cursor cell
  const copy = async (): Promise<void> => {
    const nav = cols().nav, sel = table.selectedRows();
    let text: string;
    if (sel.length) text = [nav.map((c) => c.label).join("\t"), ...sel.map((row) => nav.map((c) => String(formatValue(row, c) ?? "")).join("\t"))].join("\n");
    else { const it = itemAt(untrack(cursor).r), col = nav[untrack(cursor).c]; text = it?.kind === "row" && col ? String(formatValue(it.row, col) ?? "") : ""; }
    try { await globalThis.navigator?.clipboard?.writeText(text); } catch { /* clipboard blocked */ }
  };
  const cellAt = (e: Event): { r: number; c: number } | null => {
    const cell = (e.target as Element).closest<HTMLElement>(".hm-dg-cell[data-c]"), row = (e.target as Element).closest<HTMLElement>("[data-r]");
    return cell && row ? { r: Number(row.dataset["r"]), c: Number(cell.dataset["c"]) } : null;
  };

  scroller = h("div", {
    class: "hm-dg-scroll", role: "grid", tabindex: "0", id: `${id}-grid`,
    "aria-label": () => val(props.label) ?? t`Data grid`, "aria-rowcount": () => String(count() + 1), "aria-colcount": () => String(cols().nav.length + (props.selectable ? 1 : 0)),
    "aria-multiselectable": props.selectable ? "true" : null,
    onKeydown: onKey,
    onClick: (e: MouseEvent) => {
      if ((e.target as Element).closest("input,select,button,textarea")) return;
      const at = cellAt(e);
      if (!at) return;
      const it = itemAt(at.r);
      cursor.set(at);
      focusGrid();
      if (it?.kind === "group") toggleGroup(it);
      else if (it && props.selectable && (e.shiftKey || e.ctrlKey || e.metaKey)) table.toggle(it.row, { range: e.shiftKey });
    },
    onDblclick: (e: MouseEvent) => { const at = cellAt(e); if (at) startEdit(at.r, at.c); },
  }, canvas, empty) as HTMLElement;
  setStyle(scroller, { height: `${props.height ?? 480}px` });

  const toolbar = props.toolbar === false ? null : Toolbar();
  function Toolbar(): Element {
    const searchBox = h("input", {
      type: "search", class: "hm-table-input hm-dg-search", placeholder: () => t`Search`, "aria-label": () => t`Search`,
      value: () => table.search(), onInput: (e: Event) => table.setSearch((e.target as HTMLInputElement).value),
    });
    return h("div", { class: "hm-dg-toolbar", role: "toolbar", "aria-label": () => t`Grid tools` },
      h("label", { class: "hm-dg-searchwrap" }, h("span", { class: "hm-dg-search-icon", "aria-hidden": "true" }, glyph(searchIcon)), searchBox),
      h("div", { class: "hm-dg-groups", "aria-label": () => t`Grouping` },
        h("span", { class: "hm-dg-groups-icon", "aria-hidden": "true" }, glyph(layers)),
        () => (groupKeys().length
          ? groupKeys().map((k) => h(Chip, { size: "sm", tone: "primary", onRemove: () => setGroups(groupKeys().filter((x) => x !== k)) }, table.column(k)?.label ?? k))
          : h("span", { class: "hm-dg-hint" }, t`Group with a column menu`))),
      h("span", { class: "hm-dg-spacer" }),
      () => (table.visibleColumns().length < table.allColumns().length ? h("button", { type: "button", class: "hm-btn hm-btn-ghost hm-btn-sm", onClick: () => { for (const c of table.allColumns()) table.setHidden(String(c.key), false); } }, t`Show all columns`) : null),
      h("button", { type: "button", class: () => cx("hm-btn hm-btn-sm", filtersOpen() ? "hm-btn-primary" : "hm-btn-secondary"), "aria-pressed": () => String(filtersOpen()), onClick: () => filtersOpen.set(!filtersOpen()) },
        glyph(filterIcon), () => (table.activeFilters().length ? t`Filters (${table.activeFilters().length})` : t`Filters`)),
      h("button", { type: "button", class: "hm-btn hm-btn-secondary hm-btn-sm", onClick: () => void table.exportCSV({ download: true, filename: `${props.filename ?? "data"}.csv` }) }, glyph(download), t`CSV`),
      h("span", { class: "hm-dg-total", role: "status" }, () => t`${num(table.rows().length)} rows`, () => (table.selectedCount() ? h("b", {}, ` · ${t`${num(table.selectedCount())} selected`}`) : null)));
  }

  const root = h("div", { class: () => cx("hm-dg", val(props.class)) }, toolbar, scroller) as HTMLElement;
  vp.bind(scroller);
  // repaint on any change the window depends on (scroll only repaints when the rendered range changes)
  effect(() => paint());
  // sort / group / filter changes: rows enter with a short stagger
  let first = true;
  effect(() => { table.sort(); groupKeys(); table.filters(); table.search(); if (first) { first = false; return; } animateNext = "rows"; });
  // keep the cursor inside the collection
  effect(() => { const n = count(), m = cols().nav.length, c = untrack(cursor); if (n && (c.r >= n || c.c >= m)) cursor.set({ r: Math.min(c.r, n - 1), c: Math.min(c.c, Math.max(0, m - 1)) }); });
  onCleanup(() => { disposeHead(); for (const p of painted.values()) p.dispose(); painted.clear(); });
  return root;
}
