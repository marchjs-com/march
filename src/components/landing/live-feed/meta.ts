import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "LiveFeed",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Living wall: new activity slides in, the oldest leaves; pulls from next() on the motion clock while visible, pauses on hover, focus or the Pause button.",
  composedOf: ["Avatar", "Button", "ListRow", "StatusDot"],
  behaviors: ["motion engine", "IntersectionObserver", "WCAG 2.2.2 pause"],
  showcase: "/web",
  demoGroup: "proof",
});
