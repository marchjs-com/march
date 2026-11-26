import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "StreamGraph",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Stream graph: categories over time as flowing layers around a moving centre line (wiggle, silhouette or 100 %), smooth curves, layers that swell and sink when data changes, keyboard points, tooltip, legend and a data table.",
  composedOf: [],
  behaviors: ["keyboard points", "zoom"],
  hubs: [],
});
