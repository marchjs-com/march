import { defineMeta } from "../../meta.ts";

// Why a new minimal component: Odometer's "flip" look shows numbers only (CountRoll rolls digits, a value is a number);
// a departure board turns reels of letters forward flap by flap, any character, with a leaf folding over a hinge.
// SplitFlap is that reel board; FlipClock stays an Odometer, timetables are columns of SplitFlaps.
export default defineMeta({
  name: "SplitFlap",
  status: "experimental",
  category: "data",
  since: "0.3.20",
  summary: "A split-flap departure board: each cell turns its reel of letters, digits and signs forward flap by flap to the new text, with a stagger; Turkish capitals, your own reel, any theme colour; the text is read once.",
  composedOf: [],
  behaviors: ["motion engine (frame clock)"],
  hubs: [],
});
