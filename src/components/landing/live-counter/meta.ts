import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "LiveCounter",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "A number that grows while you watch: fed by a signal or simulated with a rate per minute on the motion clock (only while visible); odometer digits and a live dot.",
  composedOf: ["Counter", "Badge", "StatusDot"],
  behaviors: ["motion engine", "IntersectionObserver"],
  showcase: "/web",
  demoGroup: "proof",
});
