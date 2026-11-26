import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "PhoneInput",
  status: "stable",
  since: "0.1.0",
  summary: "Phone number kept as \"+\" and digits; the country code is a prefix.",
  category: "forms",
  composedOf: ["TextInput"],
  behaviors: ["mask"],
  hubs: [],
});
