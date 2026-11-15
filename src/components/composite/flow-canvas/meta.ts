import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "FlowCanvas",
  status: "experimental",
  category: "composite",
  entry: "march/flow",
  since: "0.1.0",
  summary: "Node editor: endless canvas (pan, zoom, snap), ports and bezier edges with flowing dots, selection, copy/paste, undo, minimap, auto layout, groups, context menu, JSON schema.",
  composedOf: ["ContextMenu", "IconButton", "Toolbar", "OverflowText", "IconTile", "StatusDot", "CheckMark", "Alert", "Field", "TextInput", "NumberInput", "Select", "Toggle", "Button", "CopyButton", "UndoRedo", "JsonEditor", "FlowControls", "FlowPalette", "Tabs"],
  behaviors: ["drag", "motion engine", "ClipboardManager", "UndoManager"],
  hubs: ["d"],
  showcase: "/flow",
});
