import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Window",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "A movable, resizable window inside its area: dock to an edge, minimize, fill, close; Windows, Mac or HADİ look.",
  category: "layout",
  composedOf: ["PanelHeader", "IconButton", "ResizeHandle"],
  behaviors: ["drag"],
  showcase: "/layout",
});
