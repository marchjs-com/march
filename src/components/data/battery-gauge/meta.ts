import { defineMeta } from "../../meta.ts";

// Why BatteryGauge is a new minimal component: a battery is a linear meter in a recognisable shape (a case with a
// terminal cap, a fill or cells, a bolt), with states (low, critical, charging) that change its colour. Gauge is a
// dial; LevelMeter is an audio segment meter with peak and clip lights; Progress is a task's progress, not a charge.
// It reuses the motion engine's track() for the fill, CountRoll for the percentage and the built-in zap icon.
export default defineMeta({
  name: "BatteryGauge",
  status: "experimental",
  category: "data",
  since: "0.3.20",
  summary: "A battery: a case with a cap, a fill or segments that spring to the level, low / critical colours, a bolt while charging, a rolling percentage inside or beside; horizontal or vertical.",
  composedOf: ["CountRoll"],
  behaviors: ["motion engine (spring track)"],
  hubs: [],
});
