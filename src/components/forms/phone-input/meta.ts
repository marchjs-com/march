import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "PhoneInput",
  status: "stable",
  frozen: "2026-11-26",
  since: "0.1.0",
  summary: "Phone number kept as \"+\" and digits; the country code is a prefix.",
  category: "forms",
  composedOf: ["TextInput"],
  behaviors: ["mask"],
  hubs: [],
});
