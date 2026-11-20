import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "DevicePicker",
  status: "experimental",
  frozen: "2026-11-20",
  since: "0.2.0",
  summary: "Choose a device to preview on: dozens of phones, tablets and desktop screens with their silhouette, size and pixel ratio; search, groups, portrait / landscape and your own devices.",
  category: "layout",
  composedOf: ["SearchBox", "Segmented", "ListRow", "SectionLabel", "Empty", "Field", "TextInput", "NumberInput", "Toggle", "Button", "IconButton"],
  behaviors: [],
  showcase: "/layout",
});
