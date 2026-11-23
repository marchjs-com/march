import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "PeriodNav",
  status: "experimental",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Previous · today · next for a calendar period, with the period's name between the arrows on request; arrows swap in right-to-left, own texts, icons, today button and colour.",
  category: "navigation",
  composedOf: ["ButtonGroup", "IconButton", "Button"],
  behaviors: [],
  hubs: [],
});
