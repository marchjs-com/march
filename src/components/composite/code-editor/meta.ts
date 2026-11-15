import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "CodeEditor",
  status: "experimental",
  since: "0.1.0",
  summary: "A small code field: coloured as it is typed, a suggestion list at the caret (prop names and values of a JSX tag, or your own), marked ranges that flash or underline, a foot line with a status and a copy button.",
  category: "composite",
  composedOf: ["EditorFrame", "Popover", "OptionList", "CopyButton", "Kbd", "StatusDot", "Chip"],
  behaviors: ["list-nav"],
  hubs: [],
  showcase: "/editors",
});
