import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "TreeEditor",
  status: "experimental",
  frozen: "2026-11-20",
  category: "composite",
  since: "0.1.0",
  summary: "JSON value as an editable tree: HADİ-colored type badges (click to convert), inline key / value editing, add / duplicate / delete, search, schema checks, own undo history.",
  composedOf: ["Badge", "IconButton", "Toggle", "TextInput", "SearchBox", "OptionList", "UndoRedo", "Empty", "EditorFrame", "Popover"],
  behaviors: ["UndoManager (undoHistory)", "floating (type menu)", "json-path (pointers, schema subset)"],
  hubs: [],
  showcase: "/editors",
});
