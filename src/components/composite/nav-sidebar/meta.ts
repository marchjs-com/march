import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "NavSidebar",
  status: "stable",
  since: "0.1.0",
  summary: "Side menu: categories, typo-tolerant search, recent and featured items, icon rail, resizable width, remembered state.",
  category: "composite",
  composedOf: ["ListRow", "SearchBox", "PanelHeader", "SectionLabel", "IconButton", "Button", "Badge", "Chevron", "Empty", "ResizeHandle"],
  behaviors: ["roving keys (ui/focus)", "scrollIntoArea"],
  hubs: [],
  showcase: "/navigation",
});
