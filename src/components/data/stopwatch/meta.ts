import { defineMeta } from "../../meta.ts";

// Why Stopwatch composes Gauge and Button, and is not a mode of AnalogClock: a stopwatch measures elapsed real time
// and is operated (start, stop, lap, reset), while a clock shows the time of day and is only looked at. The dial is
// the same kind of dial, so both are Gauges (a wrapping 360° scale, needles): the main 60-second dial and the
// 30-minute sub-dial, placed on the main dial's face through Gauge's `inlay`. The buttons are Buttons.
export default defineMeta({
  name: "Stopwatch",
  status: "experimental",
  category: "data",
  since: "0.3.20",
  summary: "A chronograph: a sweeping seconds hand, a 30-minute sub-dial, a digital readout, Start / Stop, Lap and Reset, a lap list with the best and worst lap; spring fly-back on reset. Built on Gauge and Button.",
  composedOf: ["Gauge", "Button"],
  behaviors: ["motion engine (frame clock, spring fly-back)", "whenVisible", "formatDuration"],
  hubs: [],
});
