import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "TextInput",
  status: "stable",
  frozen: "2026-11-26",
  since: "0.1.0",
  summary: "Single-line text with prefix / suffix; EmailInput and UrlInput set the keyboard, autocomplete and trimming.",
  category: "forms",
  composedOf: [],
  behaviors: ["mask"],
  hubs: [],
});
