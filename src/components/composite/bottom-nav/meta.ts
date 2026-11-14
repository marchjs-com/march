import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "BottomNav",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "Mobile tab bar: sliding colored bubble, count / dot badges, raised Create button with a turning four-color HADİ ring.",
  composedOf: ["Badge", "OverflowText", "ListRow", "Drawer"],
  behaviors: ["motion engine"],
  hubs: ["d"],
  showcase: "/navigation",
});
