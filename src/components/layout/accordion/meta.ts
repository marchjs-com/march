import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Accordion",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Stacked sections that open one at a time or several together: animated height, ↑ ↓ Home End between headers, separated or contained look.",
  category: "layout",
  composedOf: ["ListRow", "Chevron"],
  behaviors: ["roving focus"],
});
