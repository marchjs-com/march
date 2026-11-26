import { defineMeta } from "../../meta.ts";

// Why Thermometer is a new minimal component: a thermometer is a linear meter (a column in a tube with a bulb and a
// vertical scale), not a dial, so Gauge does not fit; Progress and LevelMeter are bars without a scale, a bulb or a
// liquid that springs. It reuses what exists: the charts' niceStep for round ticks (in °C or °F), the motion engine's
// track() for the column, CountRoll for the readout.
export default defineMeta({
  name: "Thermometer",
  status: "experimental",
  category: "data",
  since: "0.3.20",
  summary: "A glass thermometer: a liquid column that springs to the value, a scale in °C or °F (or both), coloured zones that also colour the liquid, a rolling readout.",
  composedOf: ["CountRoll"],
  behaviors: ["motion engine (spring track)", "charts scale (niceStep)"],
  hubs: [],
});
