import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "HorizontalScroll",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Pinned section whose panels slide sideways while the page scrolls down; progress line; native snap scroller on touch.",
  composedOf: [],
  behaviors: ["scrollScene"],
  showcase: "/web",
  demoGroup: "scroll",
});
