// The on-demand registry: tells the engine how to load every built-in op when it meets its type in saved JSON
// (ensureOps). Imported only by code that loads saved edits, so an app that builds its edits from the op functions
// never pulls in modules it does not use: each entry is a lazy import.
import { opLoader } from "../op.ts";

/** Every built-in op type (each one a module: march/image/ops/<type>). */
export const OP_TYPES = [
  "blacks",
  "brightness",
  "bw",
  "clarity",
  "color-balance",
  "contrast",
  "crop",
  "curves",
  "dehaze",
  "duotone",
  "exposure",
  "flip",
  "gradient-map",
  "grain",
  "highlights",
  "hsl",
  "hue",
  "invert",
  "levels",
  "lut",
  "pad",
  "perspective",
  "posterize",
  "resize",
  "rotate",
  "saturation",
  "seam-carve",
  "shadows",
  "split-tone",
  "straighten",
  "temperature",
  "texture",
  "threshold",
  "tint",
  "vibrance",
  "vignette",
  "whites",
] as const;

opLoader("blacks", () => import("./blacks.ts"));
opLoader("brightness", () => import("./brightness.ts"));
opLoader("bw", () => import("./bw.ts"));
opLoader("clarity", () => import("./clarity.ts"));
opLoader("color-balance", () => import("./color-balance.ts"));
opLoader("contrast", () => import("./contrast.ts"));
opLoader("crop", () => import("./crop.ts"));
opLoader("curves", () => import("./curves.ts"));
opLoader("dehaze", () => import("./dehaze.ts"));
opLoader("duotone", () => import("./duotone.ts"));
opLoader("exposure", () => import("./exposure.ts"));
opLoader("flip", () => import("./flip.ts"));
opLoader("gradient-map", () => import("./gradient-map.ts"));
opLoader("grain", () => import("./grain.ts"));
opLoader("highlights", () => import("./highlights.ts"));
opLoader("hsl", () => import("./hsl.ts"));
opLoader("hue", () => import("./hue.ts"));
opLoader("invert", () => import("./invert.ts"));
opLoader("levels", () => import("./levels.ts"));
opLoader("lut", () => import("./lut.ts"));
opLoader("pad", () => import("./pad.ts"));
opLoader("perspective", () => import("./perspective.ts"));
opLoader("posterize", () => import("./posterize.ts"));
opLoader("resize", () => import("./resize.ts"));
opLoader("rotate", () => import("./rotate.ts"));
opLoader("saturation", () => import("./saturation.ts"));
opLoader("seam-carve", () => import("./seam-carve.ts"));
opLoader("shadows", () => import("./shadows.ts"));
opLoader("split-tone", () => import("./split-tone.ts"));
opLoader("straighten", () => import("./straighten.ts"));
opLoader("temperature", () => import("./temperature.ts"));
opLoader("texture", () => import("./texture.ts"));
opLoader("threshold", () => import("./threshold.ts"));
opLoader("tint", () => import("./tint.ts"));
opLoader("vibrance", () => import("./vibrance.ts"));
opLoader("vignette", () => import("./vignette.ts"));
opLoader("whites", () => import("./whites.ts"));
