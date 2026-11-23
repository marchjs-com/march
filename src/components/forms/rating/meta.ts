import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Rating",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Star rating as a radio group: arrow keys (RTL mirrored), hover preview, half stars when read-only, any colour token.",
  category: "forms",
  composedOf: [],
  behaviors: ["roving focus"],
  hubs: [],
});
