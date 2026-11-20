import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "DatePicker",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Typed date in the locale's order with a Calendar popover; ISO value, never an invalid date.",
  category: "forms",
  composedOf: ["Calendar", "IconButton", "Popover"],
  behaviors: [],
  hubs: [],
  showcase: "/forms",
});
