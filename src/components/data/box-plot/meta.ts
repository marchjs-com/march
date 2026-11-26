import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "BoxPlot",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Box and violin plot: quartiles, whiskers (1.5 IQR or min / max), outliers and the mean per category, kernel density violins, jittered raw points, vertical or horizontal, keyboard categories and boxes that grow from the median, morph and collapse away.",
  composedOf: [],
  behaviors: ["keyboard points"],
  hubs: [],
});
