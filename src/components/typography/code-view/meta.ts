import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "CodeView",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Read-only code block: line numbers, syntax colours (js/ts/jsx/tsx, css, html, json, sh), wrap toggle and a copy button.",
  category: "typography",
  composedOf: ["CopyButton", "Button", "IconButton", "PanelHeader"],
  behaviors: [],
  hubs: [],
  showcase: "/data",
});
