import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ChatComposer",
  status: "experimental",
  frozen: "2026-11-20",
  category: "composite",
  since: "0.1.0",
  summary: "Message field: attach Menu (+ turns 45°), growing Textarea, emoji panel (ReactionPicker grid), mic ↔ send morph, recording with timer and live waveform, reply preview.",
  composedOf: ["Menu", "Textarea", "ReactionPicker", "IconButton", "StatusDot", "ReplyQuote"],
  behaviors: ["motion engine"],
  showcase: "/social",
});
