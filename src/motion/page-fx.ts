// Page transition variants for the router (on top of pageTransitions): each is its own export, register only the ones
// a route uses, then pick per route with `meta.transition`.
//   usePageTransitions(circle, cube, wipe)
//   { path: "/photo/:id", meta: { transition: "circle" } }
// Back reverses each one; "wipe", "stack", "cube" and "flip" follow the text direction (RTL mirrors them); "circle"
// and "morph" start where the pointer last pressed (a link, a card). Every frame is an engine animation.
import { definePageTransition, type PageTransitionFrames } from "./page.ts";
import { transitionOutlet } from "../router/index.ts";
import { clipAt } from "./clip.ts";

export interface PageVariant { readonly name: string; readonly frames: PageTransitionFrames }
type Side = "in" | "out";
type Dir = "forward" | "back";
const still: Keyframe[] = [{ opacity: 1 }, { opacity: 1 }];
const P = "perspective(1400px)";
const sgn = (dir: Dir, rtl: boolean): number => (dir === "back" ? -1 : 1) * (rtl ? -1 : 1);

// where the last press happened, as % of the page box (for circle and morph)
let press: { x: number; y: number; rect: DOMRect | null } = { x: 50, y: 50, rect: null };
let tracking = false;
function track(): void {
  if (tracking || !globalThis.addEventListener) return;
  tracking = true;
  globalThis.addEventListener("pointerdown", (e: PointerEvent) => {
    const hit = (e.target as Element | null)?.closest?.("a, button, [data-hm-morph]") ?? null;
    press = { x: e.clientX, y: e.clientY, rect: hit?.getBoundingClientRect() ?? null };
  }, { capture: true, passive: true });
}
function pageRect(): DOMRect | null {
  const el = (transitionOutlet()?.firstElementChild ?? globalThis.document?.documentElement) as Element | null;
  return el?.getBoundingClientRect?.() ?? null;
}
const rel = (x: number, y: number): { x: number; y: number } => {
  const r = pageRect();
  if (!r || !r.width || !r.height) return { x: 50, y: 50 };
  return { x: Math.min(100, Math.max(0, ((x - r.left) / r.width) * 100)), y: Math.min(100, Math.max(0, ((y - r.top) / r.height) * 100)) };
};
const pair = (side: Side, dir: Dir, open: Keyframe[], top = 2): Keyframe[] => {
  // forward: the new page opens over the old; back: the old page closes over the new
  if (dir === "forward") return side === "in" ? open.map((f) => ({ ...f, zIndex: top })) : still;
  return side === "out" ? [...open].reverse().map((f) => ({ ...f, zIndex: top, ...(typeof f.offset === "number" ? { offset: 1 - f.offset } : {}) })) : still;
};
const make = (name: string, frames: PageTransitionFrames): PageVariant => ({ name, frames });

/** The new page opens as a circle from the pressed point (back: the old one closes into it). */
export const circle: PageVariant = make("circle", (side, dir) => {
  track();
  const o = rel(press.x, press.y);
  return pair(side, dir, [{ clipPath: clipAt(0, { shape: "circle", origin: o }) }, { clipPath: clipAt(1, { shape: "circle", origin: o }) }]);
});

/** A straight wipe from the inline end (forward) or start (back); mirrored in RTL. */
export const wipe: PageVariant = make("wipe", (side, dir, rtl) => {
  const from = dir === "back" ? "start" : "end";
  return side === "in" ? [{ clipPath: clipAt(0, { shape: "wipe", from, rtl }), zIndex: 2 }, { clipPath: clipAt(1, { shape: "wipe", from, rtl }), zIndex: 2 }] : still;
});

/** Cards stack: the new page slides over the old one, which sinks back (back: it slides off again). */
export const stack: PageVariant = make("stack", (side, dir, rtl) => {
  const s = (rtl ? -1 : 1) * 100, back = dir === "back";
  const sunk: Keyframe = { transform: "scale(.92)", filter: "brightness(.72)" }, flat: Keyframe = { transform: "none", filter: "none" };
  if (!back) return side === "in" ? [{ transform: `translateX(${s}%)`, zIndex: 2 }, { transform: "none", zIndex: 2 }] : [flat, sunk];
  return side === "out" ? [{ transform: "none", zIndex: 2 }, { transform: `translateX(${s}%)`, zIndex: 2 }] : [sunk, flat];
});

/** A cube turns: the two pages are neighbouring faces meeting at the moving edge. */
export const cube: PageVariant = make("cube", (side, dir, rtl) => {
  const k = sgn(dir, rtl);
  // forward LTR: the old face hinges on its right edge and turns away to the left, the new one comes from the right
  if (side === "out") return [
    { transformOrigin: k > 0 ? "100% 50%" : "0% 50%", transform: `${P} translateX(0%) rotateY(0deg)`, filter: "brightness(1)" },
    { transformOrigin: k > 0 ? "100% 50%" : "0% 50%", transform: `${P} translateX(${-k * 100}%) rotateY(${-k * 90}deg)`, filter: "brightness(.6)" },
  ];
  return [
    { transformOrigin: k > 0 ? "0% 50%" : "100% 50%", transform: `${P} translateX(${k * 100}%) rotateY(${k * 90}deg)`, filter: "brightness(.6)" },
    { transformOrigin: k > 0 ? "0% 50%" : "100% 50%", transform: `${P} translateX(0%) rotateY(0deg)`, filter: "brightness(1)" },
  ];
});

/** A card flips over: the old page turns away, the new one is its back side. */
export const flip: PageVariant = make("flip", (side, dir, rtl) => {
  const k = sgn(dir, rtl);
  if (side === "out") return [
    { transform: `${P} rotateY(0deg)`, opacity: 1 },
    { offset: 0.5, transform: `${P} rotateY(${-k * 90}deg)`, opacity: 1 },
    { offset: 0.501, opacity: 0 }, { transform: `${P} rotateY(${-k * 90}deg)`, opacity: 0 },
  ];
  return [
    { transform: `${P} rotateY(${k * 90}deg)`, opacity: 0 },
    { offset: 0.5, transform: `${P} rotateY(${k * 90}deg)`, opacity: 0 },
    { offset: 0.501, opacity: 1 }, { transform: `${P} rotateY(0deg)`, opacity: 1 },
  ];
});

/** Fly through: the old page grows past the viewer, the new one comes up from the distance (back: the reverse). */
export const zoomThrough: PageVariant = make("zoom-through", (side, dir) => {
  const near = "scale(1.5)", far = "scale(.7)", b = dir === "back";
  return side === "out"
    ? [{ transform: "none", opacity: 1, filter: "blur(0px)" }, { transform: b ? far : near, opacity: 0, filter: "blur(6px)" }]
    : [{ transform: b ? near : far, opacity: 0, filter: "blur(6px)" }, { transform: "none", opacity: 1, filter: "blur(0px)" }];
});

/** Stage curtain: the new page opens from the middle out (back: the old one closes to the middle). */
export const curtain: PageVariant = make("curtain", (side, dir) =>
  pair(side, dir, [{ clipPath: clipAt(0, { shape: "curtain" }) }, { clipPath: clipAt(1, { shape: "curtain" }) }]));

/** Venetian blinds: strips open together. */
export const blinds: PageVariant = make("blinds", (side, dir, rtl) => {
  const o = { shape: "blinds" as const, count: 8, vertical: true, rtl };
  return pair(side, dir, [{ clipPath: clipAt(0, o) }, { clipPath: clipAt(1, o) }]);
});

// pixel dissolve: cells of a grid appear in a shuffled order (stepped keyframes; one polygon, same point count)
const COLS = 12, ROWS = 8, STEPS = 12;
let order: number[] | null = null;
function cellsPolygon(shown: number, ord: number[]): string {
  const pts: string[] = ["0% 0%"];
  const w = 100 / COLS, h = 100 / ROWS;
  for (let c = 0; c < ord.length; c++) {
    const i = ord[c]!, x = (i % COLS) * w, y = Math.floor(i / COLS) * h, on = c < shown;
    const x2 = on ? x + w : x, y2 = on ? y + h : y;
    pts.push(`${+x.toFixed(2)}% ${+y.toFixed(2)}%`, `${+x2.toFixed(2)}% ${+y.toFixed(2)}%`, `${+x2.toFixed(2)}% ${+y2.toFixed(2)}%`, `${+x.toFixed(2)}% ${+y2.toFixed(2)}%`, `${+x.toFixed(2)}% ${+y.toFixed(2)}%`, "0% 0%");
  }
  return `polygon(${pts.join(", ")})`;
}
/** Pixel dissolve: the new page appears cell by cell. */
export const pixelDissolve: PageVariant = make("pixel", (side, dir) => {
  if (!order) {
    // a fixed shuffle (deterministic, so tests and screenshots repeat)
    order = Array.from({ length: COLS * ROWS }, (_, i) => i);
    let seed = 7;
    for (let i = order.length - 1; i > 0; i--) { seed = (seed * 16807) % 2147483647; const j = seed % (i + 1); [order[i], order[j]] = [order[j]!, order[i]!]; }
  }
  const ord = order, n = ord.length;
  const open: Keyframe[] = Array.from({ length: STEPS + 1 }, (_, s) => ({ offset: s / STEPS, clipPath: cellsPolygon(Math.round((n * s) / STEPS), ord), easing: "steps(1, end)" }));
  return pair(side, dir, open);
});

/** Morph: the new page grows out of the pressed link or card (rounded box → full page). */
export const morphPage: PageVariant = make("morph", (side, dir) => {
  track();
  const r = pageRect(), b = press.rect;
  let from = clipAt(0, { shape: "inset", radius: "24px" });
  if (r && b && r.width && r.height) {
    const t = Math.max(0, ((b.top - r.top) / r.height) * 100), l = Math.max(0, ((b.left - r.left) / r.width) * 100);
    const bt = Math.max(0, ((r.bottom - b.bottom) / r.height) * 100), rt = Math.max(0, ((r.right - b.right) / r.width) * 100);
    from = `inset(${t.toFixed(2)}% ${rt.toFixed(2)}% ${bt.toFixed(2)}% ${l.toFixed(2)}% round 16px)`;
  }
  return pair(side, dir, [{ clipPath: from, opacity: 0.6 }, { offset: 0.35, opacity: 1 }, { clipPath: "inset(0% 0% 0% 0% round 0px)", opacity: 1 }]);
});

/** Every variant above. */
export const PAGE_VARIANTS: readonly PageVariant[] = [circle, wipe, stack, cube, flip, zoomThrough, curtain, blinds, pixelDissolve, morphPage];

/** Register variants so routes can name them in `meta.transition`. */
export function usePageTransitions(...variants: PageVariant[]): void {
  for (const v of variants) definePageTransition(v.name, v.frames);
}
