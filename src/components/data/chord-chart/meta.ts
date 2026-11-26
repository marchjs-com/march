import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ChordChart",
  status: "experimental",
  category: "data",
  entry: "march/charts",
  since: "0.4.0",
  summary: "Chord diagram: groups as arcs on a ring, ribbons through the middle for the flows between them (directed with arrows or undirected), hover a group to keep only its ribbons; arcs and ribbons open from zero, turn to new angles and collapse when they go; keyboard, tooltip and a data table.",
  composedOf: [],
  behaviors: ["keyboard points"],
  hubs: [],
});
