import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ChoicePicker",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Single choice that picks its own look: segmented, chips, preview cards or a combobox, never a drop-down for a few values.",
  category: "forms",
  composedOf: ["Segmented","RadioGroup","Combobox"],
  behaviors: [],
  hubs: [],
  showcase: "/forms",
});
