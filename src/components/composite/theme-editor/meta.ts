import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ThemeEditor",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "Theme builder: color tokens for light and dark with a WCAG audit, type, shape and motion, a live scoped preview, code / CSS / JSON out.",
  composedOf: ["ColorPicker", "EasingCurveEditor", "Tabs", "Segmented", "Slider", "Select", "TextInput", "Textarea", "Toggle", "Button", "IconButton", "CopyButton", "Badge", "ThemeSwatch", "CodeView"],
  behaviors: [],
  hubs: [],
  showcase: "/themes",
  barrel: false,
});
