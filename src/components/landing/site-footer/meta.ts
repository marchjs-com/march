import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "SiteFooter",
  status: "experimental",
  category: "landing",
  since: "0.1.0",
  summary: "Website footer: brand and about line, link columns, social links, optional Newsletter, legal row, back-to-top, big wordmark.",
  composedOf: ["Brand", "Newsletter", "IconButton"],
  showcase: "/web",
  demoGroup: "frame",
});
