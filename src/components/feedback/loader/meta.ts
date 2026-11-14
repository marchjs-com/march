import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Loader",
  status: "stable",
  since: "0.1.0",
  summary: "A full-area loading state (a large spinner and a line of text), inline or over its container; bootLoader hides the static boot screen.",
  category: "feedback",
  composedOf: ["Spinner"],
  behaviors: [],
  hubs: [],
  showcase: "/feedback",
});
