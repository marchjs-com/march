import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ClampText",
  status: "experimental",
  since: "0.1.0",
  summary: "Text folded to N lines with a \"more\" / \"less\" switch shown only when it does not fit; controlled or not, own texts, fold only.",
  category: "typography",
  composedOf: ["Button"],
  behaviors: ["ResizeObserver"],
  hubs: [],
  showcase: "/buttons",
});
