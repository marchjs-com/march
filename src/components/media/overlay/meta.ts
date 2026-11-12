import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Overlay",
  status: "stable",
  since: "0.1.0",
  summary: "A decorative layer inside its container: an image, a muted looping video, an SVG, a canvas drawing or a CSS effect (glass, mesh, noise …); never takes input.",
  category: "media",
  composedOf: [],
  behaviors: ["motion engine"],
  hubs: [],
  showcase: "/overlay",
});
