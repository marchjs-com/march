import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Badge",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Small status label in a tone, a dot badge, or a count badge (hidden at 0, 120 → 99+) with an accessible label; a pulsing dot, a mini size and a clickable (button) form.",
  category: "data",
  composedOf: ["StatusDot"],
  behaviors: [],
  hubs: [],
  showcase: "/data",
});
