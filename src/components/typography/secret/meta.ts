import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Secret",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.2.0",
  summary: "A value with hidden parts (API key, card number): index-based hidden regions, an eye button to show it, an optional copy button; hidden characters are never in the DOM.",
  category: "typography",
  composedOf: ["IconButton", "CopyButton"],
  behaviors: [],
  hubs: [],
});
