// Virtual scrolling for the table: the shared virtual window lives in core/virtual.ts (also used by DataGrid,
// TreeView and FileManager); this module keeps the table's import path.
export { windowRange, createVirtual } from "../core/virtual.ts";
export type { WindowRange, WindowInput, VirtualOptions, Virtual } from "../core/virtual.ts";
