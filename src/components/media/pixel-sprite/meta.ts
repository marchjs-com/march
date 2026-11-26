import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "PixelSprite",
  status: "experimental",
  category: "media",
  since: "0.4.0",
  summary: "A pixel drawing on an LED screen, still or animated frame by frame: a built-in emoji or icon by name (heart, fire, rocket…) or your own `.led.json` sprite; frames run on the motion engine's clock.",
  composedOf: ["LedMatrix"],
  behaviors: ["motion engine"],
  hubs: [],
});
