import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Roadmap",
  status: "experimental",
  frozen: "2026-11-20",
  category: "landing",
  since: "0.1.0",
  summary: "Timeline whose line fills with the scroll: done / now / next statuses, passed dots light up; roadmaps, stories, work history.",
  composedOf: ["Timeline", "Badge", "Progress", "Reveal"],
  behaviors: ["scrollIndicator", "onScrollProgress"],
  showcase: "/web",
  demoGroup: "scroll",
});
