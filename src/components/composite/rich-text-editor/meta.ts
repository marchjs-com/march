import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "RichTextEditor",
  status: "experimental",
  frozen: "2026-11-20",
  category: "composite",
  since: "0.1.0",
  summary: "Contenteditable rich text with Markdown in / out: toolbar, links, lists, headings, quotes, @mentions, :emoji, clean paste, own undo history.",
  composedOf: ["EditorFrame", "FormatToolbar", "IconButton", "Avatar", "Popover", "OptionList", "Field", "TextInput"],
  behaviors: ["safe content core (dom/safe, dom/sanitize, dom/markdown, dom/to-markdown)", "UndoManager (undoHistory)", "floating"],
  hubs: [],
  showcase: "/editors",
});
