import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Newsletter",
  status: "experimental",
  since: "0.1.0",
  summary: "Email sign-up, inline or stacked: validation, busy button, success check that pops in, error shake and announcement.",
  composedOf: ["TextInput", "Button"],
  behaviors: ["motion engine"],
  showcase: "/web",
});
