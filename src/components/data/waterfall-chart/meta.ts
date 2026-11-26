import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "WaterfallChart",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Waterfall chart: a start value, positive and negative steps, subtotals and a total with connectors and +/− labels; bars build one after another, morph on change and shrink away.",
  composedOf: [],
  behaviors: ["keyboard points"],
  hubs: [],
});
