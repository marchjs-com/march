import { defineMeta } from "../../meta.ts";

// Why a new minimal component: no March component draws a grid of lights. Odometer and CountRoll draw digits as text
// cells, LevelMeter lights one column of segments; an LED sign needs a font of dots (5×7), any text, a window that
// scrolls and changes that move dot by dot. DotMatrix is that one display; scoreboards, departure signs and tickers
// compose it.
export default defineMeta({
  name: "DotMatrix",
  status: "experimental",
  category: "data",
  since: "0.3.20",
  summary: "An LED dot-matrix display: text and numbers in a 5×7 font (Turkish letters, your own glyphs), lit and unlit dots, a window that scrolls long text, a wipe or dissolve on change, round or square dots in any theme colour.",
  composedOf: [],
  behaviors: ["motion engine (tween, frame clock)", "whenVisible (scrolls only on screen)", "pipes (number)"],
  hubs: [],
});
