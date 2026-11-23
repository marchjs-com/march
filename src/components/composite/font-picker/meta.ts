import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "FontPicker",
  status: "experimental",
  frozen: "2026-11-20",
  category: "composite",
  since: "0.1.0",
  summary: "Font picker: device fonts and the Google Fonts catalog in one searchable list, each name in its own type, a specimen with your sample text, category / subset / order filters, favourites and recent picks; popover, dialog or inline.",
  composedOf: ["Popover", "Dialog", "SearchBox", "Segmented", "Select", "VirtualList", "ListRow", "SectionLabel", "IconButton", "Button", "Textarea", "Slider", "Toggle", "CopyButton", "Alert", "Empty"],
  behaviors: ["list-nav", "lazy font catalog", "storage"],
  hubs: [],
});
