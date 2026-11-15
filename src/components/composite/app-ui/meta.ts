import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "AppUI",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "march-app-ui, the core of March IDE: a top bar (title, your tools, the Layout menu with presets, saved layouts and the panel list) over a DockLayout; plugins add file types (the code editor opens code files), panels, commands and services.",
  composedOf: ["DockLayout", "Menu", "CodeEditor"],
  behaviors: ["storage (get / set)", "plugins (file types, panels, commands, services)", "command manager"],
  hubs: [],
  showcase: "/app-ui",
});
