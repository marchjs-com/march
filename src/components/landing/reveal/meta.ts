import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Reveal",
  status: "experimental",
  frozen: "2026-11-20",
  category: "landing",
  since: "0.1.0",
  summary: "Scroll entrance for any block: fade, rise, slide (RTL mirrored), scale, blur, flip; stagger; scrub follows the scroll.",
  composedOf: [],
  behaviors: ["motion engine", "scrollTimeline", "onVisible"],
  showcase: "/web",
  demoGroup: "hero",
});
