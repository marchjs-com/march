import { defineMeta } from "../../meta.ts";

// Why AttitudeIndicator composes Gauge: the case, bezel, glass and the roll scale (fixed marks at 10, 20, 30, 45, 60°
// on a full-circle scale whose 0 is at the top) are a Gauge, and its peak mark at a number is the sky pointer that
// follows the bank. What no dial has is the horizon card (sky, ground, pitch ladder, turned by the bank and moved by
// the pitch) and the fixed aircraft symbol: those are new, drawn on the Gauge's face through `inlay`.
export default defineMeta({
  name: "AttitudeIndicator",
  status: "experimental",
  category: "data",
  since: "0.3.20",
  summary: "An artificial horizon: sky and ground with a pitch ladder that tilt with the bank and move with the pitch, a roll scale with a sky pointer, a fixed aircraft symbol; gyro-like spring motion. Built on Gauge.",
  composedOf: ["Gauge"],
  behaviors: ["motion engine (spring track)"],
  hubs: [],
});
