import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "FlowPalette",
  status: "experimental",
  category: "composite",
  entry: "hadi-march/flow",
  since: "0.1.0",
  summary: "Node types of a flow by category with search; drag onto a FlowCanvas (snapped where dropped) or press Enter to add.",
  composedOf: ["SearchBox", "OverflowText"],
  behaviors: ["motion engine", "drag layer", "fold search"],
  hubs: ["h"],
  showcase: "/flow",
});
