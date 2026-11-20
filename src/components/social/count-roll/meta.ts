import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "CountRoll",
  status: "experimental",
  frozen: "2026-11-20",
  category: "social",
  since: "0.1.0",
  summary: "Odometer number: only the changed digits roll (up when it grows, down when it shrinks), compact in the active locale.",
  composedOf: [],
  behaviors: ["motion engine", "pipes (number, compact)"],
  showcase: "/social",
});
