import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "PostCard",
  status: "experimental",
  frozen: "2026-11-20",
  category: "composite",
  since: "0.1.0",
  summary: "Feed post: author header with ⋯ menu, MediaGrid, double-tap like with a large heart burst, LikeButton and rolling counts, caption folded to three lines.",
  composedOf: ["Card", "Avatar", "Menu", "MediaGrid", "LikeButton", "CountRoll", "Button", "ClampText", "ListRow", "VerifiedMark"],
  behaviors: ["motion engine", "pipes (relative)"],
});
