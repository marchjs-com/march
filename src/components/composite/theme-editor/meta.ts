import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ThemeEditor",
  status: "experimental",
  frozen: "2026-11-20",
  category: "composite",
  since: "0.1.0",
  summary: "Theme builder: color tokens for light and dark with a WCAG audit, type, shape and motion, a live scoped preview, code / CSS / JSON out.",
  composedOf: ["ColorPicker", "EasingCurveEditor", "Tabs", "Segmented", "Slider", "Select", "FontPicker", "TextInput", "Textarea", "Toggle", "Field", "Button", "UndoRedo", "CopyButton", "Badge", "PanelHeader", "SectionLabel", "ListRow", "Swatch", "Stack", "ThemeSwatch", "CodeView", "Alert", "Card", "Checkbox", "Chip", "Progress", "Avatar"],
  behaviors: [],
  hubs: [],
  showcase: "/themes",
  barrel: false,
});
