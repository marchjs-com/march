import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "TypingIndicator",
  status: "experimental",
  category: "social",
  since: "0.1.0",
  summary: "Three dots lifting in turn (motion engine) and an optional \"… is typing\" line; a polite status for screen readers.",
  composedOf: ["StatusDot"],
  behaviors: ["motion engine"],
  showcase: "/social",
});
