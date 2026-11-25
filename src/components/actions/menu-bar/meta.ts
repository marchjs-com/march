import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "MenuBar",
  status: "experimental",
  since: "0.4.0",
  summary: "Application menu bar (File, Edit, View…): Menu entries with nested submenus, one Tab stop, arrow keys across menus and into submenus (RTL mirrored), Alt + first letter, hover switching while open.",
  category: "actions",
  composedOf: ["Button", "Popover", "ListRow", "Chevron", "Menu"],
  behaviors: ["positioning", "roving focus", "action"],
  hubs: [],
});
