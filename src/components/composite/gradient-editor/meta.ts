import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "GradientEditor",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "CSS gradient builder: linear / radial / conic, angle dial, draggable color stops, ColorPicker for the selected stop, HADİ presets, CSS to copy.",
  composedOf: ["ColorPicker", "Segmented", "IconButton"],
  behaviors: ["drag"],
  hubs: [],
  showcase: "/editors",
});
