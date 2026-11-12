// hadi-march/table — data table: client or server data, multi-sort, filters, search, paging, virtual scrolling,
// column layout (hide, reorder, resize, pin), selection with bulk actions, row actions, expandable rows, inline edit,
// CSV/JSON export, saved views, URL sync, keyboard grid navigation and a card layout for small screens.
// Separate module: import it only where a table is used. Styles: hadi-march/css/table.css.
export { createTable, column, formatValue, mapParams } from "./state.ts";
export type { TableOptions, TableState, TableQuery, TableParams, TablePage, ParamNames, ColState, TableSnapshot, SavedView, EditState, ActiveFilter, ExportFileOptions, TableAction, RowAction, BulkAction } from "./state.ts";
export { Table, FilterControl, CellEditor } from "./render.ts";
export type { TableProps } from "./render.ts";
export { fold, matchFilter, sortRows, isEmptyFilter, describeFilter } from "./filters.ts";
export type { Column, ColumnInput, TableColumn, FilterKind, FilterOption, OptionsInput, CellFormat, SortDir, SortSpec, Pin, Row } from "./filters.ts";
export { toCSV, toJSON, csvField, download } from "./export.ts";
export type { CSVOptions, JSONOptions } from "./export.ts";
export { windowRange, createVirtual } from "./virtual.ts";
export type { WindowRange, WindowInput, VirtualOptions, Virtual } from "./virtual.ts";
