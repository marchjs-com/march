// <Table>: renders createTable() state as an accessible grid (or cards on small screens).
import { signal, computed, effect, untrack, onCleanup } from "../core/reactive.ts";
import { h } from "../dom/h.js";
import { For } from "../dom/flow.js";
import { t } from "../core/i18n.ts";
import { createTable } from "./state.js";
import { createVirtual } from "./virtual.js";

const val = (v) => (typeof v === "function" ? v() : v);
const INTERACTIVE = "button,input,select,textarea,a,label,summary,details,[data-no-row-click]";
const labelOf = (a) => (typeof a.label === "function" ? a.label() : a.label);
let uid = 0;

/** Run an action object (or `{ label, run }`); errors are already reported by the action, so they are swallowed here. */
function runAction(a, args) { return Promise.resolve().then(() => a.run(...args)).catch(() => undefined); }

function ActionButton(a, args, onRun, extra = {}) {
  return h("button", {
    type: "button", ...extra,
    class: ["hm-btn", "hm-table-action", a.opts?.danger && "hm-btn--danger", extra.class],
    hidden: () => (a.visible ? !a.visible(...args()) : false),
    disabled: () => !!a.disabled?.(...args()),
    "aria-busy": () => (a.busy?.() ? "true" : null),
    onClick: (e) => { e.currentTarget?.closest?.("details")?.removeAttribute("open"); onRun(); },
  }, () => labelOf(a));
}

function useLayout(props) {
  const forced = props.layout;
  if (forced === "cards" || forced === "table") return () => forced;
  const mm = globalThis.matchMedia?.(`(max-width: ${(props.cardBreakpoint ?? 640) - 0.02}px)`);
  const small = signal(!!mm?.matches);
  if (mm?.addEventListener) {
    const on = (e) => small.set(!!e.matches);
    mm.addEventListener("change", on);
    onCleanup(() => mm.removeEventListener("change", on));
  }
  return () => (small() ? "cards" : "table");
}

/** Close open menus of this table when clicking elsewhere. */
function closeMenusOnOutsideClick(root) {
  const doc = globalThis.document;
  const on = (e) => { for (const d of root.querySelectorAll("details[open]")) if (!d.contains(e.target)) d.removeAttribute("open"); };
  doc.addEventListener("click", on);
  onCleanup(() => doc.removeEventListener("click", on));
}

/**
 * Data table. Accepts every createTable() option (or a ready `table`), plus: selectable, bulkActions, rowActions,
 * rowActionsInline, onRowClick, expand, empty, caption, layout ("auto"|"table"|"cards"), cardBreakpoint, height,
 * rowHeight, overscan, pageSizes, toolbar, exportable, searchDelay, rowClass, resizable, reorderable.
 */
export function Table(props) {
  const table = props.table ?? createTable(props);
  const layout = useLayout(props);
  const ctx = {
    id: `hm-table-${++uid}`, table, props,
    selectable: !!props.selectable,
    expand: typeof props.expand === "function" ? props.expand : null,
    actions: props.rowActions ?? null,
    editable: () => table.visibleColumns().some((c) => c.editable),
  };
  ctx.interactive = ctx.selectable || !!ctx.actions || !!ctx.expand || !!props.onRowClick || untrack(ctx.editable);
  ctx.lead = (ctx.selectable ? 1 : 0) + (ctx.expand ? 1 : 0);
  ctx.trail = ctx.actions ? 1 : 0;
  ctx.colCount = () => table.visibleColumns().length + ctx.lead + ctx.trail;

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
  closeMenusOnOutsideClick(root);
  return root;
}

// ------------------------------------------------------------------ toolbar
function Menu(cls, label, ...body) {
  return h("details", { class: ["hm-table-menu", cls] },
    h("summary", { class: "hm-btn hm-table-menu-btn" }, label),
    h("div", { class: "hm-table-menu-panel" }, ...body));
}

function Toolbar(ctx) {
  const { table, props } = ctx;
  let timer = null;
  onCleanup(() => clearTimeout(timer));
  const delay = props.searchDelay ?? (table.mode === "server" ? 300 : 120);
  const filterCols = () => table.allColumns().filter((c) => c.filter);
  return h("div", { class: "hm-table-toolbar" },
    props.search !== false ? h("input", {
      type: "search", class: "hm-table-search", placeholder: t`Search…`, "aria-label": t`Search`,
      "aria-controls": ctx.id,
      value: () => table.search(),
      onInput: (e) => { const el = e.target; clearTimeout(timer); if (delay) timer = setTimeout(() => table.setSearch(el.value), delay); else table.setSearch(el.value); },
    }) : null,
    () => (filterCols().length ? untrack(() => Menu("hm-table-filters", t`Filters`, ...filterCols().map((c) => FilterControl(table, c)))) : null),
    Menu("hm-table-columns", t`Columns`, ColumnsPanel(ctx)),
    props.storageKey ? Menu("hm-table-views", () => table.activeView() ?? t`Views`, ViewsPanel(ctx)) : null,
    props.exportable !== false ? Menu("hm-table-export", t`Export`,
      h("button", { type: "button", class: "hm-btn", onClick: () => table.exportCSV() }, t`CSV`),
      h("button", { type: "button", class: "hm-btn", onClick: () => table.exportJSON() }, t`JSON`)) : null,
    props.toolbarEnd ?? null);
}

/** One control per filter type. */
export function FilterControl(table, col) {
  const cur = () => table.filters()[col.key];
  const set = (v) => table.setFilter(col.key, v);
  const field = (label, input) => h("label", { class: "hm-table-filter-field" }, h("span", {}, label), input);
  const pair = (a, b, type) => {
    const part = (k, label) => field(label, h("input", {
      type, class: "hm-table-input", value: () => cur()?.[k] ?? "",
      onInput: (e) => set({ ...(untrack(cur) ?? {}), [k]: e.target.value === "" ? null : type === "number" ? Number(e.target.value) : e.target.value }),
    }));
    return [part(a, a === "min" ? t`Min` : t`From`), part(b, b === "max" ? t`Max` : t`To`)];
  };
  let body;
  switch (col.filter) {
    case "range": body = pair("min", "max", "number"); break;
    case "dateRange": body = pair("from", "to", "date"); break;
    case "bool": {
      const sel = h("select", { class: "hm-table-input", onChange: (e) => set(e.target.value === "" ? null : e.target.value === "true") },
        h("option", { value: "" }, t`All`), h("option", { value: "true" }, t`Yes`), h("option", { value: "false" }, t`No`));
      effect(() => { const v = cur(); sel.value = v == null ? "" : String(v); });
      body = sel;
      break;
    }
    case "select": {
      body = () => {
        const opts = table.filterOptions(col.key);
        return untrack(() => (col.filterMultiple === false
          ? (() => {
            const sel = h("select", { class: "hm-table-input", "aria-label": col.label, onChange: (e) => set(e.target.value === "" ? null : [opts[Number(e.target.value)].value]) },
              h("option", { value: "" }, t`All`), opts.map((o, i) => h("option", { value: String(i) }, o.label)));
            effect(() => { const v = [].concat(cur() ?? [])[0]; const i = opts.findIndex((o) => o.value === v); sel.value = i < 0 ? "" : String(i); });
            return sel;
          })()
          : h("div", { class: "hm-table-options", role: "group", "aria-label": col.label }, opts.map((o) => h("label", { class: "hm-table-option" },
            h("input", {
              type: "checkbox", checked: () => [].concat(cur() ?? []).includes(o.value),
              onChange: (e) => { const list = [].concat(untrack(cur) ?? []).filter((x) => x !== o.value); set(e.target.checked ? [...list, o.value] : list); },
            }), o.label)))));
      };
      break;
    }
    default:
      body = h("input", { type: "search", class: "hm-table-input", "aria-label": col.label, value: () => cur() ?? "", onInput: (e) => set(e.target.value) });
  }
  return h("fieldset", { class: ["hm-table-filter", `hm-table-filter--${col.filter}`], "data-filter": col.key },
    h("legend", {}, col.label), body);
}

function ColumnsPanel(ctx) {
  const { table } = ctx;
  return h("ul", { class: "hm-table-colmenu", role: "list" }, h(For, { each: table.columns, key: "key" }, (col) => {
    const c = col();
    return h("li", { class: "hm-table-colitem", "data-col": c.key },
      h("label", {}, h("input", { type: "checkbox", checked: () => !table.isHidden(c.key), onChange: () => table.toggleColumn(c.key) }), c.label),
      h("button", { type: "button", class: "hm-table-icon", "aria-label": t`Move ${c.label} up`, onClick: () => table.moveColumn(c.key, -1) }, "↑"),
      h("button", { type: "button", class: "hm-table-icon", "aria-label": t`Move ${c.label} down`, onClick: () => table.moveColumn(c.key, 1) }, "↓"),
      (() => {
        const sel = h("select", { class: "hm-table-input hm-table-pin", "aria-label": t`Pin ${c.label}`, onChange: (e) => table.pin(c.key, e.target.value || null) },
          h("option", { value: "" }, t`Not pinned`), h("option", { value: "left" }, t`Pin start`), h("option", { value: "right" }, t`Pin end`));
        effect(() => { sel.value = table.pinOf(c.key) ?? ""; });
        return sel;
      })());
  }), h("li", {}, h("button", { type: "button", class: "hm-btn", onClick: table.resetColumns }, t`Reset columns`)));
}

function ViewsPanel(ctx) {
  const { table } = ctx;
  const name = h("input", { type: "text", class: "hm-table-input", placeholder: t`View name`, "aria-label": t`View name` });
  const save = () => { table.saveView(name.value); name.value = ""; };
  return [
    h("ul", { class: "hm-table-viewlist", role: "list" }, h(For, { each: table.views, key: "name", fallback: () => h("li", { class: "hm-table-muted" }, t`No saved views`) }, (v) => {
      const n = v().name;
      return h("li", { class: () => ["hm-table-view", table.activeView() === n && "is-active"] },
        h("button", { type: "button", class: "hm-table-linkbtn", "aria-pressed": () => String(table.activeView() === n), onClick: () => table.applyView(n) }, n),
        h("button", { type: "button", class: "hm-table-icon", "aria-label": t`Make ${n} the default view`, "aria-pressed": () => String(table.defaultView() === n), onClick: () => table.setDefaultView(untrack(table.defaultView) === n ? null : n) }, "★"),
        h("button", { type: "button", class: "hm-table-icon", "aria-label": t`Delete view ${n}`, onClick: () => table.deleteView(n) }, "×"));
    })),
    h("div", { class: "hm-table-viewsave" }, name, h("button", { type: "button", class: "hm-btn", onClick: save }, t`Save view`)),
  ];
}

function Chips(ctx) {
  const { table } = ctx;
  const any = computed(() => table.activeFilters().length > 0 || !!table.search());
  return () => (any() ? untrack(() => h("div", { class: "hm-table-chips", role: "group", "aria-label": t`Active filters` },
    () => table.search() ? untrack(() => Chip(t`Search`, `“${table.search()}”`, () => table.setSearch(""))) : null,
    h(For, { each: table.activeFilters, key: "key" }, (f) => Chip(f().label, () => f().text, () => table.clearFilter(f().key))),
    h("button", { type: "button", class: "hm-table-linkbtn hm-table-clear", onClick: table.clearFilters }, t`Clear all`))) : null);
}
function Chip(label, text, clear) {
  return h("span", { class: "hm-table-chip" }, h("span", {}, label, ": ", text),
    h("button", { type: "button", class: "hm-table-chip-x", "aria-label": t`Remove filter ${label}`, onClick: clear }, "×"));
}

function BulkBar(ctx) {
  const { table, props } = ctx;
  const show = computed(() => table.selectedCount() > 0);
  const actions = props.bulkActions ?? [];
  return () => (show() ? untrack(() => h("div", { class: "hm-table-bulk", role: "region", "aria-label": t`Bulk actions` },
    h("span", { class: "hm-table-bulk-count", role: "status", "aria-live": "polite" }, () => (table.allMatching() && table.mode === "server" ? t`All ${table.total() ?? ""} selected` : t`${table.selectedCount()} selected`)),
    () => (!table.allMatching() && table.pageSelection() === "all" && (table.total() ?? 0) > table.selectedCount()
      ? untrack(() => h("button", { type: "button", class: "hm-table-linkbtn hm-table-selectall", onClick: table.selectAllMatching }, t`Select all ${table.total()} matching`)) : null),
    actions.map((a) => ActionButton(a, () => [table.selectedRows()], () => table.runBulk(a))),
    h("button", { type: "button", class: "hm-table-linkbtn", onClick: table.clearSelection }, t`Clear selection`))) : null);
}

// ------------------------------------------------------------------ grid
function Grid(ctx, virtual) {
  const { table, props } = ctx;
  const rowHeight = props.rowHeight ?? 40;
  const v = virtual ? createVirtual({ count: () => table.rows().length, rowHeight, height: props.height ?? 480, overscan: props.overscan ?? 6 }) : null;
  ctx.virtual = v;
  ctx.offset = v ? () => v.range().start : () => (table.paged && !table.isVirtual() && table.mode === "client" ? (table.page() - 1) * table.size() : 0);
  ctx.rowOf = new WeakMap();
  const shown = v ? computed(() => { const r = v.range(); return table.rows().slice(r.start, r.end); }) : table.rows;

  const pinVars = () => {
    const cols = table.visibleColumns(), out = { "--hm-table-lead": ctx.lead ? `calc(${ctx.lead} * var(--hm-table-lead-w))` : "0px", "--hm-table-trail": ctx.trail ? "3rem" : "0px" };
    let left = 0;
    cols.forEach((c, i) => { out[`--hm-pin-${i}`] = null; if (table.pinOf(c.key) === "left") { out[`--hm-pin-${i}`] = `${left}px`; left += table.widthOf(c.key) ?? 160; } });
    let right = 0;
    for (let i = cols.length - 1; i >= 0; i--) if (table.pinOf(cols[i].key) === "right") { out[`--hm-pin-${i}`] = `${right}px`; right += table.widthOf(cols[i].key) ?? 160; }
    return out;
  };

  const grid = h("table", {
    class: "hm-table-grid", role: ctx.interactive ? "grid" : null,
    "aria-rowcount": () => (table.total() == null ? -1 : table.total() + 1),
    "aria-colcount": ctx.colCount,
    "aria-multiselectable": ctx.selectable ? "true" : null,
    "aria-label": props.label ?? null,
    style: pinVars,
    onKeyDown: (e) => onGridKey(e, ctx),
    onFocusIn: (e) => { const c = e.target.closest?.("[data-cell]"); if (c && c !== ctx.active) { ctx.active?.setAttribute("tabindex", "-1"); c.setAttribute("tabindex", "0"); ctx.active = c; } },
  },
  props.caption ? h("caption", { class: "hm-sr-only" }, props.caption) : null,
  h("colgroup", {},
    Array.from({ length: ctx.lead }, () => h("col", { class: "hm-table-col-lead" })),
    () => { const cols = table.visibleColumns(); return untrack(() => cols.map((c) => h("col", { "data-col": c.key, style: () => { const w = table.widthOf(c.key); return { width: w != null ? `${w}px` : table.hasWidths() ? "160px" : null }; } }))); },
    ctx.trail ? h("col", { class: "hm-table-col-trail" }) : null),
  h("thead", {}, HeaderRow(ctx)),
  h("tbody", {}, () => {
    const st = table.status();
    return untrack(() => {
      if (st === "loading") return Array.from({ length: props.skeletonRows ?? Math.min(table.size(), 5) }, () => h("tr", { class: "hm-table-skeleton", "aria-hidden": "true" },
        Array.from({ length: ctx.colCount() }, () => h("td", {}, h("span", { class: "hm-table-skel" })))));
      if (st === "error") return h("tr", { class: "hm-table-state" }, h("td", { colspan: ctx.colCount }, ErrorState(ctx)));
      if (st === "empty") return h("tr", { class: "hm-table-state" }, h("td", { colspan: ctx.colCount }, EmptyState(ctx)));
      return [
        v ? h("tr", { class: "hm-table-spacer", "aria-hidden": "true" }, h("td", { colspan: ctx.colCount, style: () => ({ height: `${v.range().top}px` }) })) : null,
        h(For, { each: shown, key: table.idOf }, (item, index) => Row(ctx, item, index)),
        v ? h("tr", { class: "hm-table-spacer", "aria-hidden": "true" }, h("td", { colspan: ctx.colCount, style: () => ({ height: `${v.range().bottom}px` }) })) : null,
      ];
    });
  }));

  return h("div", {
    class: ["hm-table-scroll", v && "hm-table-scroll--virtual"],
    style: v ? { height: `${props.height ?? 480}px`, "--hm-table-row-h": `${rowHeight}px` } : null,
    tabindex: v ? "-1" : null,
    "on:scroll|passive": v ? (e) => v.onScroll(e.currentTarget ?? e.target) : null,
  }, grid);
}

function pinAttrs(table, col, i) {
  const p = table.pinOf(col.key);
  if (!p) return {};
  return { class: `hm-table-pin-${p === "left" ? "start" : "end"}`, style: p === "left" ? { insetInlineStart: `calc(var(--hm-table-lead, 0px) + var(--hm-pin-${i}, 0px))` } : { insetInlineEnd: `calc(var(--hm-table-trail, 0px) + var(--hm-pin-${i}, 0px))` } };
}

function HeaderRow(ctx) {
  const { table } = ctx;
  const lead = [];
  if (ctx.selectable) {
    const box = h("input", {
      type: "checkbox", class: "hm-table-check", "aria-label": t`Select all rows on this page`,
      checked: () => table.pageSelection() === "all", indeterminate: () => table.pageSelection() === "some",
      onClick: () => table.selectPage(untrack(table.pageSelection) !== "all"),
    });
    lead.push(h("th", { class: "hm-table-lead hm-table-select", scope: "col", "data-cell": "", tabindex: "0" }, box));
  }
  if (ctx.expand) lead.push(h("th", { class: "hm-table-lead hm-table-expand", scope: "col", "data-cell": "", tabindex: lead.length ? "-1" : "0" }, h("span", { class: "hm-sr-only" }, t`Details`)));
  return h("tr", { class: "hm-table-head", "data-head": "" }, lead,
    () => { const cols = table.visibleColumns(); return untrack(() => cols.map((c, i) => HeaderCell(ctx, c, i, !lead.length && i === 0))); },
    ctx.trail ? h("th", { class: "hm-table-trail", scope: "col", "data-cell": "", tabindex: "-1" }, h("span", { class: "hm-sr-only" }, t`Actions`)) : null);
}

function HeaderCell(ctx, col, i, first) {
  const { table, props } = ctx;
  const pin = pinAttrs(table, col, i);
  const dir = () => table.sortDir(col.key);
  const multi = () => table.sort().length > 1;
  const label = col.headerRender ? col.headerRender() : col.label;
  const reorder = props.reorderable !== false;
  return h("th", {
    scope: "col", "data-cell": "", "data-col": col.key, tabindex: first ? "0" : "-1",
    class: ["hm-table-th", `hm-align-${col.align}`, pin.class, col.headerClass],
    style: pin.style,
    "aria-sort": col.sortable ? () => (dir() === "asc" ? "ascending" : dir() === "desc" ? "descending" : "none") : null,
    draggable: reorder ? "true" : null,
    "on:dragstart": reorder ? (e) => { e.dataTransfer?.setData("text/x-hm-col", col.key); e.dataTransfer && (e.dataTransfer.effectAllowed = "move"); } : null,
    "on:dragover": reorder ? (e) => { if (e.dataTransfer?.types?.includes?.("text/x-hm-col")) e.preventDefault(); } : null,
    "on:drop": reorder ? (e) => { const k = e.dataTransfer?.getData("text/x-hm-col"); if (k && k !== col.key) { e.preventDefault(); table.moveColumnTo(k, col.key); } } : null,
  },
  col.sortable
    ? h("button", { type: "button", class: "hm-table-sort", title: t`Sort (Shift: add to sort)`, onClick: (e) => table.toggleSort(col.key, !!e.shiftKey) },
      label,
      h("span", { class: "hm-table-sort-icon", "aria-hidden": "true" }, () => (dir() === "asc" ? "▲" : dir() === "desc" ? "▼" : "")),
      () => (multi() && dir() ? untrack(() => h("span", { class: "hm-table-sort-n", "aria-hidden": "true" }, () => String(table.sortIndex(col.key) + 1))) : null))
    : h("span", { class: "hm-table-thlabel" }, label),
  props.resizable !== false && col.resizable !== false ? ResizeHandle(table, col) : null);
}

function ResizeHandle(table, col) {
  const cur = () => table.widthOf(col.key);
  const startW = (el) => untrack(cur) ?? (el.closest("th")?.getBoundingClientRect().width || 160);
  const rtl = (el) => el.closest?.("[dir=rtl]") != null;
  return h("span", {
    role: "separator", class: "hm-table-resize", tabindex: "0", "aria-orientation": "vertical",
    "aria-label": t`Resize ${col.label}`, "aria-valuemin": col.minWidth, "aria-valuenow": () => cur() ?? null,
    onClick: (e) => e.stopPropagation(),
    onKeyDown: (e) => {
      const step = e.shiftKey ? 50 : 10, sign = rtl(e.target) ? -1 : 1;
      if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
        e.preventDefault(); e.stopPropagation();
        table.setWidth(col.key, startW(e.target) + (e.key === "ArrowRight" ? step : -step) * sign);
      } else if (e.key === "Home") { e.preventDefault(); e.stopPropagation(); table.setWidth(col.key, col.minWidth); }
    },
    onPointerDown: (e) => {
      e.preventDefault(); e.stopPropagation();
      const x0 = e.clientX, w0 = startW(e.target), sign = rtl(e.target) ? -1 : 1, win = globalThis;
      const move = (m) => table.setWidth(col.key, w0 + (m.clientX - x0) * sign);
      const up = () => { win.removeEventListener("pointermove", move); win.removeEventListener("pointerup", up); };
      win.addEventListener("pointermove", move);
      win.addEventListener("pointerup", up);
    },
  });
}

function Row(ctx, item, index) {
  const { table, props } = ctx;
  const rid = untrack(() => table.idOf(item()));
  const sel = ctx.selectable ? computed(() => table.isSelected(rid)) : null;
  const open = ctx.expand ? computed(() => table.isExpanded(rid)) : null;
  const lead = [];
  if (ctx.selectable) lead.push(h("td", { class: "hm-table-lead hm-table-select", "data-cell": "", tabindex: "-1" },
    h("input", { type: "checkbox", class: "hm-table-check", "aria-label": t`Select row`, checked: sel, onClick: (e) => table.toggle(item(), { range: !!e.shiftKey }) })));
  if (ctx.expand) lead.push(h("td", { class: "hm-table-lead hm-table-expand", "data-cell": "", tabindex: "-1" },
    h("button", { type: "button", class: "hm-table-icon hm-table-expander", "aria-expanded": () => String(open()), "aria-label": t`Show details`, onClick: () => table.toggleExpand(item()) }, "▸")));
  const tr = h("tr", {
    class: () => ["hm-table-row", sel?.() && "is-selected", open?.() && "is-expanded", props.rowClass?.(item()), props.onRowClick && "is-clickable"],
    "data-row": "", "aria-selected": sel ? () => String(sel()) : null,
    "aria-rowindex": () => index() + ctx.offset() + 2,
    onClick: (e) => { if (e.target.closest?.(INTERACTIVE)) return; rowActivate(ctx, item(), e); },
  }, lead,
  () => { const cols = table.visibleColumns(); return untrack(() => cols.map((c, i) => Cell(ctx, c, i, item, rid))); },
  ctx.actions ? h("td", { class: "hm-table-trail hm-table-actions", "data-cell": "", tabindex: "-1" }, RowActions(ctx, item)) : null);
  ctx.rowOf.set(tr, item);
  if (!ctx.expand) return tr;
  return [tr, () => (open() ? untrack(() => h("tr", { class: "hm-table-expansion" }, h("td", { colspan: ctx.colCount }, ctx.expand(item())))) : null)];
}

function rowActivate(ctx, row, e) {
  if (ctx.props.onRowClick) ctx.props.onRowClick(row, e);
  else if (ctx.expand) ctx.table.toggleExpand(row);
}

function Cell(ctx, col, i, item, rid) {
  const { table } = ctx;
  const pin = pinAttrs(table, col, i);
  const display = col.render ? () => col.render(item()) : () => table.format(item(), col);
  let content = display;
  if (col.editable) {
    const on = computed(() => { const e = table.editing(); return !!e && e.id === rid && e.key === col.key; });
    content = () => (on() ? untrack(() => Editor(ctx, col, item)) : display);
  }
  return h("td", {
    class: ["hm-table-cell", `hm-align-${col.align}`, pin.class, col.cellClass, col.editable && "is-editable"],
    style: pin.style, "data-cell": "", "data-col": col.key, tabindex: "-1",
    "data-editable": col.editable ? "" : null,
    onDblClick: col.editable ? () => table.startEdit(item(), col.key) : null,
  }, content);
}

function inputTypeOf(col) {
  return { number: "number", int: "number", money: "number", percent: "number", date: "date", email: "email", url: "url", bool: "checkbox", color: "color", time: "time" }[col.type] ?? "text";
}

function Editor(ctx, col, item) {
  const { table } = ctx;
  const errId = `${ctx.id}-err-${String(table.idOf(item())).replace(/[^\w-]/g, "_")}-${col.key}`;
  const draft = untrack(table.editing)?.draft;
  const type = inputTypeOf(col);
  const keys = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") { e.preventDefault(); table.commitEdit(); }
    else if (e.key === "Escape") { e.preventDefault(); table.cancelEdit(); }
  };
  const common = {
    class: "hm-table-input hm-table-editor", "aria-label": t`Edit ${col.label}`,
    "aria-invalid": () => (table.editing()?.error ? "true" : null), "aria-describedby": errId,
    disabled: () => !!table.editing()?.saving, onKeyDown: keys,
    ref: (el) => setTimeout(() => el.isConnected && el.focus?.(), 0),
  };
  let input;
  if (col.options) {
    const opts = table.filterOptions(col.key);
    input = h("select", { ...common, onChange: (e) => table.setDraft(opts[Number(e.target.value)]?.value) }, opts.map((o, i) => h("option", { value: String(i) }, o.label)));
    input.value = String(Math.max(0, opts.findIndex((o) => o.value === draft)));
  } else if (type === "checkbox") {
    input = h("input", { ...common, type, checked: !!draft, onChange: (e) => table.setDraft(e.target.checked) });
  } else {
    input = h("input", { ...common, type, value: draft ?? "", onInput: (e) => table.setDraft(e.target.value) });
  }
  return h("span", { class: "hm-table-edit", "data-no-row-click": "" }, input,
    h("span", { id: errId, class: "hm-table-edit-error", role: "alert" }, () => table.editing()?.error ?? ""));
}

function RowActions(ctx, item) {
  const { props } = ctx;
  const acts = ctx.actions;
  const args = () => [item()];
  const inline = props.rowActionsInline ?? acts.length <= 2;
  if (inline) return h("span", { class: "hm-table-rowactions" }, acts.map((a) => ActionButton(a, args, () => runAction(a, untrack(args)))));
  return h("details", { class: "hm-table-menu hm-table-kebab" },
    h("summary", { class: "hm-table-icon", "aria-label": t`Row actions`, "aria-haspopup": "menu" }, "⋮"),
    h("div", { class: "hm-table-menu-panel", role: "menu" }, acts.map((a) => ActionButton(a, args, () => runAction(a, untrack(args)), { role: "menuitem" }))));
}

function EmptyState(ctx) {
  const { table, props } = ctx;
  const filtered = table.activeFilters().length > 0 || !!table.search();
  if (filtered) return h("div", { class: "hm-empty hm-table-empty" }, h("p", {}, t`No matching rows.`), h("button", { type: "button", class: "hm-btn", onClick: table.clearFilters }, t`Clear filters`));
  const e = props.empty;
  if (e != null) return h("div", { class: "hm-empty hm-table-empty" }, typeof e === "function" ? e() : e);
  return h("div", { class: "hm-empty hm-table-empty" }, t`No data yet.`);
}

function ErrorState(ctx) {
  const { table } = ctx;
  return h("div", { class: "hm-error hm-table-error", role: "alert" },
    h("p", {}, () => String(table.error()?.message ?? table.error() ?? t`Something went wrong.`)),
    table.mode === "server" ? h("button", { type: "button", class: "hm-btn", onClick: () => table.refetch() }, t`Retry`) : null);
}

// ------------------------------------------------------------------ keyboard
function onGridKey(e, ctx) {
  const target = e.target;
  const cell = target.closest?.("[data-cell]");
  if (!cell) return;
  const onCell = target === cell;
  const isToggle = target.tagName === "BUTTON" || (target.tagName === "INPUT" && target.type === "checkbox");
  if (!onCell && !isToggle) return; // text inputs keep their keys
  const tr = cell.parentNode;
  const grid = tr.closest("table");
  const rows = [...grid.querySelectorAll("tr[data-head], tr[data-row]")];
  const cellsOf = (r) => [...r.children].filter((c) => c.hasAttribute("data-cell"));
  const ri = rows.indexOf(tr), ci = cellsOf(tr).indexOf(cell);
  const go = (r, c) => {
    let row = rows[r];
    if (!row && ctx.virtual && r >= rows.length) { ctx.virtual.scrollTop.set(ctx.virtual.scrollTop.peek() + ctx.virtual.rowHeight * (r - rows.length + 1)); const again = grid.querySelectorAll("tr[data-head], tr[data-row]"); row = again[again.length - 1]; }
    if (!row && ctx.virtual && r < 0) { ctx.virtual.scrollTop.set(Math.max(0, ctx.virtual.scrollTop.peek() - ctx.virtual.rowHeight)); row = grid.querySelectorAll("tr[data-row]")[0]; }
    if (!row) return;
    const cs = cellsOf(row);
    const next = cs[Math.max(0, Math.min(cs.length - 1, c))];
    if (!next) return;
    e.preventDefault();
    ctx.active?.setAttribute("tabindex", "-1");
    next.setAttribute("tabindex", "0");
    ctx.active = next;
    next.focus();
    next.scrollIntoView?.({ block: "nearest", inline: "nearest" });
  };
  const last = cellsOf(tr).length - 1;
  switch (e.key) {
    case "ArrowRight": return go(ri, ci + 1);
    case "ArrowLeft": return go(ri, ci - 1);
    case "ArrowDown": return go(ri + 1, ci);
    case "ArrowUp": return go(ri - 1, ci);
    case "Home": return go(e.ctrlKey ? 0 : ri, 0);
    case "End": return go(e.ctrlKey ? rows.length - 1 : ri, last);
    case "PageDown": return go(Math.min(rows.length - 1, ri + 10), ci);
    case "PageUp": return go(Math.max(0, ri - 10), ci);
  }
  if (!onCell || !tr.hasAttribute("data-row")) return;
  const item = ctx.rowOf.get(tr);
  if (!item) return;
  if (e.key === " " && ctx.selectable) { e.preventDefault(); ctx.table.toggle(item(), { range: !!e.shiftKey }); }
  else if ((e.key === "Enter" || e.key === "F2") && cell.hasAttribute("data-editable")) { e.preventDefault(); ctx.table.startEdit(item(), cell.getAttribute("data-col")); }
  else if (e.key === "Enter") { e.preventDefault(); rowActivate(ctx, item(), e); }
}

// ------------------------------------------------------------------ cards
function Cards(ctx) {
  const { table, props } = ctx;
  return h("div", { class: "hm-table-cards", role: "list", "aria-label": props.label ?? props.caption ?? null }, () => {
    const st = table.status();
    return untrack(() => {
      if (st === "loading") return Array.from({ length: 3 }, () => h("div", { class: "hm-table-card hm-table-skeleton", "aria-hidden": "true" }, h("span", { class: "hm-table-skel" }), h("span", { class: "hm-table-skel" })));
      if (st === "error") return ErrorState(ctx);
      if (st === "empty") return EmptyState(ctx);
      return h(For, { each: table.rows, key: table.idOf }, (item) => Card(ctx, item));
    });
  });
}

function Card(ctx, item) {
  const { table, props } = ctx;
  const rid = untrack(() => table.idOf(item()));
  const sel = ctx.selectable ? computed(() => table.isSelected(rid)) : null;
  const open = ctx.expand ? computed(() => table.isExpanded(rid)) : null;
  return h("div", {
    class: () => ["hm-table-card", sel?.() && "is-selected", props.rowClass?.(item())], role: "listitem", "data-row": "",
    onClick: (e) => { if (e.target.closest?.(INTERACTIVE)) return; rowActivate(ctx, item(), e); },
  },
  ctx.selectable || ctx.actions ? h("div", { class: "hm-table-card-head" },
    ctx.selectable ? h("input", { type: "checkbox", class: "hm-table-check", "aria-label": t`Select row`, checked: sel, onClick: (e) => table.toggle(item(), { range: !!e.shiftKey }) }) : null,
    ctx.actions ? RowActions(ctx, item) : null) : null,
  h("dl", { class: "hm-table-card-fields" }, () => {
    const cols = table.visibleColumns();
    return untrack(() => cols.map((c) => h("div", { class: "hm-table-card-field", "data-col": c.key },
      h("dt", {}, c.label), h("dd", { class: `hm-align-${c.align}` }, c.render ? () => c.render(item()) : () => table.format(item(), c)))));
  }),
  ctx.expand ? [
    h("button", { type: "button", class: "hm-table-linkbtn", "aria-expanded": () => String(open()), onClick: () => table.toggleExpand(item()) }, () => (open() ? t`Hide details` : t`Show details`)),
    () => (open() ? untrack(() => h("div", { class: "hm-table-card-expansion" }, ctx.expand(item()))) : null),
  ] : null);
}

// ------------------------------------------------------------------ footer
function Footer(ctx) {
  const { table, props } = ctx;
  const sizes = props.pageSizes ?? [10, 25, 50, 100];
  const sizeSel = h("select", { class: "hm-table-input hm-table-size", "aria-label": t`Rows per page`, onChange: (e) => table.setSize(Number(e.target.value)) },
    [...new Set([...sizes, untrack(table.size)])].sort((a, b) => a - b).map((n) => h("option", { value: String(n) }, String(n))));
  effect(() => { sizeSel.value = String(table.size()); });
  const range = () => {
    const n = table.total();
    if (table.isVirtual()) return t`${n} rows`;
    if (n == null) return t`Page ${table.page()}`;
    if (!n) return t`0 rows`;
    const from = (table.page() - 1) * table.size() + 1, to = Math.min(n, from + table.rows().length - 1);
    return t`${from}–${to} of ${n}`;
  };
  return h("div", { class: "hm-table-footer" },
    h("span", { class: "hm-table-range", role: "status", "aria-live": "polite" }, range),
    () => (table.isVirtual() ? null : untrack(() => [
      h("label", { class: "hm-table-sizefield" }, h("span", {}, t`Rows per page`), sizeSel),
      h("nav", { class: "hm-table-pager", "aria-label": t`Pagination` },
        h("button", { type: "button", class: "hm-btn hm-table-prev", disabled: () => !table.hasPrev(), onClick: table.prev }, t`Previous`),
        h("span", { class: "hm-table-pageinfo" }, () => (table.pageCount() != null && !table.cursorMode ? t`Page ${table.page()} of ${table.pageCount()}` : t`Page ${table.page()}`)),
        h("button", { type: "button", class: "hm-btn hm-table-next", disabled: () => !table.hasNext(), onClick: table.next }, t`Next`)),
    ])));
}
