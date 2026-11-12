// hadi-march/motion/text — text animations. Every animation is its own export and tree-shakes on its own:
//   import { dissolve, shake } from "hadi-march/motion/text";
//   dissolve(el); shake(el, { by: "word", stagger: 40 });
// All run on the motion engine (global speed, pause all, reduced motion) and share one small core: splitText()
// (accessible, grapheme and RTL safe) and the stagger runner. Catalog for tools and docs: ./meta.ts.
export { splitText, graphemes, isRtl, type SplitBy, type SplitText } from "./split.ts";
export { order, type TextOptions, type TextAnimation, type StaggerFrom } from "./core.ts";
export {
  fade, dissolve, blurIn, rise, drop, slideIn, pop, zoomIn, flip, rotateIn, swing, elastic, bounceIn, tilt, perspective, skewIn,
  splitReveal, maskReveal, wipe, cascade, spin, jelly, trackIn, implode, explode, inkBleed, pixelate, glitch, shake,
} from "./enter.ts";
export { wave, bounce, jitter, float, pulse, rainbow, neon, breathe, glow, shimmer } from "./loop.ts";
export { highlight, underline, strike, gradientSweep, strokeDraw, type MarkOptions } from "./decorate.ts";
export {
  typewriter, typeLoop, scramble, decode, matrix, splitFlap, counter, odometer, wordCycle, morph, parseNumber,
  type TypeOptions, type CycleOptions, type ScrambleOptions, type CounterOptions,
} from "./content.ts";
export { magnetic, repel, type PointerOptions } from "./interactive.ts";
