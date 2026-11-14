/// <reference path="../css.d.ts" />
// <Table>: renders createTable() state as an accessible grid (or cards on small screens).
import "../css/table.css";
import { signal, computed, untrack, onCleanup, type Accessor } from "../core/reactive.ts";
import { arrowUp } from "../icons/glyphs/arrowUp.ts";
import { arrowDown } from "../icons/glyphs/arrowDown.ts";
import { x as xIcon } from "../icons/glyphs/x.ts";
import { moreVertical } from "../icons/glyphs/moreVertical.ts";
import { star } from "../icons/glyphs/star.ts";
import { starFilled } from "../icons/glyphs/starFilled.ts";
import { h } from "../dom/h.ts";
import { For, type ForProps } from "../dom/for.ts";
import { t } from "../core/i18n.ts";
import { createTable, type TableOptions, type TableState, type TableAction, type RowAction, type BulkAction } from "./state.ts";
import type { Row as DefaultRow, TableColumn } from "./filters.ts";
import { createVirtual, type Virtual } from "./virtual.ts";
import { clamp, uid, isRtl } from "../core/util.ts";
import { lazy } from "../dom/lazy.ts";
import { live } from "../forms/util.ts";
import { draggable } from "../behaviors/drag/index.ts";
import { moveCursor } from "../behaviors/list-nav/index.ts";
import { FilterControl, CellEditor, SortMark, ariaSort } from "./controls.ts";
import { Button, ActionButton, type ActionButtonProps } from "../components/actions/button/index.ts";
import { IconButton } from "../components/actions/icon-button/index.ts";
import { Chip } from "../components/actions/chip/index.ts";
import { Chevron } from "../components/actions/chevron/index.ts";
import { Checkbox } from "../components/forms/checkbox/index.ts";
import { Select, type SelectProps } from "../components/forms/select/index.ts";
import { TextInput } from "../components/forms/text-input/index.ts";
import { SearchBox } from "../components/forms/search-box/index.ts";
import { Skeleton } from "../components/feedback/skeleton/index.ts";
import { Empty } from "../components/feedback/empty/index.ts";
import { ErrorBox } from "../components/feedback/error-box/index.ts";
import { LiveStatus } from "../components/feedback/live-status/index.ts";
import { Pagination } from "../components/navigation/pagination/index.ts";
import { ResizeHandle } from "../components/layout/resize-handle/index.ts";
import type { PopoverProps } from "../components/overlays/popover/index.ts";
export { FilterControl, CellEditor };

const INTERACTIVE = "button,input,select,textarea,a,label,[data-no-row-click]";
// the floating panel of the toolbar and row menus loads the first time one opens (or is about to: hover, focus)
const Popover = lazy<PopoverProps>(() => import("../components/overlays/popover/index.ts"), { pick: "Popover", placeholder: "none" });
const each = <T>(props: ForProps<T>): unknown => h<ForProps<T>>(For, props);

/** <Table> props: every createTable() option (or a ready `table`) plus rendering options. */
export interface TableProps<R = DefaultRow> extends TableOptions<R> {
  table?: TableState<R> | undefined;
  selectable?: boolean | undefined;
  bulkActions?: readonly BulkAction<R>[] | undefined;
  rowActions?: readonly RowAction<R>[] | undefined;
  /** Inline buttons instead of a kebab menu (default: up to 2 actions inline). */
  rowActionsInline?: boolean | undefined;
  onRowClick?: ((row: R, e: Event) => void) | undefined;
  expand?: ((row: R) => unknown) | undefined;
  empty?: unknown;
  caption?: string | undefined;
  label?: string | undefined;
  layout?: "auto" | "table" | "cards" | undefined;
  cardBreakpoint?: number | undefined;
  height?: number | undefined;
  rowHeight?: number | undefined;
  overscan?: number | undefined;
  skeletonRows?: number | undefined;
  pageSizes?: readonly number[] | undefined;
  toolbar?: boolean | undefined;
  toolbarEnd?: unknown;
  exportable?: boolean | undefined;
  searchDelay?: number | undefined;
  rowClass?: ((row: R) => unknown) | undefined;
  resizable?: boolean | undefined;
  reorderable?: boolean | undefined;
  class?: unknown;
}

interface Ctx<R> {
  id: string;
  table: TableState<R>;
  props: TableProps<R>;
  selectable: boolean;
  expand: ((row: R) => unknown) | null;
  actions: readonly RowAction<R>[] | null;
  editable: () => boolean;
  interactive: boolean;
  lead: number;
  trail: number;
  colCount: () => number;
  active?: Element | undefined;
}
interface GridCtx<R> extends Ctx<R> { virtual: Virtual | null; offset: () => number; rowOf: WeakMap<Element, Accessor<R>> }

function useLayout<R>(props: TableProps<R>): () => "cards" | "table" {
  const forced = props.layout;
  if (forced === "cards" || forced === "table") return () => forced;
  // virtual scrolling only exists in the grid: a card list would render every row on phones
  if (props.virtual) return () => "table";
  const mm = globalThis.matchMedia?.(`(max-width: ${(props.cardBreakpoint ?? 640) - 0.02}px)`);
  const small = signal(!!mm?.matches);
  if (mm?.addEventListener) {
    const on = (e: MediaQueryListEvent): void => { small.set(!!e.matches); };
    mm.addEventListener("change", on);
    onCleanup(() => mm.removeEventListener("change", on));
  }
  return () => (small() ? "cards" : "table");
}

/**
 * Data table. Accepts every createTable() option (or a ready `table`), plus: selectable, bulkActions, rowActions,
 * rowActionsInline, onRowClick, expand, empty, caption, layout ("auto"|"table"|"cards"), cardBreakpoint, height,
 * rowHeight, overscan, pageSizes, toolbar, exportable, searchDelay, rowClass, resizable, reorderable.
 */
export function Table<R = DefaultRow>(props: TableProps<R>): Element {
  const table = props.table ?? createTable(props);
  const layout = useLayout(props);
  const selectable = !!props.selectable;
  const expand = typeof props.expand === "function" ? props.expand : null;
  const actions = props.rowActions ?? null;
  const editable = (): boolean => table.visibleColumns().some((c) => c.editable);
  const lead = (selectable ? 1 : 0) + (expand ? 1 : 0), trail = actions ? 1 : 0;
  const ctx: Ctx<R> = {
    id: uid("hm-table"), table, props, selectable, expand, actions, editable,
    interactive: selectable || !!actions || !!expand || !!props.onRowClick || untrack(editable),
    lead, trail,
    colCount: () => table.visibleColumns().length + lead + trail,
  };

  const root = h("div", {
    class: () => ["hm-table", layout() === "cards" ? "hm-table--cards" : "hm-table--grid", table.refreshing() && "is-refreshing", table.hasWidths() && "hm-table--fixed", props.class],
    id: ctx.id,
    "aria-busy": () => (table.loading() || table.refreshing() ? "true" : null),
  },
  props.toolbar !== false ? Toolbar(ctx) : null,
  Chips(ctx),
  ctx.selectable ? BulkBar(ctx) : null,
  () => { const l = layout(), v = table.isVirtual(); return untrack(() => (l === "cards" ? Cards(ctx) : Grid(ctx, v))); },
  table.paged ? Footer(ctx) : null);
  return root;
}

// ------------------------------------------------------------------ toolbar
interface MenuSpec {
  class: string;
  /** Trigger text (a Button), or with `icon` the accessible name of an IconButton. */
  label: string | (() => string);
  icon?: unknown;
  role?: "menu";
  body: (close: () => void) => unknown;
}
/** A trigger button with a floating panel (Popover). The trigger is drawn at once; the panel's code loads on first use. */
function Menu(o: MenuSpec): Element {
  const open = signal(false), used = signal(false);
  const warm = (): void => { void Popover.preload().catch(() => undefined); };
  const attrs = {
    "aria-haspopup": o.role ?? "dialog", "aria-expanded": () => String(open()),
    onPointerEnter: warm, onFocus: warm, onClick: () => { used.set(true); open.set(!open.peek()); },
  };
  const btn = (o.icon ? h(IconButton, { ...attrs, size: "sm", icon: o.icon, label: o.label }) : h(Button, { ...attrs, class: "hm-table-menu-btn" }, o.label)) as HTMLElement;
  return h("span", { class: ["hm-table-menu", o.class] }, btn,
    () => (used() ? untrack(() => h(Popover, {
      anchor: btn, open, placement: "bottom-end", role: o.role ?? "dialog", label: o.label, flush: true,
      onOpenChange: (on: boolean, why: string) => { if (!on && why === "escape") btn.focus(); },
      children: (close: () => void) => h("div", { class: ["hm-table-menu-body", o.role && "hm-table-menu-list"] }, o.body(close)),
    })) : null));
}

function Toolbar<R>(ctx: Ctx<R>): Element {
  const { table, props } = ctx;
  const filterCols = (): TableColumn<R>[] => table.allColumns().filter((c) => c.filter);
  return h("div", { class: "hm-table-toolbar" },
    props.search !== false ? h(SearchBox, {
      class: "hm-table-search", label: t`Search`, debounce: props.searchDelay ?? (table.mode === "server" ? 300 : 120),
      value: () => table.search(), onSearch: (v: string) => table.setSearch(v),
      inputRef: (el: HTMLInputElement) => el.setAttribute("aria-controls", ctx.id),
    }) : null,
    () => (filterCols().length ? untrack(() => Menu({ class: "hm-table-filters", label: t`Filters`, body: () => filterCols().map((c) => FilterControl(table, c)) })) : null),
    Menu({ class: "hm-table-columns", label: t`Columns`, body: () => ColumnsPanel(ctx) }),
    props.storageKey ? Menu({ class: "hm-table-views", label: () => table.activeView() ?? t`Views`, body: () => ViewsPanel(ctx) }) : null,
    props.exportable !== false ? Menu({ class: "hm-table-export", label: t`Export`, body: (close) => [
      h(Button, { onClick: () => { close(); void table.exportCSV(); } }, t`CSV`),
      h(Button, { onClick: () => { close(); void table.exportJSON(); } }, t`JSON`),
    ] }) : null,
    props.toolbarEnd ?? null);
}

function ColumnsPanel<R>(ctx: Ctx<R>): Element {
  const { table } = ctx;
  return h("ul", { class: "hm-table-colmenu", role: "list" }, each<TableColumn<R>>({ each: table.columns, key: "key", children: (col) => {
    const c = col(), key = c.key as string;
    return h("li", { class: "hm-table-colitem", "data-col": c.key },
      h(Checkbox, { class: "hm-table-colshow", label: c.label, value: live(() => !table.isHidden(key)), onChange: () => table.toggleColumn(key) }),
      h(IconButton, { size: "sm", icon: arrowUp, label: t`Move ${c.label} up`, onClick: () => table.moveColumn(key, -1) }),
      h(IconButton, { size: "sm", icon: arrowDown, label: t`Move ${c.label} down`, onClick: () => table.moveColumn(key, 1) }),
      h<SelectProps<"left" | "right">>(Select, {
        class: "hm-table-pin", "aria-label": t`Pin ${c.label}`, placeholder: t`Not pinned`, options: [{ value: "left", label: t`Pin start` }, { value: "right", label: t`Pin end` }],
        value: live(() => table.pinOf(key)), onChange: (v) => table.pin(key, v ?? null),
      }));
  } }), h("li", {}, h(Button, { onClick: table.resetColumns }, t`Reset columns`)));
}

function ViewsPanel<R>(ctx: Ctx<R>): unknown[] {
  const { table } = ctx;
  const name = signal("");
  const save = (): void => { table.saveView(name.peek()); name.set(""); };
  return [
    h("ul", { class: "hm-table-viewlist", role: "list" }, each<{ name: string }>({ each: table.views, key: "name", fallback: () => h("li", {}, h(Empty, { size: "sm", title: t`No saved views` })), children: (v) => {
      const n = v().name;
      const isDefault = computed(() => table.defaultView() === n);
      return h("li", { class: "hm-table-view" },
        h(Button, { variant: "link", pressed: live(() => table.activeView() === n), onClick: () => table.applyView(n) }, n),
        h(IconButton, { size: "sm", icon: () => (isDefault() ? starFilled : star), label: t`Make ${n} the default view`, pressed: isDefault, onClick: () => table.setDefaultView(isDefault.peek() ? null : n) }),
        h(IconButton, { size: "sm", icon: xIcon, label: t`Delete view ${n}`, onClick: () => table.deleteView(n) }));
    } })),
    h("div", { class: "hm-table-viewsave" }, h(TextInput, { value: name, placeholder: t`View name`, "aria-label": t`View name` }), h(Button, { onClick: save }, t`Save view`)),
  ];
}

function Chips<R>(ctx: Ctx<R>): () => unknown {
  const { table } = ctx;
  const any = computed(() => table.activeFilters().length > 0 || !!table.search());
  const chip = (label: string, text: unknown, clear: () => void): unknown => h(Chip, { class: "hm-table-chip", tone: "primary", onRemove: clear, removeLabel: t`Remove filter ${label}` }, label, ": ", text);
  return () => (any() ? untrack(() => h("div", { class: "hm-table-chips", role: "group", "aria-label": t`Active filters` },
    () => table.search() ? untrack(() => chip(t`Search`, `“${table.search()}”`, () => table.setSearch(""))) : null,
    each<{ key: string; label: string; text: string }>({ each: table.activeFilters, key: "key", children: (f) => chip(f().label, () => f().text, () => table.clearFilter(f().key)) }),
    h(Button, { variant: "link", class: "hm-table-clear", onClick: table.clearFilters }, t`Clear all`))) : null);
}

function BulkBar<R>(ctx: Ctx<R>): () => unknown {
  const { table, props } = ctx;
  const show = computed(() => table.selectedCount() > 0);
  const actions = props.bulkActions ?? [];
  return () => (show() ? untrack(() => h("div", { class: "hm-table-bulk", role: "region", "aria-label": t`Bulk actions` },
    h(LiveStatus, { class: "hm-table-bulk-count", text: () => (table.allMatching() && table.mode === "server" ? t`All ${table.total() ?? ""} selected` : t`${table.selectedCount()} selected`) }),
    () => (!table.allMatching() && table.pageSelection() === "all" && (table.total() ?? 0) > table.selectedCount()
      ? untrack(() => h(Button, { variant: "link", class: "hm-table-selectall", onClick: table.selectAllMatching }, t`Select all ${table.total()} matching`)) : null),
    actions.map((a) => h<ActionButtonProps<[R[]]>>(ActionButton, { action: a, args: (): [R[]] => [table.selectedRows()], run: () => table.runBulk(a), class: "hm-table-action" })),
    h(Button, { variant: "link", onClick: table.clearSelection }, t`Clear selection`))) : null);
}

// ------------------------------------------------------------------ grid
function Grid<R>(base: Ctx<R>, virtual: boolean): Element {
  const { table, props } = base;
  const rowHeight = props.rowHeight ?? 40;
  const v = virtual ? createVirtual({ count: () => table.rows().length, rowHeight, height: props.height ?? 480, overscan: props.overscan ?? 6 }) : null;
  const ctx: GridCtx<R> = Object.assign(base, {
    virtual: v,
    offset: v ? () => v.range().start : () => (table.paged && !table.isVirtual() && table.mode === "client" ? (table.page() - 1) * table.size() : 0),
    rowOf: new WeakMap<Element, Accessor<R>>(),
  });
  const shown = v ? computed(() => { const r = v.range(); return table.rows().slice(r.start, r.end); }) : table.rows;

  const pinVars = (): Record<string, string | null> => {
    const cols = table.visibleColumns(), out: Record<string, string | null> = { "--hm-table-lead": ctx.lead ? `calc(${ctx.lead} * var(--hm-table-lead-w))` : "0px", "--hm-table-trail": ctx.trail ? "3rem" : "0px" };
    let left = 0;
    cols.forEach((c, i) => { out[`--hm-pin-${i}`] = null; if (table.pinOf(c.key as string) === "left") { out[`--hm-pin-${i}`] = `${left}px`; left += table.widthOf(c.key as string) ?? 160; } });
    let right = 0;
    for (let i = cols.length - 1; i >= 0; i--) { const k = (cols[i] as TableColumn<R>).key as string; if (table.pinOf(k) === "right") { out[`--hm-pin-${i}`] = `${right}px`; right += table.widthOf(k) ?? 160; } }
    return out;
  };

  const grid = h("table", {
    class: "hm-table-grid", role: ctx.interactive ? "grid" : null,
    "aria-rowcount": () => { const n = table.total(); return n == null ? -1 : n + 1; },
    "aria-colcount": ctx.colCount,
    "aria-multiselectable": ctx.selectable ? "true" : null,
    "aria-label": props.label ?? null,
    style: pinVars,
    onKeyDown: (e: KeyboardEvent) => onGridKey(e, ctx),
    onFocusIn: (e: FocusEvent) => { const c = (e.target as Element).closest?.("[data-cell]"); if (c && c !== ctx.active) { ctx.active?.setAttribute("tabindex", "-1"); c.setAttribute("tabindex", "0"); ctx.active = c; } },
  },
  props.caption ? h("caption", { class: "hm-sr-only" }, props.caption) : null,
  h("colgroup", {},
    Array.from({ length: ctx.lead }, () => h("col", { class: "hm-table-col-lead" })),
    () => { const cols = table.visibleColumns(); return untrack(() => cols.map((c) => h("col", { "data-col": c.key, style: () => { const w = table.widthOf(c.key as string); return { width: w != null ? `${w}px` : table.hasWidths() ? "160px" : null }; } }))); },
    ctx.trail ? h("col", { class: "hm-table-col-trail" }) : null),
  h("thead", {}, HeaderRow(ctx)),
  h("tbody", {}, () => {
    const st = table.status();
    return untrack(() => {
      if (st === "loading") return Array.from({ length: props.skeletonRows ?? Math.min(table.size(), 5) }, () => h("tr", { class: "hm-table-skeleton", "aria-hidden": "true" },
        Array.from({ length: ctx.colCount() }, () => h("td", {}, h(Skeleton, { lines: 1 })))));
      if (st === "error") return h("tr", { class: "hm-table-state" }, h("td", { colspan: ctx.colCount }, ErrorState(ctx)));
      if (st === "empty") return h("tr", { class: "hm-table-state" }, h("td", { colspan: ctx.colCount }, EmptyState(ctx)));
      return [
        v ? h("tr", { class: "hm-table-spacer", "aria-hidden": "true" }, h("td", { colspan: ctx.colCount, style: () => ({ height: `${v.range().top}px` }) })) : null,
        each<R>({ each: shown, key: table.idOf, children: (item, index) => Row(ctx, item, index) }),
        v ? h("tr", { class: "hm-table-spacer", "aria-hidden": "true" }, h("td", { colspan: ctx.colCount, style: () => ({ height: `${v.range().bottom}px` }) })) : null,
      ];
    });
  }));

  return h("div", {
    class: ["hm-table-scroll", v && "hm-table-scroll--virtual"],
    style: v ? { height: `${props.height ?? 480}px`, "--hm-table-row-h": `${rowHeight}px` } : null,
    tabindex: v ? "-1" : null,
    "on:scroll|passive": v ? (e: Event) => v.onScroll((e.currentTarget ?? e.target) as Element) : null,
  }, grid);
}

function pinAttrs<R>(table: TableState<R>, col: TableColumn<R>, i: number): { class?: string; style?: Record<string, string> } {
  const p = table.pinOf(col.key as string);
  if (!p) return {};
  return { class: `hm-table-pin-${p === "left" ? "start" : "end"}`, style: p === "left" ? { insetInlineStart: `calc(var(--hm-table-lead, 0px) + var(--hm-pin-${i}, 0px))` } : { insetInlineEnd: `calc(var(--hm-table-trail, 0px) + var(--hm-pin-${i}, 0px))` } };
}

function HeaderRow<R>(ctx: Ctx<R>): Element {
  const { table } = ctx;
  const lead: Element[] = [];
  if (ctx.selectable) {
    const box = h(Checkbox, {
      class: "hm-table-check", "aria-label": t`Select all rows on this page`,
      value: live(() => table.pageSelection() === "all"), indeterminate: live(() => table.pageSelection() === "some"),
      onClick: () => table.selectPage(untrack(table.pageSelection) !== "all"),
    });
    lead.push(h("th", { class: "hm-table-lead hm-table-select", scope: "col", "data-cell": "", tabindex: "0" }, box));
  }
  if (ctx.expand) lead.push(h("th", { class: "hm-table-lead hm-table-expand", scope: "col", "data-cell": "", tabindex: lead.length ? "-1" : "0" }, h("span", { class: "hm-sr-only" }, t`Details`)));
  return h("tr", { class: "hm-table-head", "data-head": "" }, lead,
    () => { const cols = table.visibleColumns(); return untrack(() => cols.map((c, i) => HeaderCell(ctx, c, i, !lead.length && i === 0))); },
    ctx.trail ? h("th", { class: "hm-table-trail", scope: "col", "data-cell": "", tabindex: "-1" }, h("span", { class: "hm-sr-only" }, t`Actions`)) : null);
}

function HeaderCell<R>(ctx: Ctx<R>, col: TableColumn<R>, i: number, first: boolean): Element {
  const { table, props } = ctx;
  const key = col.key as string;
  const pin = pinAttrs(table, col, i);
  const label = col.headerRender ? col.headerRender() : col.label;
  const reorder = props.reorderable !== false;
  // a press that became a column drag must not sort when it is released over the sort button
  let dragged = false;
  const th = h("th", {
    scope: "col", "data-cell": "", "data-col": col.key, tabindex: first ? "0" : "-1",
    class: ["hm-table-th", `hm-align-${col.align}`, pin.class, col.headerClass, reorder && "is-movable"],
    style: pin.style,
    "aria-sort": col.sortable ? () => ariaSort(table, key) : null,
  },
  col.sortable
    ? h("button", { type: "button", class: "hm-table-sort", title: t`Sort (Shift: add to sort)`, onClick: (e: MouseEvent) => { if (dragged) dragged = false; else table.toggleSort(key, !!e.shiftKey); } },
      label, SortMark(table, key))
    : h("span", { class: "hm-table-thlabel" }, label),
  props.resizable !== false && col.resizable !== false ? ColumnResize(table, col) : null) as HTMLElement;
  if (reorder) {
    // drag a header onto another one to move the column there: the drag behavior (threshold, Escape cancels)
    let over: HTMLElement | null = null;
    const mark = (x: HTMLElement | null): void => { if (x === over) return; over?.classList.remove("is-drop"); over = x; x?.classList.add("is-drop"); };
    onCleanup(draggable(th, {
      ignore: ".hm-resize-handle",
      onStart: () => { dragged = true; th.classList.add("is-dragging"); },
      onMove: (p) => { const x = th.ownerDocument.elementFromPoint?.(p.clientX, p.clientY)?.closest<HTMLElement>("th[data-col]"); mark(x && x !== th && x.parentNode === th.parentNode ? x : null); },
      onEnd: (_p, cancelled) => {
        const to = over?.getAttribute("data-col");
        th.classList.remove("is-dragging"); mark(null);
        // the click that may follow the release comes right after; a release elsewhere sends none
        setTimeout(() => { dragged = false; }, 0);
        if (!cancelled && to) table.moveColumnTo(key, to);
      },
    }));
  }
  return th;
}

function ColumnResize<R>(table: TableState<R>, col: TableColumn<R>): unknown {
  const key = col.key as string;
  let el: HTMLElement | undefined;
  // drag / arrows (RTL mirrored, Shift ×5) / Home: the resize handle; a column without a set width starts from its drawn width
  return h(ResizeHandle, {
    class: "hm-table-resize", label: t`Resize ${col.label}`, ref: (x: HTMLElement) => { el = x; },
    value: () => untrack(() => table.widthOf(key)) ?? (el?.closest("th")?.getBoundingClientRect().width || 160),
    set: (w: number) => table.setWidth(key, w), min: col.minWidth, step: 10, bigStep: 50,
  });
}

function Row<R>(ctx: GridCtx<R>, item: Accessor<R>, index: Accessor<number>): unknown {
  const { table, props } = ctx;
  const expand = ctx.expand;
  const rid = untrack(() => table.idOf(item()));
  const sel = ctx.selectable ? computed(() => table.isSelected(rid)) : null;
  const open = expand ? computed(() => table.isExpanded(rid)) : null;
  const lead: Element[] = [];
  if (ctx.selectable) lead.push(h("td", { class: "hm-table-lead hm-table-select", "data-cell": "", tabindex: "-1" },
    SelectBox(ctx, item, sel)));
  if (expand) lead.push(h("td", { class: "hm-table-lead hm-table-expand", "data-cell": "", tabindex: "-1" },
    h(IconButton, { class: "hm-table-expander", size: "sm", icon: h(Chevron, {}), label: t`Show details`, title: false, "aria-expanded": () => String(open?.()), onClick: () => table.toggleExpand(item()) })));
  const tr = h("tr", {
    class: () => ["hm-table-row", sel?.() && "is-selected", open?.() && "is-expanded", props.rowClass?.(item()), props.onRowClick && "is-clickable"],
    "data-row": "", "aria-selected": sel ? () => String(sel()) : null,
    "aria-rowindex": () => index() + ctx.offset() + 2,
    onClick: (e: MouseEvent) => { if ((e.target as Element).closest?.(INTERACTIVE)) return; rowActivate(ctx, item(), e); },
  }, lead,
  () => { const cols = table.visibleColumns(); return untrack(() => cols.map((c, i) => Cell(ctx, c, i, item, rid))); },
  ctx.actions ? h("td", { class: "hm-table-trail hm-table-actions", "data-cell": "", tabindex: "-1" }, RowActions(ctx, ctx.actions, item)) : null);
  ctx.rowOf.set(tr, item);
  if (!expand) return tr;
  return [tr, () => (open?.() ? untrack(() => h("tr", { class: "hm-table-expansion" }, h("td", { colspan: ctx.colCount }, expand(item())))) : null)];
}

/** The selection checkbox of a row or a card (Shift + click selects the range). */
function SelectBox<R>(ctx: Ctx<R>, item: Accessor<R>, sel: Accessor<boolean> | null): unknown {
  return h(Checkbox, { class: "hm-table-check", "aria-label": t`Select row`, value: live(() => !!sel?.()), onClick: (e: MouseEvent) => ctx.table.toggle(item(), { range: !!e.shiftKey }) });
}

function rowActivate<R>(ctx: Ctx<R>, row: R, e: Event): void {
  if (ctx.props.onRowClick) ctx.props.onRowClick(row, e);
  else if (ctx.expand) ctx.table.toggleExpand(row);
}

function Cell<R>(ctx: Ctx<R>, col: TableColumn<R>, i: number, item: Accessor<R>, rid: unknown): Element {
  const { table } = ctx;
  const key = col.key as string;
  const pin = pinAttrs(table, col, i);
  const render = col.render;
  const display = render ? () => render.call(col, item()) : () => table.format(item(), col);
  let content: unknown = display;
  if (col.editable) {
    const on = computed(() => { const e = table.editing(); return !!e && e.id === rid && e.key === col.key; });
    content = () => (on() ? untrack(() => Editor(ctx, col, item)) : display);
  }
  return h("td", {
    class: ["hm-table-cell", `hm-align-${col.align}`, pin.class, col.cellClass, col.editable && "is-editable"],
    style: pin.style, "data-cell": "", "data-col": col.key, tabindex: "-1",
    "data-editable": col.editable ? "" : null,
    onDblClick: col.editable ? () => table.startEdit(item(), key) : null,
  }, content);
}

function Editor<R>(ctx: Ctx<R>, col: TableColumn<R>, item: Accessor<R>): Element {
  return CellEditor(ctx.table, col, item(), ctx.id);
}

function RowActions<R>(ctx: Ctx<R>, acts: readonly RowAction<R>[], item: Accessor<R>): Element {
  const { props } = ctx;
  const args = (): [R] => [item()];
  const inline = props.rowActionsInline ?? acts.length <= 2;
  if (inline) return h("span", { class: "hm-table-rowactions" }, acts.map((a) => h<ActionButtonProps<[R]>>(ActionButton, { action: a, args, class: "hm-table-action" })));
  return Menu({ class: "hm-table-kebab", label: t`Row actions`, icon: moreVertical, role: "menu",
    body: (close) => acts.map((a) => h<ActionButtonProps<[R]>>(ActionButton, { action: a, args, variant: "ghost", role: "menuitem", class: "hm-table-action", onClick: close })) });
}

function EmptyState<R>(ctx: Ctx<R>): unknown {
  const { table, props } = ctx;
  const filtered = table.activeFilters().length > 0 || !!table.search();
  if (filtered) return h(Empty, { class: "hm-table-empty", size: "sm", title: t`No matching rows.`, action: h(Button, { onClick: table.clearFilters }, t`Clear filters`) });
  const e = props.empty;
  if (e != null) return h(Empty, { class: "hm-table-empty", size: "sm", title: false }, typeof e === "function" ? (e as () => unknown)() : e);
  return h(Empty, { class: "hm-table-empty", size: "sm", title: t`No data yet.` });
}

function ErrorState<R>(ctx: Ctx<R>): unknown {
  const { table } = ctx;
  return h(ErrorBox, { class: "hm-table-error", error: () => table.error(), retry: table.mode === "server" ? () => table.refetch() : undefined });
}

// ------------------------------------------------------------------ keyboard
function onGridKey<R>(e: KeyboardEvent, ctx: GridCtx<R>): void {
  const target = e.target as HTMLElement;
  const cell = target.closest?.("[data-cell]") as HTMLElement | null;
  if (!cell) return;
  const onCell = target === cell;
  const isToggle = target.tagName === "BUTTON" || (target.tagName === "INPUT" && (target as HTMLInputElement).type === "checkbox");
  if (!onCell && !isToggle) return; // text inputs keep their keys
  const tr = cell.parentNode as Element;
  const grid = tr.closest("table") as Element;
  const rows = [...grid.querySelectorAll("tr[data-head], tr[data-row]")];
  const cellsOf = (r: Element): HTMLElement[] => ([...r.children] as HTMLElement[]).filter((c) => c.hasAttribute("data-cell"));
  const ri = rows.indexOf(tr), ci = cellsOf(tr).indexOf(cell);
  const vt = ctx.virtual;
  const go = (r: number, c: number): void => {
    let row = rows[r];
    if (!row && vt && r >= rows.length) { vt.scrollTop.set(vt.scrollTop.peek() + vt.rowHeight * (r - rows.length + 1)); const again = grid.querySelectorAll("tr[data-head], tr[data-row]"); row = again[again.length - 1]; }
    if (!row && vt && r < 0) { vt.scrollTop.set(Math.max(0, vt.scrollTop.peek() - vt.rowHeight)); row = grid.querySelectorAll("tr[data-row]")[0]; }
    if (!row) return;
    const cs = cellsOf(row);
    const next = cs[clamp(c, 0, cs.length - 1)];
    if (!next) return;
    e.preventDefault();
    ctx.active?.setAttribute("tabindex", "-1");
    next.setAttribute("tabindex", "0");
    ctx.active = next;
    next.focus();
    next.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };
  // arrows, Home / End, Page Up / Down: the list-nav behavior (RTL mirrored); a virtual grid scrolls past its window
  const count = cellsOf(tr).length, ctrl = e.ctrlKey || e.metaKey, edge = e.key === "Home" || e.key === "End";
  if (e.key === "ArrowLeft" || e.key === "ArrowRight" || (edge && !ctrl)) {
    const c = moveCursor({ key: e.key, index: ci, count, columns: count, rtl: isRtl(grid) });
    if (c != null) go(ri, c);
    return;
  }
  const r = vt && e.key === "ArrowDown" && ri === rows.length - 1 ? rows.length : vt && e.key === "ArrowUp" && ri === 0 ? -1 : moveCursor({ key: e.key, index: ri, count: rows.length, ctrl });
  if (r != null) return go(r, edge ? (e.key === "Home" ? 0 : count - 1) : ci);
  if (!onCell || !tr.hasAttribute("data-row")) return;
  const item = ctx.rowOf.get(tr);
  if (!item) return;
  if (e.key === " " && ctx.selectable) { e.preventDefault(); ctx.table.toggle(item(), { range: !!e.shiftKey }); }
  else if ((e.key === "Enter" || e.key === "F2") && cell.hasAttribute("data-editable")) { e.preventDefault(); ctx.table.startEdit(item(), cell.getAttribute("data-col") as string); }
  else if (e.key === "Enter") { e.preventDefault(); rowActivate(ctx, item(), e); }
}

// ------------------------------------------------------------------ cards
function Cards<R>(ctx: Ctx<R>): Element {
  const { table, props } = ctx;
  return h("div", { class: "hm-table-cards", role: "list", "aria-label": props.label ?? props.caption ?? null }, () => {
    const st = table.status();
    return untrack(() => {
      if (st === "loading") return Array.from({ length: 3 }, () => h("div", { class: "hm-table-card hm-table-skeleton", "aria-hidden": "true" }, h(Skeleton, { lines: 2 })));
      if (st === "error") return ErrorState(ctx);
      if (st === "empty") return EmptyState(ctx);
      return each<R>({ each: table.rows, key: table.idOf, children: (item) => Card(ctx, item) });
    });
  });
}

function Card<R>(ctx: Ctx<R>, item: Accessor<R>): Element {
  const { table, props } = ctx;
  const expand = ctx.expand;
  const rid = untrack(() => table.idOf(item()));
  const sel = ctx.selectable ? computed(() => table.isSelected(rid)) : null;
  const open = expand ? computed(() => table.isExpanded(rid)) : null;
  return h("div", {
    class: () => ["hm-table-card", sel?.() && "is-selected", props.rowClass?.(item())], role: "listitem", "data-row": "",
    onClick: (e: MouseEvent) => { if ((e.target as Element).closest?.(INTERACTIVE)) return; rowActivate(ctx, item(), e); },
  },
  ctx.selectable || ctx.actions ? h("div", { class: "hm-table-card-head" },
    ctx.selectable ? SelectBox(ctx, item, sel) : null,
    ctx.actions ? RowActions(ctx, ctx.actions, item) : null) : null,
  h("dl", { class: "hm-table-card-fields" }, () => {
    const cols = table.visibleColumns();
    return untrack(() => cols.map((c) => { const render = c.render; return h("div", { class: "hm-table-card-field", "data-col": c.key },
      h("dt", {}, c.label), h("dd", { class: `hm-align-${c.align}` }, render ? () => render.call(c, item()) : () => table.format(item(), c))); }));
  }),
  expand ? [
    h(Button, { variant: "link", class: "hm-table-card-more", "aria-expanded": () => String(open?.()), onClick: () => table.toggleExpand(item()) }, () => (open?.() ? t`Hide details` : t`Show details`)),
    () => (open?.() ? untrack(() => h("div", { class: "hm-table-card-expansion" }, expand(item()))) : null),
  ] : null);
}

// ------------------------------------------------------------------ footer
function Footer<R>(ctx: Ctx<R>): Element {
  const { table, props } = ctx;
  const sizes = [...new Set([...(props.pageSizes ?? [10, 25, 50, 100]), untrack(table.size)])].sort((a, b) => a - b);
  const range = (): string => {
    const n = table.total();
    if (table.isVirtual()) return t`${n} rows`;
    if (n == null) return t`Page ${table.page()}`;
    if (!n) return t`0 rows`;
    const from = (table.page() - 1) * table.size() + 1, to = Math.min(n, from + table.rows().length - 1);
    return t`${from}–${to} of ${n}`;
  };
  return h("div", { class: "hm-table-footer" },
    h(LiveStatus, { class: "hm-table-range", text: range }),
    // rows per page, Previous / Next and "Page 2 of 7"; in cursor mode (or with an unknown total) only the two buttons
    () => (table.isVirtual() ? null : untrack(() => h(Pagination, {
      variant: "simple", class: "hm-table-pager", info: false,
      page: () => table.page(), pages: () => (table.cursorMode ? null : table.pageCount()),
      hasPrev: () => table.hasPrev(), hasNext: () => table.hasNext(), onPrev: table.prev, onNext: table.next,
      size: () => table.size(), sizes, onSize: (n: number) => table.setSize(n),
    }))));
}
