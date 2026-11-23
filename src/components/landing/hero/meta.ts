import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Hero",
  status: "experimental",
  frozen: "2026-11-20",
  category: "landing",
  since: "0.1.0",
  summary: "First screen in seven looks (centered, split, video, mesh, aurora, product, parallax): eyebrow, gradient-highlight title, lead, actions.",
  composedOf: ["Reveal", "Overlay", "Badge", "VideoBackground", "Parallax", "Picture", "SectionHead"],
  behaviors: ["scrollTimeline"],
});
