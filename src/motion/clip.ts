// Clip-path reveals on the motion engine: an element appears (or hides) through a growing circle, a wipe, a diamond,
// a split curtain or blinds. Pure keyframe builders (`clipFrames`) are shared with the page transition variants.
//   clipReveal(card, { shape: "circle", origin: { x: 20, y: 80 } })   // origin in % of the element
//   clipReveal(panel, { shape: "wipe", from: "start" })                 // "start" / "end" follow the text direction
//   clipReveal(panel, { shape: "blinds", count: 8, hide: true })
import { animate, type AnimateOptions, type Playback } from "./engine/playback.ts";

export type ClipShape = "circle" | "wipe" | "diamond" | "curtain" | "blinds" | "inset";
export type ClipSide = "start" | "end" | "top" | "bottom";
export interface ClipOptions {
  shape?: ClipShape;
  /** Circle / diamond centre in % of the element (default the centre). */
  origin?: { x: number; y: number };
  /** Wipe side it starts from (start / end mirror in RTL). */
  from?: ClipSide;
  /** Blinds: number of strips. */
  count?: number;
  /** Blinds: vertical strips. */
  vertical?: boolean;
  /** Inset: corner radius while revealing. */
  radius?: string;
  /** Right-to-left text direction (default: read from the element). */
  rtl?: boolean;
}

const pct = (v: number): string => `${Math.round(v * 100) / 100}%`;
const strips = (n: number, open: number, vertical: boolean): string => {
  const pts: string[] = [];
  // one polygon of n bands joined along the edge (zero-width joints draw nothing)
  for (let i = 0; i < n; i++) {
    const a = (i / n) * 100, b = a + (open * 100) / n;
    if (vertical) pts.push(`${pct(a)} 0%`, `${pct(b)} 0%`, `${pct(b)} 100%`, `${pct(a)} 100%`, `${pct(a)} 0%`);
    else pts.push(`0% ${pct(a)}`, `100% ${pct(a)}`, `100% ${pct(b)}`, `0% ${pct(b)}`, `0% ${pct(a)}`);
  }
  return `polygon(${pts.join(", ")})`;
};

/** The clip-path of a reveal at `p` (0 hidden … 1 shown). */
export function clipAt(p: number, o: ClipOptions = {}): string {
  const shape = o.shape ?? "circle", ox = o.origin?.x ?? 50, oy = o.origin?.y ?? 50;
  if (shape === "circle") {
    // a % radius is relative to the box diagonal / √2: this reaches the farthest corner from the origin (+ a margin)
    const r = Math.hypot(Math.max(ox, 100 - ox), Math.max(oy, 100 - oy)) * 1.06;
    return `circle(${pct(r * p)} at ${pct(ox)} ${pct(oy)})`;
  }
  if (shape === "diamond") {
    const d = 200 * p;
    return `polygon(${pct(ox)} ${pct(oy - d)}, ${pct(ox + d)} ${pct(oy)}, ${pct(ox)} ${pct(oy + d)}, ${pct(ox - d)} ${pct(oy)})`;
  }
  if (shape === "curtain") { const h = pct(50 * (1 - p)); return `inset(0% ${h} 0% ${h})`; }
  if (shape === "blinds") return strips(o.count ?? 6, p, !!o.vertical);
  if (shape === "inset") { const h = pct(50 * (1 - p)); return `inset(${h} ${h} ${h} ${h} round ${o.radius ?? "12px"})`; }
  // wipe: the hidden part shrinks toward the far side
  const side = o.from ?? "start", rtl = !!o.rtl;
  const left = (side === "start" && !rtl) || (side === "end" && rtl);
  const rest = pct(100 * (1 - p));
  if (side === "top") return `inset(0% 0% ${rest} 0%)`;
  if (side === "bottom") return `inset(${rest} 0% 0% 0%)`;
  return left ? `inset(0% ${rest} 0% 0%)` : `inset(0% 0% 0% ${rest})`;
}

/** Keyframes for a reveal (or a hide). Blinds and circles stay the same shape, so the browser interpolates them. */
export function clipFrames(o: ClipOptions & { hide?: boolean } = {}): Keyframe[] {
  const a = clipAt(0, o), b = clipAt(1, o);
  return o.hide ? [{ clipPath: b }, { clipPath: a }] : [{ clipPath: a }, { clipPath: b }];
}

const rtlOf = (el: Element): boolean => (el.closest?.("[dir]")?.getAttribute("dir") ?? globalThis.document?.documentElement?.getAttribute("dir")) === "rtl";

/** Reveal (or with `hide: true` hide) an element through a clip-path shape. */
export function clipReveal(el: Element, o: ClipOptions & AnimateOptions & { hide?: boolean } = {}): Playback {
  // the shape keys are not timing keys: the engine ignores them
  return animate(el, clipFrames({ ...o, rtl: o.rtl ?? rtlOf(el) }), { duration: 700, easing: "in-out", ...o });
}
