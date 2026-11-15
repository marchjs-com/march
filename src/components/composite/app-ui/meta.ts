import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "AppUI",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "march-app-ui, the core of March IDE: a top bar (title, your tools, the Layout menu with presets, saved layouts and the panel list) over a DockLayout.",
  composedOf: ["DockLayout", "Menu"],
  behaviors: ["storage (get / set)"],
  hubs: [],
  showcase: "/app-ui",
});
