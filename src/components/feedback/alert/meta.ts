import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Alert",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "A message in one of five tones (info, success, warn, danger, neutral) with an optional title, icon and dismiss button; Notice is an alias.",
  category: "feedback",
  composedOf: ["IconButton"],
  behaviors: [],
  hubs: [],
  showcase: "/feedback",
});
