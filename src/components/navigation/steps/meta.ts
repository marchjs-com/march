import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Steps",
  status: "stable",
  since: "0.1.0",
  summary: "Progress through stages: done, current and upcoming steps with titles and descriptions; clickable when onSelect is given; horizontal or vertical.",
  category: "navigation",
  composedOf: ["CheckMark"],
  behaviors: [],
  showcase: "/navigation",
});
