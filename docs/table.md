# Table (`hadi-march/table`)

A data table for client-side arrays or server APIs: sorting, filtering, search, paging, virtual scrolling, column layout,
selection with bulk actions, row actions, expandable rows, inline editing, CSV/JSON export, saved views, URL sync,
keyboard navigation and a card layout for small screens.

It is a separate module. Nothing in the core imports it, so it only reaches your bundle where you import it.

```js
import { Table, createTable } from "hadi-march/table";
import "hadi-march/css/table.css"; // or a <link> tag; it uses the tokens from tokens.css
```

```jsx
<Table rows={$people} columns={[{ key: "name", filter: "text" }, { key: "age", filter: "range", align: "end" }]} selectable />
```

## Props

Every `createTable()` option is also a `<Table>` prop. You can also pass a ready-made `table={createTable(…)}` and keep the
state in your own component.

### Data

| prop | type | default | |
|---|---|---|---|
| `rows` | array, signal or function | | Client mode: all rows are in memory. |
| `source` | `async (params, { signal }) => { items, total?, nextCursor? }` | | Server mode (see below). It may also return a plain array. |
| `rowKey` | string or `(row) => key` | `"id"` | Keyed rendering, selection and expansion. |
| `columns` | array, signal or function | | Column definitions (below). |
| `schema` | schema | | Used for columns when `columns` is missing (`schema.columns()`), and to validate and parse inline edits. |
| `loading`, `error` | value or signal | | Client mode states. In server mode they come from the query. |
| `paging` | `true`, `false` or `"cursor"` | `true` | `false` shows every row. `"cursor"` enables cursor paging for `source`. |
| `pageSize` | number | `25` | |
| `pageSizes` | number[] | `[10, 25, 50, 100]` | Options in the page size selector. |
| `paramNames` | object or function | | Maps server params (below). |
| `queryKey` | string | storageKey, urlKey or an id | Cache key prefix for the internal `query()`. |
| `retry`, `refetchOnFocus` | | `2`, `false` | Passed on to `query()`. |
| `sort`, `filters`, `search` | | | Initial state: `[{ key, dir }]`, `{ key: value }` and a string. |
| `virtual` | `true` or `"auto"` | off | Virtual scrolling for client rows. `"auto"` turns it on above `virtualThreshold` (2000) rows. |
| `height`, `rowHeight`, `overscan` | px, px, rows | `480`, `40`, `6` | Settings for virtual mode. Rows have a fixed height. |

### Columns

```js
{
  key: "price",                 // field name (dotted paths are not resolved: use `value`)
  label: "Price",               // default: title-cased key
  value: (row) => row.price,    // optional getter instead of row[key]
  format: ["money", "EUR"],     // pipe name, [pipe, ...args] or (value, row) => string
  render: (row) => <b>{row.price}</b>,   // custom cell content (wins over format)
  sortable: true, sortValue: (row) => row.price,
  filter: "text" | "range" | "dateRange" | "select" | "bool",
  options: ["a", "b"] | [{ value, label }],   // select filter, labels, select editor
  filterMultiple: true,         // select filter: checkboxes (default) or one value (false)
  filterFn: (row, value) => bool,             // custom filter predicate
  searchable: true, searchValue: (row) => "…",
  width: 160, minWidth: 48, maxWidth, align: "start" | "end" | "center",
  pin: "left" | "right", hidden: false, resizable: true,
  editable: false, type: "number" | "date" | "bool" | …,  validate: (value, row) => message | null,
  export: true, exportValue: (row) => value,
  cellClass, headerClass, headerRender: () => node,
}
```

`schema.columns()` already produces `key`, `label`, `type`, `format`, `sortable`, `filter`, `options` and `align`.
You can override any field: `Person.columns({ name: { editable: true, pin: "left" } })`.

### Interaction and rendering

| prop | |
|---|---|
| `selectable` | Adds a checkbox column, select-all (this page or all matching rows) and Shift+click range selection. |
| `bulkActions` | Action objects (`action()` from `hadi-march/ui`). They run with the array of selected rows and clear the selection when they succeed. |
| `rowActions` | Action objects that run with the row. Up to 2 show inline. With more, they go into a ⋮ menu (`rowActionsInline` overrides this). |
| `onRowClick(row, event)` | Called when a row is clicked or Enter is pressed on it. Clicks on buttons, inputs and links are ignored. |
| `expand(row)` | Content for an expandable row. With no `onRowClick`, a row click toggles it. |
| `onEdit(row, key, value)` | Async save for `editable` columns. Double-click, Enter or F2 opens the editor. Enter saves and Esc cancels. Validation messages come from the schema's `validateField` or the column's `validate` and are shown under the input. A rejected promise shows its message. |
| `empty` | Node or function shown when there are no rows. When filters are active, the table shows "No matching rows" with a Clear filters button. |
| `layout` | `"auto"` (default), `"table"` or `"cards"`. In auto mode the cards layout is used below `cardBreakpoint` (640px, through matchMedia). |
| `caption` / `label` | Accessible name of the grid. |
| `toolbar`, `search`, `exportable` | Set to `false` to hide the toolbar, the search box or the export menu. `toolbarEnd` adds your own node to the toolbar. |
| `searchDelay` | Debounce for the search box (ms). Defaults: 120 in client mode, 300 in server mode. |
| `storageKey` | Saved views and column layout in localStorage. |
| `urlKey`, `urlDelay` | URL sync, with a 250ms debounce. |
| `filename`, `exportAll(params)` | Export file name. `exportAll` returns every matching row in server mode. |
| `rowClass(row)`, `reorderable`, `resizable`, `skeletonRows` | |

## Server mode

The `source` function receives:

```js
{ page, size, offset, cursor, sort: [{ key, dir }], filters: { key: value }, search }
```

`page` and `offset` are sent in page mode. `cursor` is sent only with `paging="cursor"`. Use `paramNames` to adapt these
params to any API: a string renames a param, `null` drops it, and a function returns the fields to merge. You can also
pass a function that receives the whole params object.

```jsx
// GET /api/orders?skip=40&limit=20&order=-total,customer&q=acme
<Table
  source={(p, { signal }) => fetchJson(`/api/orders?${new URLSearchParams(p)}`, { signal })}
  paramNames={{
    offset: "skip", size: "limit", page: null, search: "q",
    sort: (s) => ({ order: s.map((x) => (x.dir === "desc" ? "-" : "") + x.key).join(",") }),
    filters: (f) => Object.fromEntries(Object.entries(f).map(([k, v]) => [k, JSON.stringify(v)])),
  }}
  columns={columns}
/>

// Cursor API: { items, nextCursor }
<Table source={(p) => api.list({ after: p.after, first: p.size })} paging="cursor" paramNames={{ cursor: "after" }} columns={columns} />
```

Requests go through `query()` from `hadi-march/data`. The key is the mapped params, so you get caching, de-duplication,
retry for temporary errors, and aborting of old requests. `table.refetch()` reloads the data. While a new page loads,
the previous rows stay visible with `aria-busy`. A failed request shows its message and a Retry button. To refetch
after a mutation, use `invalidate(["march.table", queryKey])`.

## URL sync

With `urlKey="people"`, the table writes its state to the query string with `setQuery(…, { replace: true })` and reads
it back on load, so a copied link opens the same view:

```
?people.s=age,-name&people.q=ada&people.f.team=["design"]&people.f.age={"min":30}&people.p=2&people.n=50
```

`s` is the sort order (a `-` prefix means descending), `q` the search text, `f.<key>` a filter (plain text, or JSON for
other values), `p` the page, `n` the page size and `c` the cursor. Default values are left out. If no router has been
created, the table updates `history.replaceState` directly.

## Saved views

With `storageKey`, the table keeps the column layout (order, hidden columns, widths, pins) and a list of named views in
`localStorage`. A view saves its filters, sort, search, page size and column layout. If storage is blocked or holds
invalid data, the table falls back to its defaults.

```js
const table = createTable({ rows, columns, storageKey: "orders.table" });
table.saveView("Open orders");        // snapshot of the current state
table.setDefaultView("Open orders");  // applied when the table is created
table.applyView("Open orders"); table.deleteView("Open orders");
table.views(); table.activeView(); table.defaultView();
```

The Views menu in the toolbar does the same. If the URL also holds state, it wins over the default view.

## Headless use

`createTable(options)` returns reactive state and commands. Call it inside a component or root.

- Data: `rows()` (current page, or all rows in virtual mode), `filteredRows()`, `total()`, `status()`
  (`"loading" | "error" | "empty" | "rows"`), `loading()`, `error()`, `refetch()`.
- Sorting: `sort()`, `toggleSort(key, add)`, `setSort(list)`, `sortDir(key)`.
- Filters and search: `filters()`, `setFilter(key, value)`, `clearFilter(key)`, `clearFilters()`, `activeFilters()`,
  `search()`, `setSearch(text)`.
- Paging: `page()`, `size()`, `pageCount()`, `setPage(n)`, `setSize(n)`, `next()`, `prev()`, `hasNext()`, `hasPrev()`.
- Selection: `toggle(row, { range })`, `selectPage(on)`, `selectAllMatching()`, `clearSelection()`, `selectedRows()`,
  `selectedCount()`, `isSelected(id)`, `allMatching()`, `runBulk(action)`.
- Expansion and editing: `toggleExpand(row)`, `isExpanded(id)`, `startEdit(row, key)`, `setDraft(value)`, `commitEdit()`,
  `cancelEdit()`, `editing()`.
- Columns: `columns()`, `visibleColumns()`, `setHidden(key, hidden)`, `toggleColumn(key)`, `moveColumn(key, ±n)`,
  `moveColumnTo(key, beforeKey)`, `setWidth(key, px)`, `widthOf(key)`, `pin(key, "left" | "right" | null)`,
  `resetColumns()`.
- Export: `toCSV({ formatted, bom, separator })`, `toJSON()`, and `exportCSV()` / `exportJSON()`, which download a file.

## Export

CSV follows RFC 4180: fields that contain a quote, the separator, a line break, or leading or trailing spaces are quoted,
and quotes inside are doubled. By default text that starts with `= + - @` gets a `'` prefix, so spreadsheet programs do
not run it as a formula (`safe: false` turns this off). `formatted: true` exports what the cells display. The default
exports raw values. The toolbar export adds a BOM so Excel detects UTF-8. Client mode exports the current filtered and
sorted rows of the visible columns. Server mode exports the result of `exportAll(params)`, or the current page if you
did not provide it. The download uses a Blob object URL, which is revoked right after.

## Accessibility and keyboard

- A plain `<table>` with `scope="col"` headers and `aria-sort`. It becomes `role="grid"` when rows are interactive
  (selection, actions, expand, row click, editing), with `aria-rowcount`, `aria-rowindex`, `aria-selected` and
  `aria-multiselectable`.
- Grid navigation: arrow keys, Home/End (with Ctrl for the first or last row), PageUp/PageDown. One cell is in the tab
  order at a time (roving tabindex). Space toggles selection, Enter opens the row or its expansion, and Enter/F2 edits
  an editable cell.
- Resize handles are focusable separators: ←/→ change the width by 10px (50px with Shift), and Home resets it to the
  minimum. You can reorder columns by dragging headers or with the ↑/↓ buttons in the Columns menu.
- Status text (row range, selection count) is announced through `aria-live`, and default strings use `t`.

## Performance

Rows are rendered with a keyed `<For>` on `rowKey`. When one row object changes, only that row's cells update. With
`store()` rows, a single field change updates a single cell. Virtual mode renders only the visible rows plus
`overscan`, which keeps 100,000+ rows smooth. See `node bench/table.js`.
