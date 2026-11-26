import { defineMeta } from "../../meta.ts";

// Why LoudnessGraph composes LineChart: the history is a time series with a value axis, a legend, a tooltip, keyboard
// points and a data table for screen readers, which LineChart already is (the target lines are flat series); the
// correlation is a second LineChart. The graph adds the loudness readings (march/audio loudness()), the sampling on the
// motion clock, the readouts that tween to each reading and the correlation bar.
export default defineMeta({
  name: "LoudnessGraph",
  status: "experimental",
  category: "media",
  since: "0.3.20",
  summary: "A loudness meter's history: momentary / short-term / integrated LUFS (K-weighted, march/audio loudness()) on LineChart with −14 / −23 target lines, the stereo correlation graph and bar, tweening readouts.",
  composedOf: ["LineChart"],
  behaviors: ["motion engine (tween, frame clock)", "audio source (march/audio loudness)", "whenVisible (samples only on screen)"],
  hubs: [],
});
