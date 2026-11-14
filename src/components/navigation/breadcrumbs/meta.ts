import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Breadcrumbs",
  status: "experimental",
  category: "navigation",
  since: "0.1.0",
  summary: "Path bar: links, buttons or sibling menus per crumb; the middle collapses into a … menu when narrow; separators mirrored in RTL.",
  composedOf: ["Button", "Menu", "OverflowText"],
  behaviors: ["fit (ui/fit)"],
  hubs: [],
  showcase: "/ide",
});
