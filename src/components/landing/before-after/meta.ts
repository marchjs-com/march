import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "BeforeAfter",
  status: "experimental",
  frozen: "2026-11-20",
  category: "landing",
  since: "0.1.0",
  summary: "Before / after comparison: two layers and a divider you drag, press, follow with the pointer or move with the keyboard; vertical or horizontal, RTL mirrored.",
  composedOf: ["Badge"],
  behaviors: ["track", "arrowStep", "motion engine", "onVisible"],
  showcase: "/web",
  demoGroup: "proof",
});
