import { defineMeta } from "../meta.ts";

export default defineMeta({
  name: "Drawer",
  status: "experimental",
  since: "0.1.0",
  summary: "Sheet from start / end / top / bottom (RTL-aware): drag to close, snap points, modal or non-modal; motion-engine animation.",
  composedOf: ["Portal", "Dialog"],
  behaviors: ["dialog frame", "motion engine", "pointer drag"],
  hubs: ["d"],
  showcase: "/overlays",
});
