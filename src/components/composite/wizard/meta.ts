import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Wizard",
  status: "stable",
  since: "0.1.0",
  summary: "One form split into steps: each step validates its own fields before Next, values survive Back, a later step opens once the ones before it pass.",
  category: "composite",
  composedOf: ["Steps", "Progress"],
  behaviors: [],
  hubs: [],
  showcase: "/forms",
  // the form engine comes with it: kept out of the hadi-march/ui barrel (hadi-march/forms exports it)
  barrel: false,
});
