import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "SearchBox",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Search field: icon, debounced input, clear button, shortcut hint; sm size, plain look, combobox ARIA for driving a list of options.",
  category: "forms",
  composedOf: ["IconButton", "Kbd"],
  behaviors: [],
  hubs: [],
});
