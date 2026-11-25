// Brush presets: a tip plus its dynamics (shape, scatter, texture, color, transfer), spacing and the stroke switches
// (wet edges, airbrush, build-up, noise, smoothing, protect texture). Plain JSON: saved in documents and libraries,
// imported from .abr. The built-in library is made here (procedural tips, no third-party images).

import type { TipSpec } from "./tips.ts";

/** What drives a dynamic. @tr Dinamiği yöneten giriş. */
export type BrushControl = "off" | "fade" | "pressure" | "tilt" | "rotation" | "wheel" | "direction" | "initial-direction";

export interface ShapeDynamics {
  /** 0–1 random size change per dab. */
  sizeJitter?: number | undefined;
  sizeControl?: BrushControl | undefined;
  /** Smallest size (0–1 of the brush size) the control can reach. */
  minDiameter?: number | undefined;
  /** 0–1 of a full turn. */
  angleJitter?: number | undefined;
  angleControl?: BrushControl | undefined;
  roundnessJitter?: number | undefined;
  roundnessControl?: BrushControl | undefined;
  minRoundness?: number | undefined;
  flipXJitter?: boolean | undefined;
  flipYJitter?: boolean | undefined;
  /** Dabs over which a "fade" control goes from full to the minimum. */
  fadeSteps?: number | undefined;
}

export interface ScatterSettings {
  /** Spread in brush diameters (0–10). */
  amount: number;
  /** Scatter along the stroke as well as across it. */
  bothAxes?: boolean | undefined;
  control?: BrushControl | undefined;
  /** Dabs per spacing step (1–16). */
  count?: number | undefined;
  countJitter?: number | undefined;
  countControl?: BrushControl | undefined;
}

export type TextureMode = "multiply" | "subtract" | "height" | "darken" | "overlay" | "color-burn" | "linear-burn" | "hard-mix" | "linear-height";

export interface TextureSettings {
  /** Pattern id (built-in patterns or ones the app registers). */
  pattern: string;
  /** 1 = 100 %. */
  scale?: number | undefined;
  /** 0–1. */
  depth?: number | undefined;
  mode?: TextureMode | undefined;
  invert?: boolean | undefined;
  /** −1…1. */
  brightness?: number | undefined;
  /** −1…1. */
  contrast?: number | undefined;
  /** Apply per dab (depth dynamics) instead of once per stroke. */
  eachTip?: boolean | undefined;
  depthJitter?: number | undefined;
  depthControl?: BrushControl | undefined;
  minDepth?: number | undefined;
}

export interface ColorDynamics {
  /** Apply once per tip (true) or once per stroke. */
  perTip?: boolean | undefined;
  fgBgJitter?: number | undefined;
  fgBgControl?: BrushControl | undefined;
  hueJitter?: number | undefined;
  saturationJitter?: number | undefined;
  brightnessJitter?: number | undefined;
  /** −1 (gray) … 1 (fully saturated). */
  purity?: number | undefined;
}

export interface TransferSettings {
  opacityJitter?: number | undefined;
  opacityControl?: BrushControl | undefined;
  minOpacity?: number | undefined;
  flowJitter?: number | undefined;
  flowControl?: BrushControl | undefined;
  minFlow?: number | undefined;
  /** Mixer brush only. */
  wetnessJitter?: number | undefined;
  mixJitter?: number | undefined;
}

/** A brush preset. JSON-serializable. @tr Fırça hazır ayarı. */
export interface BrushPreset {
  id: string;
  name: string;
  /** Library group in the brush picker. */
  category?: string | undefined;
  tip: TipSpec;
  /** Diameter in pixels. */
  size: number;
  /** Degrees. */
  angle?: number | undefined;
  /** 0–1. */
  roundness?: number | undefined;
  flipX?: boolean | undefined;
  flipY?: boolean | undefined;
  /** Distance between dabs as a fraction of the diameter (0.25 = 25 %); 0 = one dab per pointer sample. */
  spacing?: number | undefined;
  shape?: ShapeDynamics | undefined;
  scatter?: ScatterSettings | undefined;
  texture?: TextureSettings | undefined;
  /** Dual brush: a second tip whose dabs cut the first one (alpha multiply). */
  dual?: { tip: TipSpec; size: number; spacing?: number | undefined; scatter?: number | undefined } | undefined;
  color?: ColorDynamics | undefined;
  transfer?: TransferSettings | undefined;
  wetEdges?: boolean | undefined;
  airbrush?: boolean | undefined;
  /** Overlapping dabs keep adding (true) or a pixel keeps its strongest dab (false). */
  buildUp?: boolean | undefined;
  noise?: boolean | undefined;
  /** 0–1 stroke smoothing. */
  smoothing?: number | undefined;
  protectTexture?: boolean | undefined;
  /** Pencil: hard pixels, no anti-aliasing. */
  aliased?: boolean | undefined;
  /** Mixer brush defaults (0–1). */
  mixer?: { wet: number; load: number; mix: number } | undefined;
  /** Tool this preset is made for ("brush", "mixer-brush", "smudge", "eraser"…). */
  tool?: string | undefined;
}

const round = (h: number): TipSpec => ({ type: "round", hardness: h });
const proc = (gen: Extract<TipSpec, { type: "procedural" }>["gen"], seed = 1, res = 96): TipSpec => ({ type: "procedural", gen, seed, res });

/** The built-in library (≥ 24 presets). */
export const BUILTIN_BRUSHES: BrushPreset[] = [
  { id: "hard-round", name: "Hard Round", category: "General", tip: round(1), size: 30, spacing: 0.1, shape: { sizeControl: "pressure", minDiameter: 0.1 } },
  { id: "soft-round", name: "Soft Round", category: "General", tip: round(0), size: 60, spacing: 0.1, shape: { sizeControl: "pressure", minDiameter: 0.1 } },
  { id: "hard-round-pressure-opacity", name: "Hard Round Pressure Opacity", category: "General", tip: round(0.9), size: 30, spacing: 0.1, transfer: { opacityControl: "pressure", minOpacity: 0 } },
  { id: "airbrush", name: "Soft Airbrush", category: "General", tip: round(0), size: 80, spacing: 0.08, airbrush: true, transfer: { flowControl: "pressure", minFlow: 0.05 } },
  { id: "pencil", name: "Pencil", category: "Sketch", tip: round(1), size: 2, spacing: 0.15, aliased: true, tool: "pencil" },
  { id: "sketch-pencil", name: "Sketch Pencil", category: "Sketch", tip: proc("chalk", 3, 48), size: 6, spacing: 0.12, transfer: { opacityControl: "pressure", minOpacity: 0.1 }, texture: { pattern: "noise", depth: 0.5, mode: "subtract", scale: 0.5 } },
  { id: "ink", name: "Ink Pen", category: "Ink", tip: round(0.95), size: 8, spacing: 0.05, smoothing: 0.4, shape: { sizeControl: "pressure", minDiameter: 0.05 } },
  { id: "ink-blot", name: "Ink Blot", category: "Ink", tip: proc("ink", 4), size: 24, spacing: 0.15, shape: { angleJitter: 1, sizeJitter: 0.2 } },
  { id: "marker", name: "Marker", category: "Ink", tip: round(0.8), size: 20, roundness: 0.55, angle: 35, spacing: 0.05, buildUp: false },
  { id: "calligraphy-flat", name: "Calligraphy Flat", category: "Ink", tip: round(1), size: 26, roundness: 0.12, angle: 40, spacing: 0.03, smoothing: 0.3 },
  { id: "chalk", name: "Chalk", category: "Dry Media", tip: proc("chalk", 5), size: 36, spacing: 0.2, shape: { angleJitter: 1 }, texture: { pattern: "noise", depth: 0.6, mode: "height", scale: 1 } },
  { id: "charcoal", name: "Charcoal", category: "Dry Media", tip: proc("charcoal", 6), size: 40, spacing: 0.15, shape: { angleControl: "direction", sizeJitter: 0.1 }, transfer: { opacityControl: "pressure", minOpacity: 0.2 } },
  { id: "pastel", name: "Soft Pastel", category: "Dry Media", tip: proc("pastel", 7), size: 44, spacing: 0.15, shape: { angleJitter: 0.1 }, texture: { pattern: "noise", depth: 0.4, mode: "multiply" } },
  { id: "dry-brush", name: "Dry Brush", category: "Paint", tip: proc("dry", 8), size: 50, spacing: 0.08, shape: { angleControl: "direction" }, transfer: { flowJitter: 0.3 } },
  { id: "watercolor-wet-edge", name: "Watercolor Wet Edge", category: "Paint", tip: round(0.3), size: 70, spacing: 0.1, wetEdges: true, transfer: { flowControl: "pressure", minFlow: 0.3 }, texture: { pattern: "noise", depth: 0.25, mode: "multiply", scale: 2 } },
  { id: "oil-flat", name: "Oil Flat", category: "Paint", tip: proc("dry", 9), size: 40, roundness: 0.5, spacing: 0.05, shape: { angleControl: "direction" }, tool: "mixer-brush", mixer: { wet: 0.5, load: 0.6, mix: 0.4 } },
  { id: "mixer-wet", name: "Mixer Wet Round", category: "Paint", tip: round(0.5), size: 50, spacing: 0.08, tool: "mixer-brush", mixer: { wet: 0.8, load: 0.5, mix: 0.6 } },
  { id: "spatter", name: "Spatter", category: "Special Effects", tip: proc("spatter", 10), size: 60, spacing: 0.4, shape: { angleJitter: 1, sizeJitter: 0.4 }, scatter: { amount: 1.2, bothAxes: true, count: 2 } },
  { id: "grass", name: "Grass", category: "Special Effects", tip: proc("grass", 11, 128), size: 90, spacing: 0.35, shape: { sizeJitter: 0.5, angleJitter: 0.05, angleControl: "off", flipXJitter: true }, scatter: { amount: 0.6, count: 2, countJitter: 0.5 }, color: { fgBgJitter: 0.6, hueJitter: 0.05, brightnessJitter: 0.15, perTip: true } },
  { id: "leaves", name: "Scattered Leaves", category: "Special Effects", tip: proc("leaf", 12), size: 70, spacing: 0.6, shape: { sizeJitter: 0.6, angleJitter: 1, roundnessJitter: 0.4, minRoundness: 0.3, flipXJitter: true }, scatter: { amount: 2, bothAxes: true, count: 2 }, color: { fgBgJitter: 1, hueJitter: 0.08, saturationJitter: 0.1, brightnessJitter: 0.1, perTip: true } },
  { id: "stars", name: "Stars", category: "Special Effects", tip: proc("star", 13), size: 40, spacing: 1.2, shape: { sizeJitter: 0.7, angleJitter: 1 }, scatter: { amount: 2.5, bothAxes: true, count: 1 }, transfer: { opacityJitter: 0.4 } },
  { id: "clouds", name: "Clouds", category: "Special Effects", tip: proc("cloud", 14, 128), size: 160, spacing: 0.25, shape: { sizeJitter: 0.4, angleJitter: 1, flipXJitter: true }, scatter: { amount: 0.5, bothAxes: true }, transfer: { opacityJitter: 0.4, flowJitter: 0.3 } },
  { id: "hair", name: "Hair", category: "Special Effects", tip: proc("hair", 15, 128), size: 60, spacing: 0.05, shape: { angleControl: "direction" } },
  { id: "rake", name: "Rake", category: "Special Effects", tip: proc("rake", 16), size: 50, spacing: 0.03, shape: { angleControl: "direction" } },
  { id: "texture-noise", name: "Texture Noise", category: "Special Effects", tip: proc("noise", 17), size: 50, spacing: 0.25, noise: true, texture: { pattern: "noise", depth: 0.8, mode: "subtract", scale: 1.5 }, shape: { angleJitter: 1 } },
  { id: "sponge", name: "Sponge", category: "Special Effects", tip: proc("sponge", 18), size: 60, spacing: 0.3, shape: { angleJitter: 1 }, transfer: { opacityJitter: 0.3 } },
  { id: "square", name: "Square", category: "General", tip: proc("square", 1, 32), size: 20, spacing: 0.1 },
  { id: "smudge-stick", name: "Smudge Stick", category: "Retouch", tip: proc("smudge-stick", 19), size: 50, spacing: 0.1, tool: "smudge", shape: { angleControl: "direction" } },
  { id: "eraser-soft", name: "Soft Eraser", category: "Retouch", tip: round(0), size: 60, spacing: 0.1, tool: "eraser" },
  { id: "eraser-hard", name: "Hard Eraser", category: "Retouch", tip: round(1), size: 20, spacing: 0.1, tool: "eraser" },
  { id: "dodge-soft", name: "Dodge and Burn Soft", category: "Retouch", tip: round(0), size: 90, spacing: 0.1, tool: "dodge" },
];

const byId = new Map(BUILTIN_BRUSHES.map((p) => [p.id, p]));

/** Find a preset by id in the built-ins and any extra libraries (imported, user presets). */
export function findBrush(id: string | undefined | null, ...libraries: (BrushPreset[] | undefined | null)[]): BrushPreset | null {
  if (!id) return null;
  for (const lib of libraries) { const p = lib?.find((b) => b.id === id); if (p) return p; }
  return byId.get(id) ?? null;
}

/** A quick round preset (options bar size / hardness without a library pick). */
export function roundBrush(size: number, hardness: number, extra: Partial<BrushPreset> = {}): BrushPreset {
  return { id: `round-${size}-${hardness}`, name: "Round", tip: { type: "round", hardness }, size, spacing: 0.1, ...extra };
}

/** A deep copy safe to change (presets are shared). */
export const clonePreset = (p: BrushPreset): BrushPreset => JSON.parse(JSON.stringify(p)) as BrushPreset;
