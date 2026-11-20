import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "DataGrid",
  status: "experimental",
  frozen: "2026-11-20",
  category: "data",
  since: "0.2.0",
  summary: "Spreadsheet-like grid for 100k+ rows: virtual rows and columns, sort, filter, group with aggregates, pinned / resizable / draggable columns, cell editing, keyboard cursor, CSV.",
  composedOf: ["SearchBox", "Button", "Chip", "Menu", "Checkbox", "Chevron", "Badge", "ResizeHandle", "Empty", "LiveStatus", "FilterControl", "CellEditor"],
  behaviors: ["virtual", "selection", "group", "drag", "resize-handle"],
  hubs: [],
  showcase: "/big-data",
  barrel: false,
});
