import { defineMeta } from "../meta.ts";

export default defineMeta({
  name: "PullToRefresh",
  status: "experimental",
  since: "0.1.0",
  summary: "Pull a scroll area down (touch or mouse) past a threshold to run an async refresh; spinning indicator, keyboard button, live status.",
  composedOf: [],
  behaviors: ["motion engine", "pointer drag"],
  hubs: ["d"],
  showcase: "/navigation",
});
