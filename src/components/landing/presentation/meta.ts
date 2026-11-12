import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Presentation",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Slides: keys, wheel, swipe, step-by-step fragments, slide / fade / zoom, full screen, URL index, speaker window (cross-tab), print.",
  composedOf: ["IconButton"],
  behaviors: ["motion engine", "swipe", "channel (crossTab)"],
  showcase: "/web",
  demoGroup: "scroll",
});
