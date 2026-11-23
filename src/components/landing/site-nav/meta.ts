import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "SiteNav",
  status: "experimental",
  frozen: "2026-11-20",
  category: "landing",
  since: "0.1.0",
  summary: "Website top bar: sticky, transparent-to-glass or floating pill, shrinks and hides on scroll, sliding link pill, Drawer menu on phones.",
  composedOf: ["Brand", "IconButton", "openDrawer"],
  behaviors: ["hide-on-scroll", "onScrollProgress", "motion engine"],
});
