import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "NotForYou",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Anti-landing block: who the product is not for (and who it is for); the visitor can mark the lines that apply and gets an honest verdict.",
  composedOf: [],
  behaviors: ["role=checkbox", "aria-live verdict"],
  showcase: "/web",
  demoGroup: "sell",
});
