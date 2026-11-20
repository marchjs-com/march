import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ImageCropper",
  status: "experimental",
  frozen: "2026-11-20",
  category: "composite",
  since: "0.1.0",
  summary: "Image cropper: centered resizable frame, pan, zoom (wheel, slider, keys), 90° and fine rotation, mirror, aspect ratios; the image always covers the frame; canvas / Blob output.",
  composedOf: ["Card", "Segmented", "Slider", "IconButton"],
  behaviors: ["drag", "canvas output"],
  hubs: [],
  showcase: "/editors",
});
