import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "VideoBackground",
  status: "experimental",
  since: "0.1.0",
  summary: "Muted looping video behind content: poster first (and on save-data / reduced motion), plays only while visible, readable tint, pause button.",
  composedOf: ["Overlay", "IconButton"],
  showcase: "/web",
});
