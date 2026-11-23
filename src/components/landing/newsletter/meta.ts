import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Newsletter",
  status: "experimental",
  frozen: "2026-11-20",
  category: "landing",
  since: "0.1.0",
  summary: "Email sign-up, inline or stacked: validation, busy button, success check that pops in, error shake and announcement.",
  composedOf: ["TextInput", "Button", "CheckMark", "SectionHead"],
  behaviors: ["motion engine"],
});
