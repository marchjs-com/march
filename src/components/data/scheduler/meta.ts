import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Scheduler",
  status: "experimental",
  since: "0.2.0",
  summary: "Month / week / day calendar: drag events to move, drag edges to resize, drag empty slots to create; Intl dates, first day of week from the locale, keyboard moves.",
  composedOf: ["Button", "IconButton", "ButtonGroup", "Segmented"],
  behaviors: ["date", "pointerDrag"],
  hubs: ["j"],
  showcase: "/big-data",
  barrel: false,
});
