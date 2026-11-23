import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Stat",
  status: "experimental",
  frozen: "2026-11-20",
  category: "data",
  entry: "march/charts",
  since: "0.1.0",
  summary: "KPI box: label, formatted value, the change against the previous period with an arrow (green or red, inverted for costs) and an optional sparkline.",
  composedOf: ["StatTile", "Sparkline"],
  behaviors: [],
  hubs: [],
});
