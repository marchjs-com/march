// The layer tree's types. Layers are plain objects (JSON-like) holding references to pixel data (TiledRaster, Mask);
// the document owns the tree and changes it inside doc.change(), which makes every change one history step.

import type { BlendMode } from "./blend.ts";
import type { Mask, TiledRaster, Rect } from "./tiles.ts";
import type { PathData } from "./paths.ts";
import type { LayerStyle } from "./styles.ts";
import type { TextData } from "./text-model.ts";

/** The kind of a layer. @tr Katman türü. */
export type LayerKind = "pixel" | "text" | "shape" | "fill" | "adjustment" | "group" | "smart" | "artboard";

/** Layer color tag (the Layers panel's label color). @tr Katman renk etiketi. */
export type ColorTag = "none" | "red" | "orange" | "yellow" | "green" | "blue" | "violet" | "gray";
export const COLOR_TAGS: ColorTag[] = ["none", "red", "orange", "yellow", "green", "blue", "violet", "gray"];

/** An RGBA color, 0–1 floats, straight alpha. */
export type RGBA = [number, number, number, number];

export interface Locks {
  /** Transparent pixels stay transparent. @tr Saydam pikseller saydam kalır. */
  transparency: boolean;
  /** Pixels cannot be painted. @tr Piksellere boya sürülemez. */
  pixels: boolean;
  /** The layer cannot be moved. @tr Katman taşınamaz. */
  position: boolean;
  /** Not moved in or out of artboards. @tr Çalışma yüzeylerine girip çıkmaz. */
  artboard: boolean;
}
export const NO_LOCKS: Locks = { transparency: false, pixels: false, position: false, artboard: false };

export interface LayerMask {
  mask: Mask;
  enabled: boolean;
  /** Moves with the layer. */
  linked: boolean;
  /** 0–1: how strongly the mask hides. */
  density: number;
  /** Feather radius in pixels (non-destructive). */
  feather: number;
  /** Inverted when applied (Properties › Invert keeps the pixels). */
  invert?: boolean | undefined;
}

export interface VectorMask {
  path: PathData;
  enabled: boolean;
  linked: boolean;
  density: number;
  feather: number;
}

/** "Blend If" sliders: this layer / underlying layer ranges, split handles for smooth falloff. */
export interface BlendIf {
  channel: "gray" | "red" | "green" | "blue";
  thisLayer: [number, number, number, number];
  underlying: [number, number, number, number];
}

export interface LayerBase {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  /** 0–1, applies to pixels and styles. */
  opacity: number;
  /** 0–1, applies to pixels only. */
  fill: number;
  blend: BlendMode | "pass-through";
  locks: Locks;
  color: ColorTag;
  /** Clipped to the layer below (clipping mask). */
  clip: boolean;
  mask?: LayerMask | undefined;
  vectorMask?: VectorMask | undefined;
  styles?: LayerStyle | undefined;
  blendIf?: BlendIf | undefined;
  /** Blending options › channels. */
  channels?: [boolean, boolean, boolean] | undefined;
  /** Knockout: none / shallow / deep (groups and their children). */
  knockout?: "none" | "shallow" | "deep" | undefined;
  /** Comment threads and notes kept on the layer (collaboration). */
  comments?: LayerComment[] | undefined;
  /** Variables (data sets): which property a variable drives. */
  variable?: { name: string; kind: "visibility" | "text" | "pixels" };
  /** Free-form data for plugins. */
  data?: Record<string, unknown> | undefined;
}

export interface LayerComment { id: string; author: string; text: string; at: number; x?: number | undefined; y?: number | undefined; resolved?: boolean }

export interface PixelLayer extends LayerBase { kind: "pixel"; raster: TiledRaster }

export interface TextLayer extends LayerBase { kind: "text"; text: TextData; raster: TiledRaster }

export interface ShapeLayer extends LayerBase {
  kind: "shape";
  path: PathData;
  fillPaint: Paint | null;
  stroke: StrokeStyle | null;
  /** Live shape properties (rectangle radius, polygon sides…) while it is still a live shape. */
  live?: LiveShape | undefined;
  raster: TiledRaster;
}

export interface FillLayer extends LayerBase { kind: "fill"; paint: Paint }

export interface AdjustmentLayer extends LayerBase {
  kind: "adjustment";
  /** A filter / adjustment id from the engine registry, and its parameters. */
  adjust: { id: string; params: Record<string, unknown> };
}

export interface GroupLayer extends LayerBase { kind: "group"; children: Layer[]; collapsed: boolean }

export interface SmartFilter { id: string; params: Record<string, unknown>; enabled: boolean; blend?: BlendMode | undefined; opacity?: number }

export interface SmartLayer extends LayerBase {
  kind: "smart";
  /** The embedded document (serialized source: lossless re-rendering at any scale). */
  source: { doc: unknown; width: number; height: number; name?: string | undefined; linked?: string };
  /** Placement: a 3×3 projective matrix (row-major) from source pixels to document pixels. */
  matrix: number[];
  /** Warp mesh in source space (optional). */
  warp?: { cols: number; rows: number; points: number[] };
  filters: SmartFilter[];
  filtersEnabled: boolean;
  /** Smart filter mask. */
  filterMask?: Mask | undefined;
  /** Rendered pixels in document space (cache, rebuilt when the source, matrix or filters change). */
  raster: TiledRaster;
}

export interface ArtboardLayer extends LayerBase {
  kind: "artboard";
  rect: Rect;
  background: RGBA | null;
  children: Layer[];
  collapsed: boolean;
  /** Export settings (Export As per artboard). */
  exportScales?: number[] | undefined;
}

export type Layer = PixelLayer | TextLayer | ShapeLayer | FillLayer | AdjustmentLayer | GroupLayer | SmartLayer | ArtboardLayer;
export type ContainerLayer = GroupLayer | ArtboardLayer;
export const isContainer = (l: Layer): l is ContainerLayer => l.kind === "group" || l.kind === "artboard";
export const hasRaster = (l: Layer): l is PixelLayer | TextLayer | ShapeLayer | SmartLayer => "raster" in l;

// ——— paints (fill layers, shape fill, gradient tool, overlays) ———

export interface GradientStop { at: number; color: RGBA }
export interface Gradient {
  type: "linear" | "radial" | "angle" | "reflected" | "diamond";
  stops: GradientStop[];
  /** Opacity stops (0–1 positions). */
  alpha?: { at: number; value: number }[];
  /** Start and end in document pixels (or relative 0–1 when `relative`). */
  from: [number, number];
  to: [number, number];
  relative?: boolean | undefined;
  reverse?: boolean | undefined;
  dither?: boolean | undefined;
  /** Smoothness 0–1 (1 = smooth interpolation, 0 = linear). */
  smoothness?: number | undefined;
  /** Color interpolation: perceptual (OKLab), linear light or classic sRGB. */
  method?: "perceptual" | "linear" | "classic" | undefined;
}
export interface Pattern { id: string; width: number; height: number; pixels: Float32Array; name?: string }
export type Paint =
  | { type: "solid"; color: RGBA }
  | { type: "gradient"; gradient: Gradient }
  | { type: "pattern"; pattern: Pattern; scale: number; angle?: number | undefined; offset?: [number, number] };

export interface StrokeStyle {
  paint: Paint;
  width: number;
  align: "inside" | "center" | "outside";
  cap: "butt" | "round" | "square";
  join: "miter" | "round" | "bevel";
  dash?: number[] | undefined;
  miterLimit?: number | undefined;
}

export type LiveShape =
  | { type: "rect"; x: number; y: number; w: number; h: number; radius: [number, number, number, number] }
  | { type: "ellipse"; cx: number; cy: number; rx: number; ry: number }
  | { type: "polygon"; cx: number; cy: number; r: number; sides: number; star?: number | undefined; angle: number; smooth?: number }
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; width: number; arrows?: [boolean, boolean] }
  | { type: "custom"; id: string; x: number; y: number; w: number; h: number };

// ——— ids and factories ———

let seq = 0;
export const newId = (prefix = "l"): string => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;

export function baseLayer<K extends LayerKind>(kind: K, name: string): LayerBase & { kind: K } {
  return {
    id: newId(), name, kind, visible: true, opacity: 1, fill: 1,
    blend: kind === "group" ? "pass-through" : "normal",
    locks: { ...NO_LOCKS }, color: "none", clip: false,
  };
}

/** Walk the tree depth first (top-most children last, like the stack order: index 0 is the bottom). */
export function* walk(layers: Layer[], parent: ContainerLayer | null = null): Generator<[Layer, ContainerLayer | null]> {
  for (const l of layers) {
    yield [l, parent];
    if (isContainer(l)) yield* walk(l.children, l);
  }
}
