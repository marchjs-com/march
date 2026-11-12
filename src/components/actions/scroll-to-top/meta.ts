import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ScrollToTop",
  status: "stable",
  since: "0.1.0",
  category: "actions",
  summary: "Back-to-top button: shows after the page is scrolled down, scrolls back on the motion engine; puts itself into BottomRightControls.",
  composedOf: ["IconButton", "BottomRightControls"],
  behaviors: [],
  showcase: "/buttons",
});
