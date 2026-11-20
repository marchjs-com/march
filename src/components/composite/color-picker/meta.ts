import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ColorPicker",
  status: "experimental",
  frozen: "2026-11-20",
  category: "composite",
  since: "0.1.0",
  summary: "Advanced color picker: saturation / brightness area, hue and alpha sliders, eyedropper, HADİ / theme / recent palettes, hex · rgb · hsl input, WCAG contrast.",
  composedOf: ["IconButton", "Segmented", "Badge", "SectionLabel", "Slider", "Swatch", "TextInput"],
  behaviors: ["drag", "motion engine color parser", "theme contrast"],
  hubs: [],
  showcase: "/editors",
});
