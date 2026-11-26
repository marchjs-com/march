import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "LedEyes",
  status: "experimental",
  category: "media",
  entry: "march/led",
  since: "0.4.0",
  summary: "A pair of LED eyes that feel alive: blink, look left / right / up / down, surprised, sleepy, happy, angry, sad, in love; random blinks and glances, optional pointer following, and a mouth (smile, grin, talk…) on a tall enough screen.",
  composedOf: ["LedMatrix"],
  behaviors: ["motion engine", "pointer following"],
  hubs: [],
});
