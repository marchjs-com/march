import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Histogram",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Histogram: raw values binned on nice thresholds or a bin width, counts, densities or running totals, groups overlaid, a normal or kernel density curve, mean / median marks, keyboard bins and bars that grow, morph on a re-bin and shrink away.",
  composedOf: [],
  behaviors: ["keyboard points"],
  hubs: [],
});
