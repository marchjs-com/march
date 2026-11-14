import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Carousel",
  status: "stable",
  since: "0.1.0",
  summary: "Scroll-snap carousel: one to four slides per view, previous / next buttons and dots, swipe on touch, one slide on phones.",
  category: "media",
  composedOf: ["IconButton", "PageDots"],
  behaviors: [],
  hubs: [],
  showcase: "/overlay",
});
