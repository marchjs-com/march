import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "TreeView",
  status: "experimental",
  frozen: "2026-11-20",
  category: "data",
  since: "0.2.0",
  summary: "Virtual tree for large hierarchies: lazy children, single / multiple selection, drag and drop (before / after / inside), search with highlighted hits, full keyboard model.",
  composedOf: ["ListRow", "Chevron", "Spinner", "Button", "Badge", "Empty"],
  behaviors: ["virtual", "selection", "drag", "markText", "layer"],
  hubs: [],
  barrel: false,
});
