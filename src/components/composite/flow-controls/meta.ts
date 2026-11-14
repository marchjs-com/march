import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "FlowControls",
  status: "experimental",
  category: "composite",
  entry: "hadi-march/flow",
  since: "0.1.0",
  summary: "Run / pause / step / reset a flow with speed and state; runner (createFlowRunner) drives glow, shake and edge counters; FlowTimeline records the run.",
  composedOf: ["Button", "IconButton", "Segmented", "Chip", "Card", "TimeRuler", "ListRow", "Badge", "Empty"],
  behaviors: ["motion engine clock"],
  hubs: ["d"],
  showcase: "/flow",
});
