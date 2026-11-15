import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "IconPicker",
  status: "experimental",
  category: "forms",
  since: "0.1.0",
  summary: "Choose an icon: a button with the chosen icon and its name opens a panel with a search, filter chips and a grid of every icon.",
  composedOf: ["Dropdown", "SearchBox", "Chip", "IconButton", "Empty"],
  behaviors: [],
  hubs: [],
  showcase: "/forms",
});
