import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ChatBubble",
  status: "experimental",
  category: "social",
  since: "0.1.0",
  summary: "Chat message: Aktivite gradient (mine) or card (theirs), run corners with a tail, sender color, reply quote, emoji-only size, time and ticks, reaction chips, drag to reply.",
  composedOf: [],
  behaviors: ["motion engine", "pipes (time)"],
  showcase: "/social",
});
