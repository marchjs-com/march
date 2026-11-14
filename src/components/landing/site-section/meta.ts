import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "SiteSection",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Frame of every website block: width, rhythm, tone (plain, muted, inverse, brand) and an eyebrow / title / lead heading that reveals.",
  composedOf: ["SectionHead"],
  showcase: "/web",
  demoGroup: "frame",
});
