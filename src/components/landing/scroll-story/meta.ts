import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ScrollStory",
  status: "experimental",
  frozen: "2026-11-20",
  category: "landing",
  since: "0.1.0",
  summary: "Scrollytelling: pinned media column, steps scroll past, the active step's media cross-fades and the section takes its colour.",
  composedOf: ["PageDots"],
  behaviors: ["onScrollProgress", "motion engine", "colorAttr"],
  showcase: "/web",
  demoGroup: "scroll",
});
