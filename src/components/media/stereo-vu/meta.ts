import { defineMeta } from "../../meta.ts";

// Why StereoVu composes Gauge, IconButton and StatusDot: each needle meter is Gauge variant="vu" (the dB scale, VU
// ballistics on the motion engine, the spoken value); the peak lights are LevelMeter's light (an IconButton press
// target holding a StatusDot). The panel adds what a single dial does not know: the left / right pair from one source,
// the 0 VU reference level, the peak lights with their hold, and the housing.
export default defineMeta({
  name: "StereoVu",
  status: "experimental",
  category: "media",
  since: "0.3.20",
  summary: "A stereo VU-meter pair on one panel: two needle VU meters (Gauge vu) for left and right from a march/audio source or two numbers, peak lights that hold or latch, a 0 VU reference, metal / dark / wood panels.",
  composedOf: ["Gauge", "IconButton", "StatusDot"],
  behaviors: ["motion engine (VU ballistics through Gauge)", "audio source (march/audio)"],
  hubs: [],
});
