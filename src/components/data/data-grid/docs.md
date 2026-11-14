# DataGrid

A spreadsheet-like grid for large data. It runs on the table engine (`createTable`: sorting, filters, search, column
layout, selection, inline edit, CSV) and the shared virtual window, which windows **rows and columns**: only the cells in
view are in the DOM, so 100 000 rows × many columns scroll smoothly. On top it adds grouping with aggregates, a totals
footer, pinned columns, drag to reorder and resize columns, and a keyboard cell cursor.

```tsx
import { DataGrid } from "hadi-march/components/data/data-grid";

<DataGrid rows={$orders} rowKey="id" selectable groupBy={["region"]}
  columns={[
    { key: "customer", label: "Customer", pin: "left", editable: true },
    { key: "region", label: "Region", filter: "select" },
    { key: "amount", label: "Amount", format: ["money", "USD"], aggregate: "sum" },
  ]}
  onEdit={(row, key, value) => save(row.id, key, value)} />
```

## Props

| Prop | Type | Default | |
|---|---|---|---|
| `rows` | array / signal / getter | — | the data (ignored with `table`) |
| `columns` | `DataGridColumn[]` | — | table columns plus `aggregate` and `groupable` |
| `rowKey` | key or `(row) => id` | `"id"` | |
| `table` | `TableState` | — | an existing `createTable()` (server data, saved views, URL sync) |
| `height` | px | `480` | scroll area height |
| `rowHeight` | px / accessor | `36` | density |
| `groupBy` | `string[]` / accessor | — | column keys; an accessor resets the grouping when it changes; controlled with `onGroupBy` |
| `onGroupBy` | `(keys) => void` | — | grouping changed from a column menu or the toolbar |
| `selectable` | boolean | `false` | checkboxes, Space, Shift+↑↓, Ctrl+click, Ctrl+A |
| `onEdit` | `(row, key, value) => void \| Promise` | — | save an edited cell; throw to show the message |
| `footer` | boolean | when a column has `aggregate` | totals over all filtered rows |
| `toolbar` | boolean / `{ search?, groups?, filters?, csv?, count? }` | `true` | search, grouping chips, filters, CSV, counts; an object turns single tools off |
| `columnMenu` | boolean | `true` | the ⋮ menu of every column header |
| `empty` | boolean / node | `true` | the empty state: the text of `labels`, off, or your own node |
| `labels` | `Partial<DataGridLabels>` | built-in texts | every text the grid writes: toolbar, menu items, empty states, totals, aggregate names |
| `animate` | boolean | `true` | row entrance, column slide, save flash |
| `filename` | string | `"data"` | CSV file name |
| `onActivate` | `(row, key) => void` | — | Enter / double-click on a cell that is not editable |
| `label` | string | "Data grid" | accessible name |
| `class` | class | — | extra class on the root |

```tsx
<DataGrid rows={rows} columns={columns} toolbar={{ csv: false, groups: false }} columnMenu={false} animate={false}
  empty={<EmptyState title="No orders yet" />}
  labels={{ search: "Find an order", rows: (n) => `${n} orders`, total: "Sum", filtersActive: (n) => `${n} filters on` }} />
```

`labels` keys: `search`, `tools`, `grouping`, `groupHint`, `showAll`, `filters`, `csv`, `noRows`, `noMatch`, `total`,
`emptyGroup`, `selectAll`, `selectRow`, `sortAsc`, `sortDesc`, `clearSort`, `group`, `ungroup`, `pinStart`, `pinEnd`,
`unpin`, `hide`, `sum`, `average`, `minimum`, `maximum`, `count`, `distinct`, and the functions `filtersActive(n)`,
`rows(n)`, `selected(n)`, `columnMenu(column)`, `resize(column)`. The texts inside filter controls and cell editors
belong to the table engine (`hadi-march/table`).

Column extras: `aggregate` is `"sum" | "avg" | "min" | "max" | "count" | "distinct"` or `(values, rows) => result`;
`groupable: false` hides "Group by this column". Every `createTable` column option works (`pin`, `width`, `format`,
`filter`, `editable`, `validate`, `render` …).

Shared engines it uses, each importable on its own: `createAxis` / `createViewport` (core/virtual), `createSelection` /
`moveCursor` (core/selection), `groupRows` / `aggregate` / `aggregates` (hadi-march/data), `pointerDrag`
(hadi-march/motion), `CellEditor` / `FilterControl` (hadi-march/table).

## Interaction

- Header: click sorts (Shift+click adds a sort level), drag reorders within the same pin group, the edge resizes
  (double-click fits, ← → on the focused handle), the ⋮ menu sorts, groups, pins and hides.
- Cells: click moves the cursor, double-click / Enter / F2 / typing edits; Enter saves and moves down, Tab saves and
  moves on, Escape cancels. A saved cell flashes.
- Group rows: click, Enter or ← → opens and closes; aggregates show in their columns.
- Ctrl+C copies the selected rows (tab-separated, with header) or the cursor cell. "CSV" downloads the filtered rows.

## Accessibility

`role="grid"` with `aria-rowcount` / `aria-colcount` (the full size, not the rendered window), `aria-rowindex` /
`aria-colindex` on each row and cell, `aria-sort` on headers, `aria-selected` on rows, `aria-expanded` /
`aria-level` on group rows. The grid is one tab stop; the cursor cell is announced through `aria-activedescendant`.
Resize handles are separators with their current width. Motion (row entrance, column slide, save flash) runs on the
motion engine, so reduced motion and the global pause apply.

## Composed of

SearchBox (search), Button (toolbar buttons), Chip (grouping chips), Menu (column menu), Checkbox (row selection), Chevron and Badge (group rows: arrow and count), ResizeHandle (column width), Empty (empty state), FilterControl, CellEditor and the sort mark (from the table engine).
