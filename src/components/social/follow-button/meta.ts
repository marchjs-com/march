import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "FollowButton",
  status: "experimental",
  category: "social",
  since: "0.1.0",
  summary: "Follow → Following / Requested with a morph: the pill's width springs, fill turns into outline, + turns into a tick, a four-color burst on follow; red hover before unfollow.",
  composedOf: ["Button"],
  behaviors: ["motion engine", "heartBurst (motion/burst)"],
  showcase: "/social",
});
