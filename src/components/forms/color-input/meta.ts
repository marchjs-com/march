import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ColorInput",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Native color swatch plus a #RRGGBB text field, kept in sync.",
  category: "forms",
  composedOf: ["Swatch", "TextInput"],
  behaviors: [],
  hubs: [],
  showcase: "/forms",
});
