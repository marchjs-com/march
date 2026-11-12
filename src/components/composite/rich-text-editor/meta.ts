import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "RichTextEditor",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "Contenteditable rich text with Markdown in / out: toolbar, links, lists, headings, quotes, @mentions, :emoji, clean paste, own undo history.",
  composedOf: ["Toolbar", "IconButton", "Avatar"],
  behaviors: ["safe content core (dom/safe, dom/sanitize, dom/markdown, dom/to-markdown)", "UndoManager (undoHistory)", "floating"],
  hubs: [],
  showcase: "/editors",
});
