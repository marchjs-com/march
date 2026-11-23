import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Toast",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "Short, non-blocking messages: toast(message, { kind, action, timeout }) returns an id; undo actions, up to five stacked, a host mounts itself.",
  category: "overlays",
  composedOf: ["Portal", "Alert", "Button"],
  behaviors: [],
  hubs: [],
});
