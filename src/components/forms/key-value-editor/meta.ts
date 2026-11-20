import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "KeyValueEditor",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Edit key → value rows as an object; order kept, duplicate keys flagged, numbers on request.",
  category: "forms",
  composedOf: ["TextInput", "RowTools", "Button"],
  behaviors: [],
  hubs: [],
  showcase: "/forms",
});
