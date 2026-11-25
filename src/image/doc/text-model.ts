// Text layer data: runs of characters with character styles, paragraphs with paragraph styles, point / box / path
// text, warp. Layout and rasterizing live in text.ts (it needs a canvas); this file is the model only.

import type { RGBA } from "./layers.ts";
import type { PathData } from "./paths.ts";

export interface CharStyle {
  font: string;
  weight: number;
  style: "normal" | "italic";
  /** Size in points (document DPI converts it to pixels). */
  size: number;
  /** Leading in points; null = auto (120 %). */
  leading: number | null;
  /** Tracking in 1/1000 em. */
  tracking: number;
  /** Kerning: "metrics" (font), "optical" (approximated) or a manual value in 1/1000 em. */
  kerning: "metrics" | "optical" | number;
  /** Horizontal and vertical scale, 1 = 100 %. */
  hscale: number;
  vscale: number;
  /** Baseline shift in points. */
  baseline: number;
  color: RGBA;
  underline?: boolean | undefined;
  strike?: boolean | undefined;
  caps?: "none" | "all" | "small" | undefined;
  position?: "normal" | "super" | "sub" | undefined;
  /** OpenType feature switches (liga, dlig, smcp, onum, tnum, frac, ss01…). */
  features?: Record<string, boolean | number> | undefined;
  /** Variable font axes (wght, wdth, slnt, opsz…). */
  axes?: Record<string, number> | undefined;
  /** Language for hyphenation and shaping (BCP 47, e.g. "tr"). */
  lang?: string | undefined;
  antialias?: "none" | "sharp" | "crisp" | "strong" | "smooth" | undefined;
}

export interface ParaStyle {
  align: "left" | "center" | "right" | "justify-left" | "justify-center" | "justify-right" | "justify-all";
  indentLeft: number;
  indentRight: number;
  indentFirst: number;
  spaceBefore: number;
  spaceAfter: number;
  hyphenate: boolean;
  /** Hyphenation limits: shortest word, letters before / after the hyphen. */
  hyphenMin?: [number, number, number] | undefined;
  direction?: "ltr" | "rtl" | undefined;
}

export interface TextRun { text: string; style: Partial<CharStyle>; styleRef?: string }
export interface TextParagraph { runs: TextRun[]; style: Partial<ParaStyle>; styleRef?: string }

export type WarpStyle = "none" | "arc" | "arc-lower" | "arc-upper" | "arch" | "bulge" | "shell-lower" | "shell-upper" | "flag" | "wave" | "fish" | "rise" | "fisheye" | "inflate" | "squeeze" | "twist";
export interface TextWarp { style: WarpStyle; bend: number; hDistort: number; vDistort: number; vertical?: boolean }

export interface TextData {
  paragraphs: TextParagraph[];
  /** Defaults under every run / paragraph. */
  char: CharStyle;
  para: ParaStyle;
  orientation: "horizontal" | "vertical";
  /** Point text: an anchor; box text: a frame; path text: along a path. */
  frame: { type: "point"; x: number; y: number } | { type: "box"; x: number; y: number; w: number; h: number } | { type: "path"; path: PathData; offset: number; side?: "above" | "below" };
  warp?: TextWarp | undefined;
  /** Placement transform after layout (affine [a b c d e f]). */
  matrix?: number[] | undefined;
}

export const DEFAULT_CHAR: CharStyle = {
  font: "system-ui", weight: 400, style: "normal", size: 36, leading: null, tracking: 0, kerning: "metrics",
  hscale: 1, vscale: 1, baseline: 0, color: [0, 0, 0, 1], antialias: "smooth",
};
export const DEFAULT_PARA: ParaStyle = { align: "left", indentLeft: 0, indentRight: 0, indentFirst: 0, spaceBefore: 0, spaceAfter: 0, hyphenate: true, hyphenMin: [5, 2, 2] };

/** Plain text of a text layer. */
export const plainText = (t: TextData): string => t.paragraphs.map((p) => p.runs.map((r) => r.text).join("")).join("\n");

/** A text model from a string with one style. */
export function textData(text: string, frame: TextData["frame"], char: Partial<CharStyle> = {}, para: Partial<ParaStyle> = {}): TextData {
  return {
    paragraphs: text.split("\n").map((line) => ({ runs: [{ text: line, style: {} }], style: {} })),
    char: { ...DEFAULT_CHAR, ...char }, para: { ...DEFAULT_PARA, ...para }, orientation: "horizontal", frame,
  };
}
