// The canvas every audio view draws on (Oscilloscope, Spectrum, Waveform): sized to its box in device pixels, redrawn
// when the box or the theme changes (one shared watcher of the root's theme, accent and class attributes), and given
// the theme's colors as plain CSS colors read from custom properties (a canvas cannot read var()). The view draws in CSS pixels; the scale is set for it.
//   const view = audioCanvas(canvasEl, (ctx, w, h, color) => { ctx.strokeStyle = color("--m-oscope-line"); … })
//   view.draw()   // after new readings (the source's onUpdate)
import { observeSize } from "../ui/observe.ts";
import { mutate } from "../motion/engine/clock.ts";
import { onCleanup } from "../core/reactive.ts";

// one observer of the page root for every canvas: a theme / accent / mode change re-reads the colors
const restyled = new Set<() => void>();
let rootWatch: MutationObserver | null = null;
function onRestyle(fn: () => void): () => void {
  const MO = globalThis.MutationObserver, root = globalThis.document?.documentElement;
  if (!rootWatch && typeof MO === "function" && root) {
    rootWatch = new MO(() => { for (const f of [...restyled]) f(); });
    rootWatch.observe(root, { attributes: true, attributeFilter: ["data-theme", "data-m-theme", "data-m-accent", "class", "style"] });
  }
  restyled.add(fn);
  return () => { restyled.delete(fn); };
}

/** Draws one frame: the context (already scaled), the box in CSS px, and a theme color reader. */
export type AudioCanvasDraw = (ctx: CanvasRenderingContext2D, width: number, height: number, color: (name: string, fallback?: string) => string) => void;

export interface AudioCanvas {
  /** Draw now. */
  draw(): void;
  /** Read colors again (call after a theme change; a size change does it by itself). */
  refresh(): void;
}

/** Wrap `canvas` for drawing `draw` (see the top of this file). */
export function audioCanvas(canvas: HTMLCanvasElement, draw: AudioCanvasDraw): AudioCanvas {
  const ctx = canvas.getContext?.("2d") ?? null;
  let w = 0, h = 0, colors = new Map<string, string>(), queued = false;
  const color = (name: string, fallback = "#888"): string => {
    let c = colors.get(name);
    if (c === undefined) {
      c = globalThis.getComputedStyle?.(canvas).getPropertyValue(name).trim() || fallback;
      colors.set(name, c);
    }
    return c;
  };
  const paint = (): void => {
    if (!ctx || !w || !h) return;
    const dpr = globalThis.devicePixelRatio || 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    draw(ctx, w, h, color);
  };
  observeSize(canvas, (s) => {
    const dpr = globalThis.devicePixelRatio || 1;
    w = s.width; h = s.height; colors = new Map();
    // the bitmap is written in the frame's write phase, with the drawing right after it
    if (!queued) { queued = true; mutate(() => { queued = false; canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); paint(); }); }
  });
  const refresh = (): void => { colors = new Map(); mutate(paint); };
  onCleanup(onRestyle(refresh));
  return { draw: paint, refresh };
}
