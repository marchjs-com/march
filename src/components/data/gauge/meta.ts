import { defineMeta } from "../../meta.ts";

export default defineMeta({
  name: "Gauge",
  status: "experimental",
  category: "data",
  since: "0.3.17",
  summary: "A dial with a needle: arc track, coloured zones, redline, ticks with labels, spring needle, peak mark and a rolling readout; speedometer, tachometer, half and VU looks, a number or an audio source.",
  composedOf: ["CountRoll", "Odometer"],
  behaviors: ["motion engine (spring track)", "march/audio (SAMPLE audio)", "charts util"],
  hubs: [],
});
