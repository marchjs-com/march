import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "RadialBarChart",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Radial bar chart: concentric rings of round-capped bars on tracks, full circle or gauge arc, a max per chart or per row, the active ring's value in the middle; rings sweep in, morph and unwind, keyboard rings, tooltip and a data table for screen readers.",
  composedOf: [],
  behaviors: ["keyboard points", "chart motion (tween, presence)"],
  hubs: [],
});
