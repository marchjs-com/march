import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "VirtualList",
  status: "experimental",
  frozen: "2026-11-20",
  category: "data",
  since: "0.1.0",
  summary: "Long list with rows of any height: only the rows near the viewport are in the DOM, measured rows, scroll anchoring, own or parent scroll, onEndReached.",
  composedOf: [],
  behaviors: ["ResizeObserver", "motion engine frame (measure)"],
});
