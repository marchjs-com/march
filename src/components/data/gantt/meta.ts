import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Gantt",
  status: "experimental",
  since: "0.2.0",
  summary: "Project timeline: bars with progress, finish-to-start dependency arrows, drag to move / resize / set progress with cascading successors, today line, day / week / month scales.",
  composedOf: [],
  behaviors: ["date", "pointerDrag"],
  hubs: ["j"],
  showcase: "/big-data",
  barrel: false,
});
