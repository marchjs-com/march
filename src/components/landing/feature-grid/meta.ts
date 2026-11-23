import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "FeatureGrid",
  status: "experimental",
  frozen: "2026-11-20",
  category: "landing",
  since: "0.1.0",
  summary: "Product features as cards (pointer light), plain, a two-column list or a bento grid of mixed tile sizes; staggered entrance.",
  composedOf: ["Grid", "Card", "ListRow", "IconTile", "Reveal"],
});
