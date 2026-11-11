// hadi-march/table — data table: client or server data, multi-sort, filters, search, paging, virtual scrolling,
// column layout (hide, reorder, resize, pin), selection with bulk actions, row actions, expandable rows, inline edit,
// CSV/JSON export, saved views, URL sync, keyboard grid navigation and a card layout for small screens.
// Separate module: import it only where a table is used. Styles: hadi-march/css/table.css.
export { createTable, column, formatValue, mapParams } from "./state.js";
export { Table, FilterControl } from "./render.js";
export { fold, matchFilter, sortRows, isEmptyFilter, describeFilter } from "./filters.js";
export { toCSV, toJSON, csvField, download } from "./export.js";
export { windowRange, createVirtual } from "./virtual.js";
