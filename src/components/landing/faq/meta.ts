import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Faq",
  status: "experimental",
  frozen: "2026-11-20",
  category: "landing",
  since: "0.1.0",
  summary: "Questions in an Accordion, centered or split with a sticky heading; optional SearchBox with fuzzy, accent-insensitive ranking.",
  composedOf: ["Accordion", "SearchBox", "Empty", "SectionHead"],
  behaviors: ["fold / rank"],
  showcase: "/web",
  demoGroup: "proof",
});
