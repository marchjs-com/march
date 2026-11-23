import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Kanban",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Board of columns with toned headers, counts and cards you move by drag and drop or Alt+← / Alt+→.",
  category: "data",
  composedOf: ["PanelHeader", "StatusDot", "Badge"],
  behaviors: ["drag"],
  hubs: [],
});
