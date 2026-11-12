import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Parallax",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Layered depth: every layer (image or node) moves at its own scroll speed and, optionally, with the mouse; transform only.",
  composedOf: ["Overlay"],
  behaviors: ["scrollScene", "motion engine clock"],
  showcase: "/web",
  demoGroup: "hero",
});
