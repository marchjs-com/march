import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ChatThread",
  status: "experimental",
  frozen: "2026-11-20",
  category: "composite",
  since: "0.1.0",
  summary: "Conversation: ChatBubble runs per sender, day separators, TypingIndicator, ReactionPicker under a message, send / arrive motion, stick to bottom with a \"N new\" jump.",
  composedOf: ["ChatBubble", "TypingIndicator", "ReactionPicker", "Avatar", "Button", "Picture"],
  behaviors: ["motion engine", "For (keyed)"],
  showcase: "/social",
});
