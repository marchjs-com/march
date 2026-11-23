import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ProjectGrid",
  status: "experimental",
  frozen: "2026-11-20",
  category: "landing",
  since: "0.1.0",
  summary: "Portfolio covers with filter Chips: FLIP re-layout on filter, open into ProjectDetail (shared element) or the Lightbox.",
  composedOf: ["Card", "Chip", "openMedia", "CornerMark", "Picture", "Reveal"],
  behaviors: ["flip", "motion engine"],
});
