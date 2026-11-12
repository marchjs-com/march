import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Counter",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Animated number: counts up when visible, glides to new values, or rolls each digit like an odometer; Intl formatted.",
  composedOf: [],
  behaviors: ["motion engine", "onVisible", "Intl.NumberFormat"],
  showcase: "/web",
});
