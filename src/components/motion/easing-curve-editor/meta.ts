import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "EasingCurveEditor",
  status: "experimental",
  category: "motion",
  since: "0.1.0",
  summary: "Cubic-bezier easing editor: draggable handles, the engine's named curves as presets, live preview on the motion engine clock, registers the curve by name (defineEasing).",
  composedOf: ["Card", "Button", "NumberInput"],
  behaviors: ["motion engine (ease, defineEasing, onFrame)", "drag"],
  hubs: [],
  showcase: "/editors",
});
