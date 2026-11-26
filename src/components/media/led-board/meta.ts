import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "LedBoard",
  status: "experimental",
  category: "media",
  entry: "march/led",
  since: "0.4.0",
  summary: "A fun LED sign: scrolling text in any direction (typewriter, blink, wave, rainbow, inline pixel emoji) and scenes one after another (emoji, eyes and mouth, pixel art, clock, countdown, a score whose digits roll, ticker, audio bars) with wipe, dissolve, pixel rain or iris transitions; reduced motion pages instead of scrolling.",
  composedOf: ["LedMatrix", "PixelFont", "PixelSprite", "LedEyes"],
  behaviors: ["motion engine", "audio source (march/audio)", "keyboard: Space pauses, arrows step"],
  hubs: [],
});
