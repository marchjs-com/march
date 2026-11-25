import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "LevelMeter",
  status: "experimental",
  category: "data",
  since: "0.3.17",
  summary: "A studio LED segment meter: a value or a live sound (march/audio), mono or stereo, green / amber / red zones, a peak light that holds then falls, a latched clip light, a dB scale.",
  composedOf: ["IconButton", "StatusDot"],
  behaviors: ["motion engine", "audio source (march/audio)"],
  hubs: [],
});
