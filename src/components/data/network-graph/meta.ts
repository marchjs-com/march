import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "NetworkGraph",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Network graph: nodes and links in a force layout simulated on the motion clock (or a circle / grid), node size by value, color by group with legend toggles, drag to move and pin, zoom and pan, neighbour highlight, keyboard by direction, tooltip and a data table for screen readers.",
  composedOf: [],
  behaviors: ["keyboard points", "zoom", "pan", "pointerDrag", "motion engine frame (onFrame)", "chart motion (tween, presence)"],
  hubs: [],
});
