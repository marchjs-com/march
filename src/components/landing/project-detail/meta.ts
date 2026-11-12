import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ProjectDetail",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "One project: title, facts (KeyValue, service Chips), shared-element cover, story, Lightbox gallery, next project.",
  composedOf: ["Button", "KeyValue", "Chip", "openMedia", "Reveal"],
  behaviors: ["sharedTransition"],
  showcase: "/web",
});
