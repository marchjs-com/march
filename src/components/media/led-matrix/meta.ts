import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "LedMatrix",
  status: "experimental",
  category: "media",
  entry: "march/led",
  since: "0.4.0",
  summary: "A dot-matrix screen of LEDs on a canvas: shows a picture (an LED frame or pixel art as text) and repaints only the LEDs that changed; round LEDs, square pixels or glow tubes, gap, roundness, bloom halo, ghost of unlit LEDs, scanlines; one color or full RGB on the theme's accent.",
  composedOf: [],
  behaviors: ["canvas (src/audio/canvas.ts)", "off-screen pause"],
  hubs: [],
});
