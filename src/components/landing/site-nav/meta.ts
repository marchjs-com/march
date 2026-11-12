import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "SiteNav",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Website top bar: sticky, transparent-to-glass or floating pill, shrinks and hides on scroll, sliding link pill, Drawer menu on phones.",
  composedOf: ["Brand", "IconButton", "openDrawer"],
  behaviors: ["scrollScene", "motion engine"],
  showcase: "/web",
  demoGroup: "frame",
});
