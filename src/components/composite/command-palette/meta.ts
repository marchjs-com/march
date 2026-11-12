import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "CommandPalette",
  status: "stable",
  since: "0.1.0",
  summary: "Ctrl/⌘+K search over commands, pages and actions with typo-tolerant ranking and an optional intent hook; the dialog loads on first open.",
  category: "composite",
  composedOf: ["Dialog", "OverflowText"],
  behaviors: ["list-nav"],
  hubs: [],
  showcase: "/overlays",
});
