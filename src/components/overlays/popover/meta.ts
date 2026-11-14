import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Popover",
  status: "experimental",
  since: "0.1.0",
  summary: "A trigger and a floating panel: placed beside the trigger, closed by an outside press or Escape, focus in and back; own or controlled open state, title bar, footer, entrance choices.",
  category: "overlays",
  composedOf: ["PanelHeader", "Button"],
  behaviors: ["dismiss", "positioning"],
  hubs: [],
  showcase: "/overlays",
});
