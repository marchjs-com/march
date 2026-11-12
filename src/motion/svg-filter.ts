// SVG filter animations on the motion engine: the filter's numbers (blur, displacement scale) are engine values, so
// global speed, "pause all" and reduced motion reach them. Each call makes its own filter in a 0×0 <svg> beside the element.
//   filterBlur(title, { from: 16, axis: "x" })          // directional (motion) blur settling to sharp
//   displace(card, { from: 60, to: 0, frequency: 0.02 }) // turbulence ripples that calm down
//   const off = goo(blobs, { blur: 12 })                 // children melt together where they meet (static filter)
import { animateValue } from "./engine/value.ts";
import type { AnimateOptions, Playback } from "./engine/playback.ts";
import { uid } from "../core/util.ts";

const NS = "http://www.w3.org/2000/svg";
const make = <K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] => {
  const el = globalThis.document.createElementNS(NS, tag);
  for (const k in attrs) el.setAttribute(k, String(attrs[k]));
  return el;
};

/**
 * A filter (id `hm-f-…`) with the given primitives in its own 0×0 <svg>, placed right after the element (not in
 * <body>: components never append there; absolutely positioned, so it takes no grid or flex slot).
 * `use(el)` points the element's CSS filter at it and returns the cleanup.
 */
function filter(prims: SVGElement[]): { id: string; node: SVGFilterElement; use(el: Element): () => void } {
  const id = uid("hm-f");
  // a generous region: blurs and displacement draw outside the element's box
  const node = make("filter", { id, x: "-20%", y: "-20%", width: "140%", height: "140%", "color-interpolation-filters": "sRGB" });
  node.append(...prims);
  const host = make("svg", { width: 0, height: 0, "aria-hidden": "true", focusable: "false" });
  host.style.cssText = "position:absolute;width:0;height:0;overflow:hidden;pointer-events:none";
  host.append(node);
  return {
    id, node,
    use(el) {
      el.parentNode?.insertBefore(host, el.nextSibling);
      const s = (el as HTMLElement).style, prev = s.filter;
      s.filter = `url(#${id})`;
      return () => { s.filter = prev || ""; host.remove(); };
    },
  };
}

/** Run an engine value and write it into a filter attribute; the filter is removed at the end unless `keep`. */
function drive(el: Element, f: ReturnType<typeof filter>, from: number, to: number, write: (v: number) => void, o: AnimateOptions & { keep?: boolean }): Playback {
  const off = f.use(el);
  write(from);
  const { keep, ...timing } = o;
  return animateValue(from, to, { duration: 800, easing: "out", ...timing, onUpdate: write, onComplete: () => { if (!keep && to === 0) off(); timing.onComplete?.(); } });
}

export interface BlurOptions extends AnimateOptions { from?: number; to?: number; /** One axis only: a motion blur. */ axis?: "x" | "y" | "both"; keep?: boolean }

/** Blur in or out through an SVG Gaussian blur (one axis for a motion blur). */
export function filterBlur(el: Element, o: BlurOptions = {}): Playback {
  const { from = 12, to = 0, axis = "both", ...rest } = o;
  const blur = make("feGaussianBlur", { in: "SourceGraphic", stdDeviation: 0 });
  const f = filter([blur]);
  const r = (v: number): number => Math.max(0, Math.round(v * 100) / 100);
  return drive(el, f, from, to, (v) => blur.setAttribute("stdDeviation", axis === "x" ? `${r(v)} 0` : axis === "y" ? `0 ${r(v)}` : `${r(v)}`), rest);
}

export interface DisplaceOptions extends AnimateOptions { from?: number; to?: number; /** Turbulence base frequency. */ frequency?: number; octaves?: number; seed?: number; keep?: boolean }

/** Distort through turbulence: the displacement scale animates `from` → `to` (water, heat, glitch-in). */
export function displace(el: Element, o: DisplaceOptions = {}): Playback {
  const { from = 50, to = 0, frequency = 0.015, octaves = 2, seed = 3, ...rest } = o;
  const noise = make("feTurbulence", { type: "fractalNoise", baseFrequency: frequency, numOctaves: octaves, seed, result: "n" });
  const map = make("feDisplacementMap", { in: "SourceGraphic", in2: "n", scale: from, xChannelSelector: "R", yChannelSelector: "G" });
  return drive(el, filter([noise, map]), from, to, (v) => map.setAttribute("scale", String(Math.round(v * 10) / 10)), rest);
}

export interface GooOptions { /** Blur radius: how far shapes reach for each other. */ blur?: number; /** Edge sharpness (alpha contrast). */ contrast?: number }

/** Gooey metaballs: the element's children melt together where they meet. Returns a function that removes it. */
export function goo(el: Element, o: GooOptions = {}): () => void {
  const b = o.blur ?? 10, c = o.contrast ?? 20;
  const f = filter([
    make("feGaussianBlur", { in: "SourceGraphic", stdDeviation: b, result: "b" }),
    make("feColorMatrix", { in: "b", mode: "matrix", values: `1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 ${c} ${-c * 0.45}`, result: "g" }),
    make("feComposite", { in: "SourceGraphic", in2: "g", operator: "atop" }),
  ]);
  return f.use(el);
}
