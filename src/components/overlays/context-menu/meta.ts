import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ContextMenu",
  status: "experimental",
  category: "overlays",
  entry: "march/context-menu",
  since: "0.1.0",
  summary: "Right-click / Shift+F10 menu anchored to the pointer: the same items, actions and keyboard as Menu, chosen per target.",
  composedOf: ["Menu"],
  behaviors: ["positioning", "roving focus"],
  hubs: [],
  showcase: "/flow",
});
