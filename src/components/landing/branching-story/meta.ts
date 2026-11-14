import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "BranchingStory",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Choose-your-own-path story: passages with choices, a trail that rewinds, endings found counter, 3D page turns, keys 1–9.",
  composedOf: ["Badge", "Breadcrumbs", "Button", "Kbd", "ListRow"],
  behaviors: ["motion engine", "focus management", "keyboard 1–9"],
  showcase: "/web",
  demoGroup: "talk",
});
