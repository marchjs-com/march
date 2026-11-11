// createTable(): headless table state — data (client rows or server source), sorting, filtering, search, paging,
// selection, expansion, inline edit, column layout, saved views, URL sync and export. <Table> renders it; you can too.
import { signal, computed, effect, untrack, batch, onCleanup, createRoot } from "../core/reactive.js";
import { applyPipe } from "../core/pipes.js";
import { t, locale } from "../core/i18n.ts";
import { query as dataQuery } from "../data/index.js";
import { setQuery } from "../router/index.ts";
import { fold, valueOf, optionsOf, isEmptyFilter, matchFilter, describeFilter, sortRows, encodeFilter, decodeFilter } from "./filters.js";
import { toCSV, toJSON, download } from "./export.js";

const val = (v) => (typeof v === "function" ? v() : v);
const titleCase = (k) => String(k).replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_-]+/g, " ").replace(/^./, (c) => c.toUpperCase());
let uid = 0;
const sameList = (a, b) => a === b || (!!a && !!b && a.length === b.length && a.every((x, i) => x === b[i]));

/** Normalize one column definition. */
export function column(c) {
  if (typeof c === "string") c = { key: c };
  const filter = c.filter === true ? "text" : c.filter ?? null;
  return { sortable: c.key != null || !!c.sortValue, searchable: c.key != null && filter !== "range" && filter !== "dateRange", align: "start", minWidth: 48, ...c, filter, label: c.label ?? titleCase(c.key ?? "") };
}

/** Display text of a cell: `format` (fn | pipe name | [pipe, ...args]), option labels, Yes/No, lists. */
export function formatValue(row, col) {
  const v = valueOf(row, col), f = col.format;
  if (typeof f === "function") return f(v, row);
  if (typeof f === "string") return applyPipe(f, v);
  if (Array.isArray(f)) return applyPipe(f[0], v, ...f.slice(1));
  if (col.options) { const o = optionsOf(col).find((x) => x.value === v); if (o) return o.label; }
  if (typeof v === "boolean") return v ? t`Yes` : t`No`;
  if (Array.isArray(v)) return v.join(", ");
  if (v instanceof Date) return applyPipe("date", v);
  return v == null ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
}

const DEFAULT_NAMES = { page: "page", size: "size", offset: "offset", cursor: "cursor", sort: "sort", filters: "filters", search: "search" };
/** Rename / drop / transform server params: `{ size: "limit", offset: "skip", page: null, sort: (s) => ({ order: … }) }`. */
export function mapParams(p, names, cursorMode) {
  if (typeof names === "function") return names(p);
  const out = {};
  for (const k of Object.keys(p)) {
    if ((cursorMode && (k === "page" || k === "offset")) || (!cursorMode && k === "cursor")) continue;
    const n = names?.[k] === undefined ? DEFAULT_NAMES[k] ?? k : names[k];
    if (n === null || n === false) continue;
    if (typeof n === "function") Object.assign(out, n(p[k], p));
    else out[n] = p[k];
  }
  return out;
}

function readStore(key) { try { return JSON.parse(globalThis.localStorage?.getItem(key) ?? "null") ?? {}; } catch { return {}; } }
function writeStore(key, v) { try { globalThis.localStorage?.setItem(key, JSON.stringify(v)); } catch { /* storage blocked or full */ } }
const EMPTY_COLS = () => ({ order: [], hidden: {}, widths: {}, pins: {} });

/**
 * Headless table. Options: rows | source, columns | schema, rowKey ("id"), pageSize (25), pageSizes, paging (true | false |
 * "cursor"), paramNames, sort, filters, search, storageKey, urlKey, urlDelay, virtual (true | "auto"), virtualThreshold,
 * onEdit, exportAll, filename, queryKey, loading, error.
 */
export function createTable(o = {}) {
  const id = o.queryKey ?? o.storageKey ?? o.urlKey ?? `t${++uid}`;
  const server = typeof o.source === "function";
  const cursorMode = o.paging === "cursor";
  const paged = o.paging !== false;
  const rowKey = o.rowKey ?? "id";
  const idOf = typeof rowKey === "function" ? rowKey : (r) => r?.[rowKey] ?? r;
  const defaultSize = o.pageSize ?? 25;

  // ------------------------------------------------------------------ columns
  const allColumns = computed(() => {
    const cs = val(o.columns) ?? o.schema?.columns?.() ?? [];
    return cs.map(column);
  });
  const colState = signal(EMPTY_COLS());
  const colOf = (key) => untrack(allColumns).find((c) => c.key === key);
  const isHidden = (c, s = colState()) => (c.key in s.hidden ? s.hidden[c.key] : !!c.hidden);
  const pinOf = (key) => { const s = colState(), c = allColumns().find((x) => x.key === key); return (key in s.pins ? s.pins[key] : c?.pin) ?? null; };
  const widthOf = (key) => { const s = colState(); return s.widths[key] ?? allColumns().find((x) => x.key === key)?.width ?? null; };
  const orderedColumns = computed(() => {
    const cs = allColumns(), order = colState().order;
    const pos = (c, i) => { const j = order.indexOf(c.key); return j < 0 ? order.length + i : j; };
    return cs.map((c, i) => [c, pos(c, i)]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  }, { equals: sameList });
  const visibleColumns = computed(() => {
    const s = colState(), shown = orderedColumns().filter((c) => !isHidden(c, s));
    const side = (c) => { const p = c.key in s.pins ? s.pins[c.key] : c.pin; return p === "left" ? 0 : p === "right" ? 2 : 1; };
    const out = shown.map((c, i) => [c, i]).sort((a, b) => side(a[0]) - side(b[0]) || a[1] - b[1]).map((x) => x[0]);
    out.pins = out.map(side).join(""); // a pin change re-renders cells even when the order stays the same
    return out;
  }, { equals: (a, b) => sameList(a, b) && a.pins === b.pins });
  const setCols = (fn) => colState.set(fn({ ...untrack(colState) }));
  const orderKeys = () => untrack(orderedColumns).map((c) => c.key);

  // ------------------------------------------------------------------ view state
  const sort = signal([...(val(o.sort) ?? [])]);
  const filters = signal({ ...(val(o.filters) ?? {}) });
  const search = signal(typeof val(o.search) === "string" ? val(o.search) : ""); // `search={false}` hides the box (render), not a query
  const page = signal(1);
  const size = signal(defaultSize);
  const cursor = signal(null);
  const cursorStack = signal([]);
  const views = signal([]);
  const defaultView = signal(null);
  const activeView = signal(null);

  // ------------------------------------------------------------------ client pipeline
  const allRows = computed(() => (server ? [] : val(o.rows) ?? []));
  const filtered = computed(() => {
    let rows = allRows();
    const cols = allColumns(), f = filters(), q = fold(search().trim());
    const active = Object.keys(f).filter((k) => !isEmptyFilter(f[k])).map((k) => [cols.find((c) => c.key === k), f[k]]).filter((x) => x[0]);
    if (active.length) rows = rows.filter((r) => active.every(([c, v]) => matchFilter(r, c, v)));
    if (q) {
      const sc = cols.filter((c) => c.searchable);
      const text = (r, c) => { const v = c.searchValue ? c.searchValue(r) : valueOf(r, c); return c.options ? optionsOf(c).find((x) => x.value === v)?.label ?? v : Array.isArray(v) ? v.join(" ") : v; };
      rows = rows.filter((r) => sc.some((c) => fold(text(r, c)).includes(q)));
    }
    return rows;
  });
  const sorted = computed(() => sortRows(filtered(), sort(), allColumns(), locale()));

  // ------------------------------------------------------------------ server pipeline
  const params = computed(() => ({
    page: page(), size: size(), offset: (page() - 1) * size(), cursor: cursor(),
    sort: sort(), filters: Object.fromEntries(Object.entries(filters()).filter(([, v]) => !isEmptyFilter(v))), search: search().trim(),
  }));
  const serverParams = computed(() => mapParams(params(), o.paramNames, cursorMode));
  const q = server ? dataQuery(({ signal: s }) => o.source(untrack(serverParams), { signal: s }), { key: () => ["march.table", id, serverParams()], keep: true, retry: o.retry, refetchOnFocus: o.refetchOnFocus ?? false }) : null;
  const response = computed(() => { const d = q?.(); return Array.isArray(d) ? { items: d } : d ?? { items: [] }; });

  // ------------------------------------------------------------------ paging
  const virtual = computed(() => !server && (o.virtual === true || (o.virtual === "auto" && allRows().length > (o.virtualThreshold ?? 2000))));
  const total = computed(() => (server ? response().total ?? null : sorted().length));
  const pageCount = computed(() => { const n = total(); return n == null ? null : Math.max(1, Math.ceil(n / size())); });
  const curPage = computed(() => (server || !paged || virtual() ? page() : Math.min(page(), pageCount())));
  const rows = computed(() => {
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
  const resetPaging = () => batch(() => { page.set(1); cursor.set(null); cursorStack.set([]); allMatching.set(false); });

  // ------------------------------------------------------------------ selection / expansion / edit
  const selected = signal(new Map());
  const allMatching = signal(false);
  let anchor;
  const expanded = signal(new Set());
  const editing = signal(null);
  const loadingProp = () => !!val(o.loading);

  const table = {
    id, mode: server ? "server" : "client", cursorMode, paged, idOf,
    valueOf, format: (row, col) => formatValue(row, typeof col === "string" ? colOf(col) : col),
    // columns
    allColumns, columns: orderedColumns, visibleColumns, column: colOf, colState,
    isHidden: (key) => { const c = allColumns().find((x) => x.key === key); return c ? isHidden(c) : true; },
    setHidden: (key, hide) => setCols((s) => ({ ...s, hidden: { ...s.hidden, [key]: !!hide } })),
    toggleColumn: (key) => table.setHidden(key, !untrack(() => table.isHidden(key))),
    /** Move among visible columns by `delta` positions (hidden columns are skipped). */
    moveColumn(key, delta) {
      const vis = untrack(orderedColumns).filter((c) => !isHidden(c, untrack(colState))).map((c) => c.key);
      const i = vis.indexOf(key), j = Math.max(0, Math.min(vis.length - 1, i + delta));
      if (i < 0 || i === j) return;
      const ks = orderKeys().filter((k) => k !== key), at = ks.indexOf(vis[j]);
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
    hasWidths: () => visibleColumns().some((c) => widthOf(c.key) != null),
    // data
    rows, filteredRows: () => (server ? rows() : sorted()), allRows, total, isVirtual: virtual,
    loading: () => (server ? q.loading() : loadingProp()),
    refreshing: () => (server ? q.refreshing() : false),
    error: () => (server ? q.error() : val(o.error) ?? null),
    refetch: () => q?.refetch(),
    params, serverParams,
    status: computed(() => (table.error() ? "error" : table.loading() && !rows().length ? "loading" : rows().length ? "rows" : "empty")),
    // sorting
    sort, setSort: (list) => batch(() => { sort.set([...list]); resetPaging(); }),
    sortIndex: (key) => sort().findIndex((s) => s.key === key),
    sortDir: (key) => sort().find((s) => s.key === key)?.dir ?? null,
    toggleSort(key, add = false) {
      const cur = untrack(sort), i = cur.findIndex((s) => s.key === key);
      const next = i < 0 ? "asc" : cur[i].dir === "asc" ? "desc" : null;
      let list;
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
      return Object.keys(f).filter((k) => !isEmptyFilter(f[k])).map((k) => { const c = cs.find((x) => x.key === k) ?? column({ key: k }); return { key: k, label: c.label, value: f[k], text: describeFilter(c, f[k]) }; });
    },
    filterOptions(key) {
      const c = allColumns().find((x) => x.key === key);
      if (!c) return [];
      if (c.options) return optionsOf(c);
      const seen = new Set();
      for (const r of allRows()) { const v = valueOf(r, c); for (const x of Array.isArray(v) ? v : [v]) if (x != null && x !== "") seen.add(x); if (seen.size > 200) break; }
      return [...seen].sort().map((v) => ({ value: v, label: String(v) }));
    },
    // paging
    page: curPage, size, pageCount, hasNext, hasPrev,
    setPage: (n) => page.set(Math.max(1, Math.min(Number(n) || 1, untrack(pageCount) ?? Infinity))),
    setSize: (n) => batch(() => { size.set(Number(n) || defaultSize); resetPaging(); }),
    next() {
      if (!untrack(hasNext)) return;
      if (cursorMode) batch(() => { cursorStack.set([...untrack(cursorStack), untrack(cursor)]); cursor.set(untrack(response).nextCursor); page.set(untrack(page) + 1); });
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
      const rid = idOf(row), cur = untrack(selected), next = new Map(cur);
      const want = on ?? !cur.has(rid);
      const list = untrack(rows);
      const a = range && anchor !== undefined ? list.findIndex((r) => idOf(r) === anchor) : -1, b = list.findIndex((r) => idOf(r) === rid);
      const span = a >= 0 && b >= 0 ? list.slice(Math.min(a, b), Math.max(a, b) + 1) : [row];
      for (const r of span) want ? next.set(idOf(r), r) : next.delete(idOf(r));
      anchor = rid;
      batch(() => { selected.set(next); if (!want) allMatching.set(false); });
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
    clearSelection: () => batch(() => { selected.set(new Map()); allMatching.set(false); anchor = undefined; }),
    /** Run a bulk action with the selected rows; clears the selection when it ran successfully. Errors are swallowed (the action reports them). */
    async runBulk(a) {
      const list = untrack(table.selectedRows);
      let ran = typeof a.busy !== "function";
      const stop = ran ? null : createRoot((d) => { effect(() => { if (a.busy()) ran = true; }); return d; });
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
      const c = colOf(e.key) ?? { key: e.key };
      let value = e.draft;
      let msg = null;
      if (o.schema?.validateField) {
        msg = o.schema.validateField(e.key, value, { ...e.row, [e.key]: value });
        if (!msg && o.schema.parse) value = o.schema.parse({ [e.key]: value })[e.key];
      } else if (c.type === "number" && value !== "" && value != null) value = Number(value);
      msg ??= c.validate?.(value, e.row) ?? null;
      if (msg) { editing.set({ ...e, error: msg }); return false; }
      editing.set({ ...e, saving: true });
      try {
        await o.onEdit?.(e.row, e.key, value);
        if (untrack(editing)?.id === e.id) editing.set(null);
        return true;
      } catch (err) {
        if (untrack(editing)?.id === e.id) editing.set({ ...e, saving: false, error: err?.message || t`Could not save` });
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
  if (o.storageKey) {
    const st = readStore(o.storageKey);
    untrack(() => batch(() => {
      if (Array.isArray(st.views)) views.set(st.views.filter((v) => v && typeof v.name === "string" && v.state));
      if (st.columns && typeof st.columns === "object") colState.set({ ...EMPTY_COLS(), ...st.columns });
      if (st.default) { defaultView.set(st.default); table.applyView(st.default); }
    }));
    effect(() => {
      const v = { views: views(), default: defaultView(), columns: colState() };
      untrack(() => writeStore(o.storageKey, v));
    });
  }

  // ------------------------------------------------------------------ URL sync (urlKey)
  if (o.urlKey) {
    const k = (s) => `${o.urlKey}.${s}`, pre = `${o.urlKey}.`;
    const sp = new URLSearchParams(globalThis.location?.search ?? "");
    untrack(() => batch(() => {
      if (sp.has(k("s"))) sort.set(sp.get(k("s")).split(",").filter(Boolean).map((x) => (x[0] === "-" ? { key: x.slice(1), dir: "desc" } : { key: x, dir: "asc" })));
      if (sp.has(k("q"))) search.set(sp.get(k("q")));
      const f = {};
      for (const [name, v] of sp) if (name.startsWith(k("f."))) f[name.slice(k("f.").length)] = decodeFilter(v);
      if (Object.keys(f).length) filters.set(f);
      if (sp.has(k("n"))) size.set(Number(sp.get(k("n"))) || defaultSize);
      if (sp.has(k("c"))) cursor.set(sp.get(k("c")));
      if (sp.has(k("p"))) page.set(Math.max(1, Number(sp.get(k("p"))) || 1));
    }));
    const want = computed(() => {
      const w = {};
      const s = sort().map((x) => (x.dir === "desc" ? `-${x.key}` : x.key)).join(",");
      if (s) w[k("s")] = s;
      if (search()) w[k("q")] = search();
      for (const [fk, fv] of Object.entries(filters())) if (!isEmptyFilter(fv)) w[k(`f.${fk}`)] = encodeFilter(fv);
      if (size() !== defaultSize) w[k("n")] = String(size());
      if (cursor() != null) w[k("c")] = String(cursor());
      if (page() > 1) w[k("p")] = String(page());
      return w;
    });
    const write = (w) => {
      const cur = new URLSearchParams(globalThis.location?.search ?? "");
      const values = {};
      for (const name of new Set(cur.keys())) if (name.startsWith(pre) && !(name in w)) values[name] = null;
      let changed = Object.keys(values).length > 0;
      for (const [name, v] of Object.entries(w)) { if (cur.get(name) !== v) changed = true; values[name] = v; }
      if (!changed) return; // always send the full table state: the router's query may lag behind location
      try { setQuery(values, { replace: true }); } catch {
        for (const [name, v] of Object.entries(values)) v == null ? cur.delete(name) : cur.set(name, v);
        const qs = cur.toString();
        globalThis.history?.replaceState(globalThis.history.state, "", `${globalThis.location.pathname}${qs ? `?${qs}` : ""}${globalThis.location.hash ?? ""}`);
      }
    };
    let timer = null;
    const delay = o.urlDelay ?? 250;
    effect(() => {
      const w = want();
      untrack(() => { clearTimeout(timer); if (delay) timer = setTimeout(() => write(w), delay); else write(w); });
    });
    onCleanup(() => clearTimeout(timer));
  }
  return table;
}
