import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ListEditor",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Edit a list of strings: add, edit, reorder, remove; pasted lines become items.",
  category: "forms",
  composedOf: ["TextInput", "RowTools", "Button"],
  behaviors: [],
  hubs: [],
});
