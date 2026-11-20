import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "CopyButton",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Copies text to the clipboard: a text or icon-only button that confirms (Copied) for a moment and reports failure with a toast.",
  category: "actions",
  composedOf: ["Button", "IconButton"],
  behaviors: [],
  hubs: [],
  showcase: "/buttons",
});
