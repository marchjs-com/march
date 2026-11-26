import { defineMeta } from "../../meta.ts";

// Why Altimeter composes Gauge: a three-pointer altimeter is one 0–9 dial with three needles turning at three speeds;
// Gauge draws exactly that with a wrapping 0–1000 scale (values are not clamped, so a hand turns once per 1,000 /
// 10,000 / 100,000 and a big climb spins it like the real instrument) and `needles` of three shapes. The pressure
// window sits in Gauge's readout slot and rolls on CountRoll. The altimeter adds the hand ratios, the window and the
// spoken altitude.
export default defineMeta({
  name: "Altimeter",
  status: "experimental",
  category: "data",
  since: "0.3.20",
  summary: "An aircraft altimeter: hundreds, thousands and ten-thousands hands on one 0–9 dial, a pressure (Kollsman) window in hPa or inHg whose digits roll, spring-moving hands that spin through big climbs. Built on Gauge.",
  composedOf: ["Gauge", "CountRoll"],
  behaviors: ["motion engine (spring)"],
  hubs: [],
});
