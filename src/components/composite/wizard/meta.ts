import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Wizard",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "One form split into steps: each step validates its own fields before Next, values survive Back, a later step opens once the ones before it pass.",
  category: "composite",
  composedOf: ["Steps", "Progress", "Button", "Alert"],
  behaviors: [],
  hubs: [],
  showcase: "/forms",
  // the form engine comes with it: kept out of the march/ui barrel (march/forms exports it)
  barrel: false,
});
