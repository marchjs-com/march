import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "StatsBand",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Row of big numbers that count up (or roll) when visible, with labels and notes; plain, divided or cards.",
  composedOf: ["Counter", "Reveal"],
  showcase: "/web",
  demoGroup: "hero",
});
