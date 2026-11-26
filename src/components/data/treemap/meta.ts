import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Treemap",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Treemap: a hierarchy as squarified rectangles; groups with headers, drill-in with a breadcrumb row, color by branch or by a value through a color scale, tiles that grow, glide and shrink on change, keyboard tiles, tooltip and a data table.",
  composedOf: ["Breadcrumbs"],
  behaviors: ["keyboard points"],
  hubs: [],
});
