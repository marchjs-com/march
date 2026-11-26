import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "SankeyChart",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Sankey diagram: flows between nodes in columns, ribbons as wide as their value (gradient or source colored), hover lights a whole flow; ribbons draw in from their source and morph on change; keyboard nodes and links, tooltip and a data table.",
  composedOf: [],
  behaviors: ["keyboard points"],
  hubs: [],
});
