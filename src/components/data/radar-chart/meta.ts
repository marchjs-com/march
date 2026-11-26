import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "RadarChart",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Radar (spider) chart: one spoke per row, series as filled polygons with dots, polygon or circle grid, shared or per-axis scale, smooth shapes; shapes grow from the center and morph, keyboard spokes, tooltip, legend toggles and a data table for screen readers.",
  composedOf: [],
  behaviors: ["keyboard points", "chart motion (tween, presence)"],
  hubs: [],
});
