import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Pagination",
  status: "stable",
  since: "0.1.0",
  summary: "Numbered pages with ellipses and Previous / Next (the current page marked for screen readers), or a simple Previous / Next pager that also works without a page count.",
  category: "navigation",
  composedOf: ["Button", "IconButton", "Select"],
  behaviors: [],
  showcase: "/navigation",
});
