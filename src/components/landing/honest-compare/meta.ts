import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "HonestCompare",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Comparison table that also shows where the product is behind: scored rows, ahead / even / behind summary, a filter for the losing rows and visible notes.",
  composedOf: [],
  behaviors: ["table semantics", "sticky first column"],
  showcase: "/web",
  demoGroup: "sell",
});
