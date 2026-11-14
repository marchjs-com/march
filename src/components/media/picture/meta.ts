import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Picture",
  status: "experimental",
  since: "0.1.0",
  summary: "An image from a picture object ({ src, alt, width, height, srcset, sizes }) or a ready node passed through: lazy by default, eager for the first screen, fit and a fallback.",
  category: "media",
  composedOf: [],
  behaviors: [],
  hubs: [],
  showcase: "/overlay",
});
