import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Stepper",
  status: "experimental",
  category: "navigation",
  since: "0.1.0",
  summary: "Steps with motion: a liquid highlight stretches from step to step, panels morph (blur + slide by direction, RTL mirrored) while the frame's height follows; Back / Next.",
  composedOf: ["Steps", "Button"],
  behaviors: ["motion engine"],
  hubs: ["d"],
  showcase: "/navigation",
});
