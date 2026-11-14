import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "NavMenu",
  status: "stable",
  since: "0.1.0",
  summary: "Sidebar navigation for apps: collapsible groups, pinned and recent items, a filter box, the active item from the router; a drawer on narrow screens.",
  category: "navigation",
  composedOf: ["ListRow", "IconButton", "SearchBox", "Badge", "Chevron", "SectionLabel", "Empty", "Drawer"],
  behaviors: ["router", "fold search", "storage"],
  showcase: "/navigation",
});
