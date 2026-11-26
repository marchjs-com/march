import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "PixelFont",
  status: "experimental",
  category: "media",
  since: "0.4.0",
  summary: "Text in March's own pixel fonts (5×7 with every Turkish letter, and a bolder 8×8) on a small LED screen, with `:heart:` pixel emoji inline; layoutText / wrapText lay LED text out for any LED part.",
  composedOf: ["LedMatrix"],
  behaviors: [],
  hubs: [],
});
