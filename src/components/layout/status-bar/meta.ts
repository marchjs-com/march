import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "StatusBar",
  status: "experimental",
  category: "layout",
  since: "0.1.0",
  summary: "Bottom strip of an editor or app: start / end items, text or buttons (actions or command ids), tones with a breathing busy dot, live announcements, low-priority items to a … menu when narrow.",
  composedOf: ["ListRow", "Menu", "Tooltip", "StatusDot"],
  behaviors: ["command manager", "fit (ui/fit)", "motion engine"],
  hubs: [],
  showcase: "/ide",
});
