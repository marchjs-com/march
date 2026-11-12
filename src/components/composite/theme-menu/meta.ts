import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ThemeMenu",
  status: "stable",
  since: "0.1.0",
  summary: "One top-bar menu for the whole look: light / dark / system, the color theme with live swatches and the accent color.",
  category: "composite",
  composedOf: ["Dropdown", "ThemeSwatch", "OverflowText"],
  behaviors: [],
  hubs: [],
  showcase: "/themes",
});
