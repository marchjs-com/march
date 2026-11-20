import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Splitter",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Two resizable panes: drag the handle or use the arrow keys (mirrored in RTL), Home / End, Enter resets.",
  category: "layout",
  composedOf: ["ResizeHandle"],
  behaviors: ["resize-handle"],
  showcase: "/layout",
});
