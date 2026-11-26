import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Heatmap",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.1.0",
  summary: "Heatmap: a grid of intensities (day × hour) or a calendar heatmap (a year of weeks with month and weekday labels, a less → more legend), in tones of the theme accent; animated, keyboard cells, tooltip and a data table for screen readers.",
  composedOf: [],
  behaviors: ["keyboard points"],
  hubs: [],
});
