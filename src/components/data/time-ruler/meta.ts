import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "TimeRuler",
  status: "experimental",
  since: "0.1.0",
  summary: "The ruler above a timeline: ticks, time labels and a playhead; read-only, or draggable with a slider playhead (onSeek). Own tick distances, labels, head and colour.",
  category: "data",
  composedOf: [],
  behaviors: ["drag (track)"],
  hubs: [],
  showcase: "/data",
});
