import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Layout",
  status: "stable",
  since: "0.1.0",
  summary: "The frame all pages of an app share: content plus the page corner (BottomRightControls) with its back-to-top button; Page builds on it.",
  category: "layout",
  composedOf: ["Button", "Badge", "Progress", "ScrollToTop"],
  behaviors: [],
  showcase: "/layout",
});
