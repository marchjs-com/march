// Element morphs on the motion engine.
//   morph(button, dialog)            the dialog grows out of the button's box (container transform: clip + move, the
//                                    content is not stretched; colour and corner radius blend)
//   morphBack(dialog, button)        and shrinks back into it (then close / remove the dialog)
//   morph(thumb, big, { mode: "scale" })   shared element FLIP: same picture, scaled from one place to another
//   morphIcon(pathEl, "pause")       play↔pause, menu↔close, plus↔check: same-structure paths tween point by point
//   shapeMorph(el, "star")           clip-path polygons with the same point count (circle, square, star, hexagon…)
import { animate, type AnimateOptions, type Playback } from "./engine/playback.ts";
import { morphPath } from "./svg.ts";

export interface MorphOptions extends AnimateOptions {
  /** "clip" (default): the target is clipped to the source box and moved; "scale": FLIP with a scale (same content). */
  mode?: "clip" | "scale";
  /** Hide the source while the target is shown (default true; morphBack shows it again). */
  hideSource?: boolean;
  /** Fade the target's children in after the box has grown (clip mode, default true). */
  fadeContent?: boolean;
}

type Box = { x: number; y: number; w: number; h: number; r: string; bg: string };
function box(el: Element): Box {
  const b = el.getBoundingClientRect(), cs = globalThis.getComputedStyle?.(el);
  return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width || 1, h: b.height || 1, r: cs?.borderTopLeftRadius || "0px", bg: cs?.backgroundColor || "" };
}
const px = (v: number): string => `${Math.round(v * 100) / 100}px`;
const seen = (c: string): boolean => !!c && c !== "transparent" && !/rgba\(.*,\s*0\)$/.test(c);

// the frames that place `to` (drawn at box b) inside box a
function frames(a: Box, b: Box, mode: "clip" | "scale"): [Keyframe, Keyframe] {
  const move = `translate(${px(a.x - b.x)}, ${px(a.y - b.y)})`;
  if (mode === "scale") {
    return [{ transform: `${move} scale(${a.w / b.w}, ${a.h / b.h})` }, { transform: "none" }];
  }
  const iy = Math.max(0, (b.h - a.h) / 2), ix = Math.max(0, (b.w - a.w) / 2);
  const f0: Keyframe = { transform: move, clipPath: `inset(${px(iy)} ${px(ix)} round ${a.r})` };
  const f1: Keyframe = { transform: "none", clipPath: `inset(0px 0px round ${b.r})` };
  if (seen(a.bg) && seen(b.bg) && a.bg !== b.bg) { f0.backgroundColor = a.bg; f1.backgroundColor = b.bg; }
  return [f0, f1];
}
// unfilled: once grown, nothing stays on the target (its own shadow and radius show again)
const pick = (o: MorphOptions): AnimateOptions => ({ duration: 520, easing: "expo", fill: "none", ...o });
const vis = (el: Element, on: boolean): void => { (el as HTMLElement).style?.setProperty("visibility", on ? "" : "hidden"); };

// One morph run per element: a newer morph / morphBack on any of its elements stops it first (its effects removed,
// a source it hid shown again), so overlapping clicks and reopening never stack effects or measure a moved box.
interface Run { els: Element[]; anims: Playback[]; hidden: Element | null }
const runs = new WeakMap<Element, Run>();
function stop(el: Element, keepHidden?: Element): void {
  const r = runs.get(el);
  if (!r) return;
  for (const e of r.els) if (runs.get(e) === r) runs.delete(e);
  for (const a of r.anims) a.cancel();
  if (r.hidden && r.hidden !== keepHidden) vis(r.hidden, true);
}
function claim(r: Run): Run { for (const e of r.els) { stop(e, r.hidden ?? undefined); runs.set(e, r); } return r; }

/** `to` (already laid out where it ends) grows out of `from`'s box. */
export function morph(from: Element, to: Element, o: MorphOptions = {}): Playback {
  const mode = o.mode ?? "clip", hide = o.hideSource !== false;
  const r = claim({ els: [from, to], anims: [], hidden: hide ? from : null });
  const [f0, f1] = frames(box(from), box(to), mode);
  if (hide) vis(from, false);
  // one Playback for the box and its content: finish / cancel / finished cover both
  const p = animate(to, [f0, f1], { ...pick(o), autoplay: false });
  if (mode === "clip" && o.fadeContent !== false && to.children.length) {
    p.add(Array.from(to.children), [{ opacity: 0 }, { opacity: 1 }], { at: 0, duration: (o.duration ?? 520) * 0.5, delay: (o.duration ?? 520) * 0.3, easing: "out", fill: "backwards" });
  }
  r.anims.push(p);
  return o.autoplay === false ? p : p.play();
}

/** `from` (shown) shrinks into `to`'s box; `to` is shown again at the end. Remove or close `from` after `finished`. */
export function morphBack(from: Element, to: Element, o: MorphOptions = {}): Playback {
  // the shrunk state is held until the caller's `finished` handlers ran, then every effect and inline style comes off
  // `from` (a hidden `from` opens clean next time); a newer morph on either element cancels this one (state "idle")
  const mode = o.mode ?? "clip";
  const r = claim({ els: [from, to], anims: [], hidden: to });
  vis(to, false);
  const [f0, f1] = frames(box(to), box(from), mode);
  const p = animate(from, [f1, f0], { duration: 420, easing: "in-out", fill: "forwards", ...o, autoplay: false });
  if (mode === "clip" && o.fadeContent !== false && from.children.length) {
    p.add(Array.from(from.children), [{ opacity: 1 }, { opacity: 0 }], { at: 0, duration: (o.duration ?? 420) * 0.35, easing: "in", fill: "forwards" });
  }
  r.anims.push(p);
  if (o.autoplay !== false) p.play();
  const done = (): void => {
    if (runs.get(from) !== r) return; // stopped by a newer morph: it already cleaned up
    vis(to, true);
    r.hidden = null;
    // after the caller's own `finished` handlers (which hide or remove `from`): drop the held end state
    setTimeout(() => { if (runs.get(from) === r) stop(from); }, 0);
  };
  void p.finished.then(done, done);
  return p;
}

// ── icons: every shape is three 4-point bars (M L L L Z ×3), so any two tween number by number ──
type Pt = [number, number];
const quad = (q: Pt[]): string => `M${q.map((p) => `${+p[0].toFixed(2)} ${+p[1].toFixed(2)}`).join("L")}Z`;
const bar = (ax: number, ay: number, bx: number, by: number, w: number): Pt[] => {
  const l = Math.hypot(bx - ax, by - ay) || 1, nx = (-(by - ay) / l) * (w / 2), ny = ((bx - ax) / l) * (w / 2);
  return [[ax + nx, ay + ny], [bx + nx, by + ny], [bx - nx, by - ny], [ax - nx, ay - ny]];
};
const dot = (x: number, y: number): Pt[] => [[x, y], [x, y], [x, y], [x, y]];
const icon = (...qs: Pt[][]): string => qs.map(quad).join("");

/** Morphable icon outlines (24×24, filled). Any name morphs into any other. */
export const MORPH_ICONS = {
  play: icon([[7, 4], [13, 7.75], [13, 16.25], [7, 20]], [[13, 7.75], [19.5, 12], [19.5, 12], [13, 16.25]], dot(12, 12)),
  pause: icon([[6, 5], [10, 5], [10, 19], [6, 19]], [[14, 5], [18, 5], [18, 19], [14, 19]], dot(12, 12)),
  menu: icon(bar(4, 6, 20, 6, 2.2), bar(4, 18, 20, 18, 2.2), bar(4, 12, 20, 12, 2.2)),
  close: icon(bar(5.5, 5.5, 18.5, 18.5, 2.4), bar(5.5, 18.5, 18.5, 5.5, 2.4), dot(12, 12)),
  plus: icon(bar(4, 12, 20, 12, 2.4), bar(12, 4, 12, 20, 2.4), dot(12, 12)),
  check: icon(bar(4.5, 12.5, 9.5, 17.5, 2.4), bar(8.6, 17.5, 19.5, 6.5, 2.4), dot(12, 12)),
  minus: icon(bar(4, 12, 20, 12, 2.4), bar(12, 12, 12, 12, 2.4), dot(12, 12)),
} as const;
export type MorphIconName = keyof typeof MORPH_ICONS;

/** Morph an icon <path> into another MORPH_ICONS shape (or any `d` with the same commands). */
export function morphIcon(path: Element, to: MorphIconName | string, o: AnimateOptions = {}): Playback {
  const d = (MORPH_ICONS as Record<string, string>)[to] ?? to;
  stop(path);
  const p = morphPath(path, d, { duration: 380, easing: "spring-snappy", ...o });
  runs.set(path, { els: [path], anims: [p], hidden: null });
  return p;
}

// ── shapes: radial outlines sampled at the same angles, so clip-path polygons interpolate cleanly ──
export type ShapeName = "circle" | "square" | "triangle" | "diamond" | "hexagon" | "star" | "blob" | "flower";
const TAU = Math.PI * 2;
const ngon = (k: number, t: number): number => Math.cos(Math.PI / k) / Math.cos(((((t % (TAU / k)) + TAU / k) % (TAU / k)) - Math.PI / k));
const RADIUS: Record<ShapeName, (t: number) => number> = {
  circle: () => 1,
  square: (t) => ngon(4, t + Math.PI / 4) * 1.3,
  diamond: (t) => ngon(4, t),
  triangle: (t) => ngon(3, t + Math.PI / 2),
  hexagon: (t) => ngon(6, t),
  star: (t) => { const k = 5, s = (((t + Math.PI / 2) % (TAU / k)) + TAU / k) % (TAU / k) / (TAU / k); return 0.45 + 0.55 * Math.abs(1 - 2 * s) ** 1.6; },
  blob: (t) => 0.86 + 0.09 * Math.sin(3 * t + 0.6) + 0.06 * Math.cos(5 * t),
  flower: (t) => 0.72 + 0.28 * Math.abs(Math.cos(3 * t)),
};

/** A clip-path polygon for a shape (n points; the same n for every shape, so they morph). */
export function shapePolygon(shape: ShapeName, n = 60): string {
  const f = RADIUS[shape] ?? RADIUS.circle, pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * TAU - Math.PI / 2, r = f(t) * 50;
    pts.push(`${+(50 + r * Math.cos(t)).toFixed(2)}% ${+(50 + r * Math.sin(t)).toFixed(2)}%`);
  }
  return `polygon(${pts.join(", ")})`;
}

/** Morph an element's outline to a shape (clip-path polygon). The current outline is read from the element. */
export function shapeMorph(el: Element, to: ShapeName, o: AnimateOptions & { points?: number } = {}): Playback {
  const s = el as HTMLElement, n = o.points ?? 60;
  const prev = s.getAttribute("data-m-shape") as ShapeName | null;
  // interrupted mid-way: go on from the outline on screen (same point count), not from the last shape
  const cur = runs.has(el) ? globalThis.getComputedStyle?.(el)?.clipPath ?? "" : "";
  const from = cur.startsWith("polygon(") && cur.split(",").length === n ? cur : shapePolygon(prev ?? "circle", n), end = shapePolygon(to, n);
  s.setAttribute("data-m-shape", to);
  stop(el);
  s.style?.setProperty("clip-path", end);
  const p = animate(el, [{ clipPath: from }, { clipPath: end }], { duration: 650, easing: "spring", ...o });
  runs.set(el, { els: [el], anims: [p], hidden: null });
  return p;
}
