import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "StoryProgress",
  status: "experimental",
  category: "social",
  since: "0.1.0",
  summary: "Segmented story bars (a line Progress): done, current filling over its duration on the motion engine (pause holds it), onDone when full; RTL fills from the right.",
  composedOf: ["Progress"],
  behaviors: ["motion engine (essential)"],
  showcase: "/social",
});
