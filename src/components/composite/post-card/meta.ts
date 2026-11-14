import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "PostCard",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "Feed post: author header with ⋯ menu, MediaGrid, double-tap like with a large heart burst, LikeButton and rolling counts, caption folded to three lines.",
  composedOf: ["Avatar", "Menu", "MediaGrid", "LikeButton", "CountRoll", "Button", "ClampText", "ListRow", "VerifiedMark"],
  behaviors: ["motion engine", "pipes (relative)"],
  showcase: "/social",
});
