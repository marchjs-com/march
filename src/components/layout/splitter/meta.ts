import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Splitter",
  status: "stable",
  since: "0.1.0",
  summary: "Two resizable panes: drag the handle or use the arrow keys (mirrored in RTL), Home / End, Enter resets.",
  category: "layout",
  composedOf: [],
  behaviors: ["resize-handle"],
  showcase: "/layout",
});
