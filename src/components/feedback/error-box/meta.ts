import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ErrorBox",
  status: "stable",
  frozen: "2026-11-20",
  since: "0.1.0",
  summary: "What went wrong, in words (an Error, a message or any value), with an optional title and a retry button.",
  category: "feedback",
  composedOf: ["Alert", "Button"],
  behaviors: [],
  hubs: [],
});
