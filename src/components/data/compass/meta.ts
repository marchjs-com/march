import { defineMeta } from "../../meta.ts";

// Why Compass composes Gauge: a compass card is a 360° scale from north that wraps; Gauge has it (sweep 360, start 0,
// wrap), turns its scale under fixed needles (`turn`, the rose mode), draws the needle mode's two-tone needle
// (`needles`), and its `peak` mark at a number is the bearing marker. The readout is CountRoll ("045° NE" rolls). The
// compass adds the heading kept continuous (350° → 10° turns forward), the cardinal names in the page's language, the
// lubber line and the "045° NE" text.
export default defineMeta({
  name: "Compass",
  status: "experimental",
  category: "data",
  since: "0.3.20",
  summary: "A compass: the rose turns under a lubber line (or a two-tone needle turns on a fixed rose), cardinal letters in the page's language, 4 or 8 points, a bearing marker and a rolling \"045° NE\" readout; damped spring motion. Built on Gauge.",
  composedOf: ["Gauge", "CountRoll"],
  behaviors: ["motion engine (spring)"],
  hubs: [],
});
