import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Scheduler",
  category: "data",
  status: "experimental",
  frozen: "2026-11-20",
  since: "0.2.0",
  summary: "Month / week / day calendar: drag events to move, drag edges to resize, drag empty slots to create; Intl dates, first day of week from the locale, keyboard moves.",
  composedOf: ["PanelHeader", "PeriodNav", "Button", "Segmented", "ResizeHandle", "LiveStatus"],
  behaviors: ["date", "pointerDrag"],
  hubs: ["j"],
  showcase: "/big-data",
  barrel: false,
});
