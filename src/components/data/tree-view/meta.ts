import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "TreeView",
  status: "experimental",
  since: "0.2.0",
  summary: "Virtual tree for large hierarchies: lazy children, single / multiple selection, drag and drop (before / after / inside), search with highlighted hits, full keyboard model.",
  composedOf: ["Spinner"],
  behaviors: ["virtual", "selection", "pointerDrag", "markText", "layer"],
  hubs: [],
  showcase: "/big-data",
  barrel: false,
});
