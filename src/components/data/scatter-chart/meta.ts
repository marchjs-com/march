import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ScatterChart",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Scatter and bubble chart: numeric or time axes, area-scaled bubbles, series with shapes and legend toggles, least-squares trend lines with r², reference marks, nearest-point hover, keyboard points and points that grow in, glide and shrink out.",
  composedOf: [],
  behaviors: ["keyboard points"],
  hubs: [],
});
