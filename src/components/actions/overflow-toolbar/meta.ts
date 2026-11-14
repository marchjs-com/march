import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "OverflowToolbar",
  status: "experimental",
  category: "actions",
  since: "0.1.0",
  summary: "Toolbar whose items that do not fit go to a More menu (lowest priority first); command ids from the Command manager, toggles, separators, roving focus.",
  composedOf: ["Button", "IconButton", "Divider", "Menu", "Tooltip"],
  behaviors: ["command manager", "fit (ui/fit)", "roving focus", "motion engine"],
  hubs: [],
  showcase: "/ide",
});
