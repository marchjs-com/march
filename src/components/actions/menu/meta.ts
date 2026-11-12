import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Menu",
  status: "stable",
  since: "0.1.0",
  summary: "Trigger button with a floating menu of items, links and action()s (separators, shortcuts, danger, permissions) and the full menu keyboard model; Dropdown floats any content.",
  category: "actions",
  composedOf: [],
  behaviors: ["positioning", "roving focus", "action"],
  hubs: [],
  showcase: "/buttons",
});
