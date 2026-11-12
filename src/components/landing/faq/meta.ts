import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Faq",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Questions in an Accordion, centered or split with a sticky heading; optional SearchBox with fuzzy, accent-insensitive ranking.",
  composedOf: ["Accordion", "SearchBox", "Reveal"],
  behaviors: ["fold / rank"],
  showcase: "/web",
  demoGroup: "sell",
});
