import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "LinkCard",
  status: "stable",
  since: "0.1.0",
  summary: "A card that is one link: icon tile (or own lead), title, description, a small text at the end and an arrow on hover.",
  category: "navigation",
  composedOf: ["IconTile", "OverflowText", "Link"],
  behaviors: [],
  hubs: [],
  showcase: "/data",
});
