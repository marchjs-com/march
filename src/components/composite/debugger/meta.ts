import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Debugger",
  status: "experimental",
  frozen: "2026-11-20",
  category: "composite",
  since: "0.1.0",
  summary: "Debugger panel over a recording of instrumented code: Continue, Step over / into / out, Step back and a timeline (time travel); breakpoints with conditions and logpoints, debugger; statements, pause on exceptions; watches, scopes (local / closure / module) and the call stack at every stop.",
  composedOf: ["IconButton", "Slider", "Disclosure", "JsonView", "TextInput", "Checkbox", "Toggle", "Badge", "StatusDot", "Splitter", "CopyButton"],
  behaviors: ["recording (ring buffer)", "breakpoints, conditions, logpoints", "watches (evaluated per stop)", "persist (localStorage)"],
  hubs: [],
});
