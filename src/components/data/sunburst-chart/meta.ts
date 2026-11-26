import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "SunburstChart",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Sunburst chart: a hierarchy as rings colored by top branch, drill-in zoom (click / Enter in, center / Escape out) with a breadcrumb path, labels on wide arcs; arcs open, tween on zoom and data changes and collapse when they leave; keyboard rings, tooltip, legend and a data table.",
  composedOf: ["Breadcrumbs"],
  behaviors: ["keyboard points", "chart motion (tween, presence)", "zoom"],
  hubs: [],
});
