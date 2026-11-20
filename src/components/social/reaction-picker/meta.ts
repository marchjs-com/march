import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ReactionPicker",
  status: "experimental",
  frozen: "2026-11-20",
  category: "social",
  since: "0.1.0",
  summary: "Emoji row (reactions) or grid (emoji panel): pop-in with staggered emoji, picked one on a soft circle, arrow keys (RTL mirrored), optional +.",
  composedOf: ["IconButton"],
  behaviors: ["motion engine", "roving focus"],
  showcase: "/social",
});
