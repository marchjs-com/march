import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ProjectGrid",
  status: "experimental",
  since: "0.1.0",
  summary: "Portfolio covers with filter Chips: FLIP re-layout on filter, open into ProjectDetail (shared element) or the Lightbox.",
  composedOf: ["Card", "Chip", "openMedia", "Reveal"],
  behaviors: ["flip", "motion engine"],
  showcase: "/web",
});
