import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "FormatToolbar",
  status: "experimental",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "The formatting bar of a text editor: tools in your order (bold, italic, headings, lists, link, undo…), toggle state, shortcut hints, own names and icons; one Tab stop.",
  category: "composite",
  composedOf: ["Toolbar", "IconButton", "Divider"],
  behaviors: ["roving-focus"],
  hubs: [],
});
