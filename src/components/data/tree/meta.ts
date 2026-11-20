import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Tree",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Expandable tree (role=tree) with icons, trailing meta, selection and the full keyboard model; long labels scroll with OverflowText.",
  category: "data",
  composedOf: ["ListRow", "Chevron", "OverflowText"],
  behaviors: ["roving focus"],
  hubs: [],
  showcase: "/data",
});
