import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "StoryViewer",
  status: "experimental",
  category: "composite",
  since: "0.1.0",
  summary: "Full-screen stories: StoryProgress bars, tap back / forward (RTL mirrored), hold to pause, swipe for the next person, drag down to close, reply field and LikeButton.",
  composedOf: ["Dialog", "Avatar", "StoryProgress", "LikeButton"],
  behaviors: ["motion engine", "Dialog (focus trap, Esc, scroll lock)", "swipe"],
  showcase: "/social",
});
