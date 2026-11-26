import { defineMeta } from "../../meta.ts";

// Why AnalogClock composes Gauge: a clock face is a 360° dial whose scale starts at 12 o'clock and wraps, with three
// needles (hour, minute, second); Gauge draws exactly that (sweep 360, start 0, wrap, needles), with its bezel, ticks,
// numerals, hub, glass and spring needles. The clock adds only what a dial does not know: the time (system clock, a
// time zone or your own source), the hand values kept continuous across 12, the second-by-second beat and the spoken
// time.
export default defineMeta({
  name: "AnalogClock",
  status: "experimental",
  category: "data",
  since: "0.3.20",
  summary: "A 12-hour clock dial with hour, minute and second hands: ticking (spring) or sweeping second hand, a time zone or your own time source, arabic / roman / quarter numerals, a caption and a date window. Built on Gauge.",
  composedOf: ["Gauge"],
  behaviors: ["motion engine (spring, frame clock)", "whenVisible (ticks only on screen)", "Intl time zones"],
  hubs: [],
});
