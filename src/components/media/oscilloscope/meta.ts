import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Oscilloscope",
  status: "experimental",
  category: "media",
  since: "0.3.17",
  summary: "The shape of a sound, live: a triggered waveform trace with glow and phosphor afterglow over a graticule, or left against right (X/Y Lissajous); a modern panel or a retro CRT look; reads any march/audio source.",
  composedOf: [],
  behaviors: ["motion engine", "audio source (march/audio)", "audio canvas (src/audio/canvas.ts)"],
  hubs: [],
});
