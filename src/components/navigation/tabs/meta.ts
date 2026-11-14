import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Tabs",
  status: "stable",
  since: "0.1.0",
  summary: "Tabbed panels: roving focus (← → Home End, mirrored in RTL), badges, disabled and hidden tabs, the active tab optionally kept in the URL.",
  category: "navigation",
  composedOf: ["Badge"],
  behaviors: ["roving focus"],
  showcase: "/navigation",
});
