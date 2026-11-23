import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Card",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Surface with an optional header (title, subtitle, actions), a body and a footer; action() objects in the header render as buttons.",
  category: "data",
  composedOf: ["PanelHeader"],
  behaviors: [],
  hubs: [],
});
