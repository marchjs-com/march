import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Roadmap",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Timeline whose line fills with the scroll: done / now / next statuses, passed dots light up; roadmaps, stories, work history.",
  composedOf: ["Timeline", "Badge", "Reveal"],
  behaviors: ["scrollScene"],
  showcase: "/web",
});
