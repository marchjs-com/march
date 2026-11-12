import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "FeatureGrid",
  status: "experimental",
  since: "0.1.0",
  summary: "Product features as cards (pointer light), plain, a two-column list or a bento grid of mixed tile sizes; staggered entrance.",
  composedOf: ["Grid", "Card", "IconTile", "Reveal"],
  showcase: "/web",
});
