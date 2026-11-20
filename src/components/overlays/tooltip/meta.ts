import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Tooltip",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Short hint on hover (after a delay) and on keyboard focus, positioned by the popover engine and linked with aria-describedby; Esc hides it.",
  category: "overlays",
  composedOf: [],
  behaviors: ["positioning"],
  hubs: [],
  showcase: "/text",
});
