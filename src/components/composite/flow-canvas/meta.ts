import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "FlowCanvas",
  status: "experimental",
  category: "composite",
  entry: "hadi-march/flow",
  since: "0.1.0",
  summary: "Node editor: endless canvas (pan, zoom, snap), ports and bezier edges with flowing dots, selection, copy/paste, undo, minimap, auto layout, groups, context menu, JSON schema.",
  composedOf: ["ContextMenu", "IconButton", "OverflowText", "Field", "TextInput", "NumberInput", "Select", "Toggle"],
  behaviors: ["drag", "motion engine", "ClipboardManager", "UndoManager"],
  hubs: ["d"],
  showcase: "/flow",
});
