import { defineMeta } from "../../meta.ts";

// Why FlipClock composes Odometer and SplitFlap: the number cards of a flip clock are Odometer's "flip" look (split
// cards that roll through CountRoll on the motion engine); the 12-hour clock's AM / PM is a word, so it is a SplitFlap.
// The clock adds only the time (system clock, a time zone or your own source), the beat once a second on screen, the
// blinking separators and the spoken time.
export default defineMeta({
  name: "FlipClock",
  status: "experimental",
  category: "data",
  since: "0.3.20",
  summary: "A flip clock: hours, minutes and seconds on split number cards (Odometer flip), blinking separators, a 12-hour AM / PM flap (SplitFlap), a time zone or your own time source.",
  composedOf: ["Odometer", "SplitFlap"],
  behaviors: ["motion engine (through CountRoll)", "whenVisible (ticks only on screen)", "Intl time zones"],
  hubs: [],
});
