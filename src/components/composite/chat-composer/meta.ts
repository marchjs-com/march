import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ChatComposer",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "Message field: attach Menu (+ turns 45°), growing Textarea, emoji panel (ReactionPicker grid), mic ↔ send morph, recording with timer and live waveform, reply preview.",
  composedOf: ["Menu", "Textarea", "ReactionPicker"],
  behaviors: ["motion engine"],
  showcase: "/social",
});
