import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "FunnelChart",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Funnel chart: stages of a flow as smooth trapezoids, centered bars or a pyramid, with values, share of the first stage, step conversion and drop-off; stages pour in, morph and collapse.",
  composedOf: [],
  behaviors: ["keyboard points"],
  hubs: [],
});
