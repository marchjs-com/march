import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "AudioReactive",
  status: "experimental",
  category: "media",
  since: "0.3.17",
  summary: "A wrapper that moves with a sound: writes --m-level, --m-bass, --m-mid, --m-treble and --m-peak (0–1) on itself from a source, with ready pulse / glow / ring / bounce effects.",
  composedOf: [],
  behaviors: ["motion engine", "audio source (march/audio)"],
  hubs: [],
});
