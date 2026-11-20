import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "CodeEditor",
  status: "experimental",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "A code field with an IDE's comfort: coloured as it is typed (bracket pairs, indent guides, the caret's line, the word's other places), pairs that close themselves, find and replace, go to line, a suggestion list at the caret, marked ranges, a foot line with a status and a copy button.",
  category: "composite",
  composedOf: ["EditorFrame", "Popover", "OptionList", "CopyButton", "Dropdown", "Kbd", "StatusDot", "Chip", "TextInput", "IconButton", "Button"],
  behaviors: ["list-nav"],
  hubs: [],
  showcase: "/editors",
});
