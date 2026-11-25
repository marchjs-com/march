import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Spectrum",
  status: "experimental",
  category: "media",
  since: "0.3.17",
  summary: "The frequencies of a sound, live: log-frequency bars with falling peak caps, mirrored, around a circle or as a line; one theme color, the four HADİ colors or your own tokens; reads any march/audio source.",
  composedOf: [],
  behaviors: ["motion engine", "audio source (march/audio)", "audio canvas (src/audio/canvas.ts)"],
  hubs: [],
});
