import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "DockLayout",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "IDE workspace: split areas of tab groups; drag tabs to a side, centre, between tabs or out (floating); maximize, minimize to a tray, save / load, keyboard docking, RTL.",
  composedOf: ["Splitter", "Tabs", "Portal"],
  behaviors: ["motion engine", "command manager", "storage (get / set)"],
  hubs: [],
  showcase: "/ide",
});
