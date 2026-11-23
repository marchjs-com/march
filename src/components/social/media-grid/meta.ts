import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "MediaGrid",
  status: "experimental",
  frozen: "2026-11-20",
  category: "social",
  since: "0.1.0",
  summary: "Post photos: 1 at its own shape, 2 side by side, 3 big + stacked, 4 as 2×2, more with +N; Skeleton until loaded; tap opens, double tap likes.",
  composedOf: ["Skeleton", "CornerMark", "Picture"],
  behaviors: ["motion engine (fade-in through tokens)"],
});
