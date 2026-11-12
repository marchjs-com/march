// SVG animation on the motion engine: draw a stroke, morph one path into another (any point count), move along a path.
//   drawPath(svg.querySelectorAll("path"), { duration: 1200, stagger: 80 })   — strokes draw in (pathLength=1 dash trick)
//   morphPath(pathEl, starD, { easing: "spring" })                             — different point counts are resampled
//   followPath(dotEl, roadD, { rotate: true, iterations: Infinity })           — position + tangent each frame
// Every helper returns the engine Playback: global speed, "pause all" and reduced motion reach it.
import { animate, type AnimateOptions, type Playback } from "./engine/playback.ts";
import { animateValue } from "./engine/value.ts";
import { interpolatePath, pathSampler } from "./path.ts";

type Many = Element | ArrayLike<Element> | string;
const list = (t: Many, root?: ParentNode): Element[] =>
  typeof t === "string" ? Array.from((root ?? globalThis.document)?.querySelectorAll(t) ?? []) : "length" in t ? Array.from(t) : [t];

export interface DrawOptions extends AnimateOptions {
  /** Drawn part at the start and the end (0..1). `{ from: 1, to: 0 }` erases. */
  from?: number;
  to?: number;
}

/** Draw strokes in: works for path, line, polyline, polygon, circle, rect and ellipse. */
export function drawPath(targets: Many, o: DrawOptions = {}): Playback {
  const { from = 0, to = 1, ...rest } = o;
  const els = list(targets, o.root);
  for (const el of els) {
    // a normalized length: no measuring, the dash is the whole stroke
    el.setAttribute("pathLength", "1");
    (el as SVGElement).style?.setProperty("stroke-dasharray", "1 1");
    (el as SVGElement).style?.setProperty("stroke-dashoffset", String(1 - from));
  }
  return animate(els, [{ strokeDashoffset: 1 - from }, { strokeDashoffset: 1 - to }], { duration: 900, easing: "in-out", fill: "forwards", ...rest });
}

export interface MorphPathOptions extends AnimateOptions {
  /** Points used when the two paths have different commands (default 72). */
  points?: number;
}

/** Morph a <path> into another `d`. Returns the Playback; at the end `d` is exactly `to`. */
export function morphPath(el: Element, to: string, o: MorphPathOptions = {}): Playback {
  const { points, ...rest } = o;
  const from = el.getAttribute("d") ?? to;
  const mix = interpolatePath(from, to, points ? { points } : {});
  return animateValue(0, 1, {
    duration: 600, easing: "in-out", ...rest,
    onUpdate: (t: number) => el.setAttribute("d", mix(t)),
    onComplete: () => { el.setAttribute("d", to); rest.onComplete?.(); },
  });
}

export interface FollowOptions extends AnimateOptions {
  /** Turn with the path's tangent. */
  rotate?: boolean;
  /** Extra rotation in degrees (an arrow drawn pointing up: 90). */
  angle?: number;
  /** Part of the path to travel (0..1). */
  from?: number;
  to?: number;
  /** A stroke drawn up to the element in the same frame (a path, line or polyline over the same route). */
  trail?: Element;
}

/**
 * Move an element along a path (a `d` string or a path element). SVG elements get a `transform` attribute in user
 * units; HTML elements a CSS transform in px (draw the path in the element's offset parent coordinates).
 */
export function followPath(el: Element, path: string | Element, o: FollowOptions = {}): Playback {
  const { rotate = false, angle = 0, from = 0, to = 1, trail, ...rest } = o;
  if (trail) { trail.setAttribute("pathLength", "1"); (trail as SVGElement).style.strokeDasharray = "1 1"; }
  const at = pathSampler(typeof path === "string" ? path : path.getAttribute("d") ?? "");
  const svg = el.namespaceURI === "http://www.w3.org/2000/svg";
  const place = (p: number): void => {
    const q = at(p), a = rotate ? q.angle + angle : angle;
    const x = Math.round(q.x * 100) / 100, y = Math.round(q.y * 100) / 100, r = Math.round(a * 10) / 10;
    if (svg) el.setAttribute("transform", `translate(${x} ${y})${r ? ` rotate(${r})` : ""}`);
    else (el as HTMLElement).style.transform = `translate(${x}px, ${y}px)${r ? ` rotate(${r}deg)` : ""}`;
    if (trail) (trail as SVGElement).style.strokeDashoffset = String(Math.round((1 - p) * 10000) / 10000);
  };
  place(from);
  return animateValue(from, to, { duration: 2000, easing: "in-out", ...rest, onUpdate: place });
}
