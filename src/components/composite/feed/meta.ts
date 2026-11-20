import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Feed",
  status: "experimental",
  frozen: "2026-11-20",
  category: "composite",
  since: "0.1.0",
  summary: "Social feed: PostCards in a VirtualList inside PullToRefresh; skeleton first page and next page, infinite scroll, \"N new posts\" pill, end mark.",
  composedOf: ["PullToRefresh", "VirtualList", "PostCard", "Skeleton", "Button", "Empty", "StatusDot"],
  behaviors: ["motion engine"],
  showcase: "/social",
});
