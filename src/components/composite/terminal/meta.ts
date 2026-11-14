import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Terminal",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "Extensible command line: typed commands, sub-commands and async handlers (Ctrl+C), ANSI colors, tables, JSON, progress; history, completion, themable colors.",
  composedOf: ["JsonView", "Window", "Progress", "Spinner"],
  behaviors: ["history (localStorage)", "tab completion", "lazy (JSON output)", "stickToBottom"],
  hubs: [],
  showcase: "/editors",
});
