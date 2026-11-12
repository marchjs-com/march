import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Chip",
  status: "stable",
  since: "0.1.0",
  summary: "Label pill: static, toggle (filter, aria-pressed) or removable; long labels scroll with OverflowText.",
  category: "actions",
  composedOf: ["OverflowText"],
  behaviors: [],
  hubs: ["d"],
  showcase: "/buttons",
});
