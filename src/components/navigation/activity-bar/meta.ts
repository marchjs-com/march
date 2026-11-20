import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ActivityBar",
  status: "experimental",
  frozen: "2026-11-20",
  category: "navigation",
  since: "0.1.0",
  summary: "Editor icon bar that switches the side view: a tablist with a gliding indicator, count badges, end items, collapse by choosing the active view again; vertical or horizontal, RTL aware.",
  composedOf: ["Tabs", "Badge", "Tooltip"],
  behaviors: ["roving focus", "motion engine"],
  hubs: [],
  showcase: "/ide",
});
