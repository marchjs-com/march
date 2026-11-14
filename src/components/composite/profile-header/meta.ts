import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "ProfileHeader",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "Profile top: cover (photo or four-color art) with a dim, StoryRing avatar, name / verified / handle / bio, stats with rolling counts, FollowButton, Message and ⋯ Menu.",
  composedOf: ["StoryRing", "FollowButton", "CountRoll", "Button", "Menu", "Picture", "StatTile", "VerifiedMark"],
  behaviors: ["motion engine"],
  showcase: "/social",
});
