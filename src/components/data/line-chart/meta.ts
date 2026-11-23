import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "LineChart",
  status: "experimental",
  frozen: "2026-11-20",
  category: "data",
  entry: "march/charts",
  since: "0.1.0",
  summary: "Line and area charts (AreaChart in the same folder): time, number or category x axis, several series, drag to zoom, keyboard points, tooltip, legend and a data table for screen readers.",
  composedOf: [],
  behaviors: ["keyboard points", "zoom"],
  hubs: [],
});
