import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "DockLayout",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "IDE workspace (the dock of march-app-ui): tab groups in rows and columns; drag tabs to a side, centre, between tabs or the outer edge; closing collapses a group to a strip and keeps its size; maximize, presets, saved layouts, focus mode, narrow mode.",
  composedOf: ["Tabs", "IconButton", "Button", "ResizeHandle", "Menu"],
  behaviors: ["drag (dragGhost)", "command manager", "storage (get / set)"],
  hubs: [],
  showcase: "/ide",
});
