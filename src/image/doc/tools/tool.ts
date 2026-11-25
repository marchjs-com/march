// Headless tools: a tool turns pointer samples (document coordinates, pen pressure / tilt / twist) and keys into
// document changes, and describes what the view draws on top (overlay shapes) and which cursor it shows. The UI
// (PhotoEditor) owns events, zoom and drawing; tools own the logic, so they are testable and usable under other UIs.

import type { ImageDocument } from "../document.ts";
import type { RGBA } from "../layers.ts";
import type { PathData } from "../paths.ts";
import type { Rect } from "../tiles.ts";

/** One pointer sample in document pixels. */
export interface PointerSample {
  x: number;
  y: number;
  /** 0–1 (mouse: 0.5 while pressed). */
  pressure: number;
  /** Pen tilt in degrees (−90…90). */
  tiltX: number;
  tiltY: number;
  /** Pen barrel rotation in degrees (0–359). */
  twist: number;
  /** Milliseconds (event timestamp). */
  time: number;
  pointerType: "mouse" | "pen" | "touch";
  /** 0 primary, 1 middle, 2 secondary. */
  button: number;
  shift: boolean;
  alt: boolean;
  ctrl: boolean;
  meta: boolean;
}

/** A tool option shown in the options bar (and the tool's panel). */
export interface ToolOption {
  key: string;
  label: string;
  kind: "number" | "percent" | "angle" | "boolean" | "choice" | "color" | "blend" | "brush" | "gradient" | "pattern" | "text" | "font" | "select-op";
  min?: number | undefined;
  max?: number | undefined;
  step?: number | undefined;
  unit?: string | undefined;
  default: unknown;
  options?: { value: string; label: string; icon?: string | undefined }[] | undefined;
  /** Shown only while this returns true (other option values). */
  visible?: ((o: Record<string, unknown>) => boolean) | undefined;
}

/** Shapes the view draws over the canvas for a tool (in document pixels unless `screen`). */
export type OverlayShape =
  | { type: "line"; x1: number; y1: number; x2: number; y2: number; dash?: boolean | undefined; color?: string | undefined; width?: number | undefined }
  | { type: "rect"; rect: Rect; dash?: boolean | undefined; fill?: string | undefined; color?: string | undefined; angle?: number | undefined }
  | { type: "ellipse"; rect: Rect; dash?: boolean | undefined; color?: string | undefined }
  | { type: "polyline"; points: [number, number][]; closed?: boolean | undefined; dash?: boolean | undefined; color?: string | undefined; width?: number | undefined }
  | { type: "path"; path: PathData; anchors?: boolean | undefined; selected?: number[] | undefined; color?: string | undefined }
  | { type: "handle"; x: number; y: number; id: string; shape?: "square" | "circle" | "diamond" | undefined; active?: boolean | undefined }
  | { type: "brush"; x: number; y: number; size: number; hardness: number; angle?: number | undefined; roundness?: number | undefined }
  | { type: "crosshair"; x: number; y: number }
  | { type: "label"; x: number; y: number; text: string }
  | { type: "mesh"; cols: number; rows: number; points: number[]; color?: string | undefined }
  | { type: "image"; rect: Rect; pixels: Float32Array; width: number; height: number; opacity?: number | undefined; matrix?: number[] | undefined }
  | { type: "pin"; x: number; y: number; id: string; active?: boolean | undefined };

export type ToolCursor = "default" | "crosshair" | "move" | "brush" | "eyedropper" | "zoom-in" | "zoom-out" | "grab" | "grabbing" | "text" | "pen" | "pen-add" | "pen-remove" | "pen-convert" | "not-allowed" | "rotate" | "resize-nwse" | "resize-nesw" | "resize-ns" | "resize-ew" | "copy" | "bucket" | "lasso" | "wand" | "stamp" | "pointer";

/** What a tool can use while it works. */
export interface ToolContext {
  doc: ImageDocument;
  /** Foreground and background colors. */
  fg: RGBA;
  bg: RGBA;
  /** This tool's current option values. */
  options: Record<string, unknown>;
  /** View zoom (1 = 100 %): hit areas and handle sizes are in screen pixels / zoom. */
  zoom: number;
  /** Ask the view to redraw a region while working (live preview). */
  invalidate(rect: Rect | null): void;
  /** Change the foreground / background color (eyedropper, swap). */
  setColor(which: "fg" | "bg", c: RGBA): void;
  /** Change this tool's options (e.g. the brush size with [ and ]). */
  setOption(key: string, value: unknown): void;
  /** Tell the user something short (announced to screen readers too). */
  announce(text: string): void;
  /** Switch to another tool (e.g. after placing text). */
  switchTool?: ((id: string) => void) | undefined;
  /** Open a UI prompt (text entry, confirm): resolved by the UI. */
  prompt?: ((kind: string, data: unknown) => Promise<unknown>) | undefined;
  /** Shared state between tools (clone source point, color samplers…). */
  shared: Record<string, unknown>;
}

export interface Tool {
  id: string;
  /** Toolbar group (tools in a group share one slot; long press opens the others). */
  group: string;
  label: string;
  /** March icon name. */
  icon: string;
  /** Single-key shortcut (Shift + key cycles through the group). */
  key?: string | undefined;
  options?: ToolOption[] | undefined;
  cursor?: ((ctx: ToolContext, p: PointerSample | null) => ToolCursor) | undefined;
  down?: ((ctx: ToolContext, p: PointerSample) => void) | undefined;
  move?: ((ctx: ToolContext, p: PointerSample) => void) | undefined;
  up?: ((ctx: ToolContext, p: PointerSample) => void) | undefined;
  /** Pointer moves without a press. */
  hover?: ((ctx: ToolContext, p: PointerSample) => void) | undefined;
  /** Double click / tap. */
  dbl?: ((ctx: ToolContext, p: PointerSample) => void) | undefined;
  /** A key while the tool is active; true when handled. */
  key_?: ((ctx: ToolContext, e: { key: string; shift: boolean; alt: boolean; ctrl: boolean; meta: boolean; type: "down" | "up" }) => boolean) | undefined;
  /** Enter / commit button (transform, crop, text, pen). */
  commit?: ((ctx: ToolContext) => void) | undefined;
  /** Escape / cancel button. */
  cancel?: ((ctx: ToolContext) => void) | undefined;
  /** True while the tool holds an unfinished edit (the options bar shows commit / cancel). */
  pending?: ((ctx: ToolContext) => boolean) | undefined;
  /** What to draw over the canvas now. */
  overlay?: ((ctx: ToolContext) => OverlayShape[]) | undefined;
  /** Called when the tool becomes active / inactive. */
  activate?: ((ctx: ToolContext) => void) | undefined;
  deactivate?: ((ctx: ToolContext) => void) | undefined;
}

const registry = new Map<string, Tool>();
const order: string[] = [];

/** Add tools (built-ins and plugins). Returns a remover. */
export function registerTool(...tools: Tool[]): () => void {
  for (const t of tools) { if (!registry.has(t.id)) order.push(t.id); registry.set(t.id, t); }
  return () => { for (const t of tools) if (registry.get(t.id) === t) { registry.delete(t.id); order.splice(order.indexOf(t.id), 1); } };
}
export const getTool = (id: string): Tool | undefined => registry.get(id);
export const allTools = (): Tool[] => order.map((id) => registry.get(id)!).filter(Boolean);
/** Default option values of a tool. */
export const toolDefaults = (t: Tool): Record<string, unknown> => Object.fromEntries((t.options ?? []).map((o) => [o.key, o.default]));

/** A pointer sample from a plain point (tests, scripts). */
export function sample(x: number, y: number, extra: Partial<PointerSample> = {}): PointerSample {
  return { x, y, pressure: 0.5, tiltX: 0, tiltY: 0, twist: 0, time: 0, pointerType: "mouse", button: 0, shift: false, alt: false, ctrl: false, meta: false, ...extra };
}

/** A context for running a tool without a UI (tests, scripting, actions). */
export function headlessContext(doc: ImageDocument, options: Record<string, unknown> = {}, extra: Partial<ToolContext> = {}): ToolContext {
  const ctx: ToolContext = {
    doc, fg: [0, 0, 0, 1], bg: [1, 1, 1, 1], options, zoom: 1, shared: {},
    invalidate: () => {}, announce: () => {},
    setColor: (w, c) => { ctx[w] = c; },
    setOption: (k, v) => { ctx.options = { ...ctx.options, [k]: v }; },
    ...extra,
  };
  return ctx;
}

/** Run a whole drag with a tool (tests, actions playback). */
export function drag(tool: Tool, ctx: ToolContext, points: [number, number][], extra: Partial<PointerSample> = {}): void {
  if (!points.length) return;
  const first = points[0]!;
  tool.down?.(ctx, sample(first[0], first[1], { ...extra, time: 0 }));
  points.slice(1).forEach(([x, y], i) => tool.move?.(ctx, sample(x, y, { ...extra, time: (i + 1) * 8 })));
  const last = points[points.length - 1]!;
  tool.up?.(ctx, sample(last[0], last[1], { ...extra, time: points.length * 8 }));
}
