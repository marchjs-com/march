import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Reveal",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Scroll entrance for any block: fade, rise, slide (RTL mirrored), scale, blur, flip; stagger; scrub follows the scroll.",
  composedOf: [],
  behaviors: ["motion engine", "scrollScene", "onVisible"],
  showcase: "/web",
});
