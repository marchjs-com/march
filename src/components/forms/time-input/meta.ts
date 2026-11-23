import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "TimeInput",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Time field (\"HH:MM\", seconds with step), with min / max; picker=\"clock\" adds a clock dial: the hour on a clock face, then the minutes.",
  category: "forms",
  composedOf: ["IconButton", "Popover"],
  behaviors: ["slider keyboard"],
  hubs: [],
});
