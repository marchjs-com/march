import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ChoroplethMap",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Choropleth map: Turkey's 81 provinces (lazy, Natural Earth) or your own shapes / GeoJSON coloured by value, continuous or in classes, with a colour legend, focus and zoom, keyboard regions, tooltip and a data table for screen readers.",
  composedOf: [],
  behaviors: ["keyboard points", "zoom"],
  hubs: [],
});
