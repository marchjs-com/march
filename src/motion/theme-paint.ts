// The painted theme waves (themeWave shapes "drip", "spray", "sweep", "splat"): a lazy part of the motion package,
// loaded the first time one of them runs (installThemeWave loads it ahead). No snapshots and nothing waits: the page
// takes the new look at once and stays the page (every press and key reaches it, its animations run on); above it a
// passive veil (.m-wave-veil: no pointer, inert, hidden from assistive tech) holds a live copy of the page in the old
// look, kept in step with the page while it is up, and the paint eats soft holes into the veil until none of it is left.
//   drip   a thick paint poured at one place along the top: a stream runs down fast, the paint spreads to both
//          sides in a waving edge of rounded lobes, drips run ahead; a shine along its edge
//   spray  a spray can from a random place: a dense core, a mist of fine specks thinning out, splats and drips
//          (a CSS Paint worklet, spray-worklet.js, served by the app); without it one nozzle in strokes of soft spots
//   sweep  the nozzle sweeps its row from a random place, then the rows above and below in turn
//   splat  patches burst out from the pressed point, specks flying ahead
import { animateEl } from "./env.ts";
import { onFrame } from "./engine/clock.ts";
import { clamp } from "../core/util.ts";

export type PaintShape = "drip" | "spray" | "sweep" | "splat";
export interface PaintOptions { shape: PaintShape; origin?: { x: number; y: number } | null | undefined; duration?: number | undefined }

/**
 * The spray's paint worklet (spray-worklet.js, served by the app from its own origin): loaded once; until it is in
 * (or where CSS Paint is missing) "spray" falls back to soft mask spots.
 */
let sprayWorklet: Promise<boolean> | null = null, sprayOn = false;
export function prepareSpray(url: string): Promise<boolean> {
  const css = (globalThis as { CSS?: { paintWorklet?: { addModule(u: string): Promise<void> }; registerProperty?: (d: object) => void; supports?: (p: string, v: string) => boolean } }).CSS;
  if (sprayWorklet) return sprayWorklet;
  if (!css?.paintWorklet || !css.supports?.("mask-image", "paint(m-spray)")) return (sprayWorklet = Promise.resolve(false));
  // the progress is a typed number, so the browser animates it smoothly (and may paint off the main thread)
  try { css.registerProperty?.({ name: "--m-spray-t", syntax: "<number>", inherits: false, initialValue: "0" }); } catch { /* registered already */ }
  return (sprayWorklet = css.paintWorklet.addModule(url).then(() => (sprayOn = true), () => false));
}

/** One spot of paint: centre, full radius, when it starts (0–1 of the wave) and how long it takes to grow. */
export interface Spot { x: number; y: number; r: number; at: number; grow: number }
type Rnd = () => number;
const STEPS = 16;
const px = (v: number): string => `${Math.round(v * 10) / 10}px`;
/** When the last spot starts: the rest of the wave lets it land. */
const END = 0.85;

/**
 * Like a hand with a can: one nozzle starts at a random place and paints in strokes, each in a direction of its own
 * (along with a drift, across, up, down, aslant), each heading for a part still bare, bending a little and turning back
 * at the edges, until no place is bare. Where it passes it leaves a dense core and a mist of small drops.
 */
export function spraySpots(w: number, h: number, rnd: Rnd = Math.random): Spot[] {
  const cell = Math.max(w, h) / 7.5;
  // the places that must get paint: a grid half a cell apart, edges and corners included
  const g = cell / 2, cols = Math.ceil(w / g) + 1, rows = Math.ceil(h / g) + 1;
  const gx = (i: number): number => Math.min(w, (i % cols) * g), gy = (i: number): number => Math.min(h, Math.floor(i / cols) * g);
  const bare = new Set<number>();
  for (let i = 0; i < cols * rows; i++) bare.add(i);
  const core = cell * 1.05, step = cell * 0.85;
  const marks: { x: number; y: number }[] = [];
  let x = w * (0.15 + 0.7 * rnd()), y = h * (0.15 + 0.7 * rnd());
  const dab = (): void => {
    marks.push({ x, y });
    for (const i of bare) if (Math.hypot(gx(i) - x, gy(i) - y) < core * 0.5) bare.delete(i);
  };
  dab();
  for (let strokes = 0; bare.size && strokes < 400; strokes++) {
    // the next stroke heads for a bare place, a near one more likely, with its own slant
    const left = [...bare].map((i) => ({ i, d: Math.hypot(gx(i) - x, gy(i) - y) })).sort((a, b) => a.d - b.d);
    const pick = left[Math.min(left.length - 1, Math.floor(rnd() * rnd() * Math.min(6, left.length)))]!;
    let a = Math.atan2(gy(pick.i) - y, gx(pick.i) - x) + (rnd() - 0.5) * 0.7;
    const bend = (rnd() - 0.5) * 0.12;
    // a stroke runs past its goal for a while (a hand does not stop dead)
    const len = Math.max(2, Math.round((pick.d / step) * (1 + 0.6 * rnd())));
    for (let k = 0; k < len; k++) {
      x += Math.cos(a) * step; y += Math.sin(a) * step; a += bend;
      if (x < 0 || x > w) { a = Math.PI - a; x = clamp(x, 0, w); }
      if (y < 0 || y > h) { a = -a; y = clamp(y, 0, h); }
      dab();
    }
  }
  const spots: Spot[] = [];
  const last = Math.max(1, marks.length - 1);
  marks.forEach((m, t) => {
    const at = (t / last) * END;
    spots.push({ x: m.x + (rnd() - 0.5) * cell * 0.15, y: m.y + (rnd() - 0.5) * cell * 0.15, r: core * (0.95 + 0.15 * rnd()), at, grow: 0.07 });
    const da = rnd() * Math.PI * 2, d = core * (0.75 + 0.7 * rnd());
    spots.push({ x: m.x + Math.cos(da) * d, y: m.y + Math.sin(da) * d, r: 3 + 8 * rnd(), at: at + 0.01 * rnd(), grow: 0.04 });
  });
  return spots;
}

/**
 * The nozzle sweeps its row from a random place to one side, comes back past the start to the other, then takes the
 * rows below and above in turn, each from the side where it is, leaving two patches per cell and a mist around it.
 */
export function sweepSpots(w: number, h: number, rnd: Rnd = Math.random): Spot[] {
  const cell = Math.max(w, h) / 9, cols = Math.ceil(w / cell), rows = Math.ceil(h / cell);
  const r0 = Math.floor(rnd() * rows), c0 = Math.floor(rnd() * cols);
  const order: number[] = [r0];
  for (let k = 1; order.length < rows; k++) { if (r0 + k < rows) order.push(r0 + k); if (r0 - k >= 0) order.push(r0 - k); }
  const path: [number, number][] = [];
  const first: number[] = [];
  if (rnd() < 0.5) { for (let c = c0; c < cols; c++) first.push(c); for (let c = c0 - 1; c >= 0; c--) first.push(c); }
  else { for (let c = c0; c >= 0; c--) first.push(c); for (let c = c0 + 1; c < cols; c++) first.push(c); }
  for (const c of first) path.push([r0, c]);
  for (const row of order.slice(1)) {
    const at = path[path.length - 1]![1];
    for (let i = 0; i < cols; i++) path.push([row, at < cols / 2 ? i : cols - 1 - i]);
  }
  const spots: Spot[] = [];
  path.forEach(([row, c], i) => {
    const at = (i / path.length) * 0.78;
    for (let k = 0; k < 2; k++) {
      spots.push({ x: (c + 0.5 + 0.4 * (rnd() - 0.5)) * cell, y: (row + 0.5 + 0.4 * (rnd() - 0.5)) * cell, r: cell * (1.1 + 0.25 * rnd()), at: at + 0.02 * k, grow: 0.14 + 0.06 * rnd() });
    }
    const a = rnd() * Math.PI * 2, d = cell * (0.9 + 0.9 * rnd());
    spots.push({ x: (c + 0.5) * cell + Math.cos(a) * d, y: (row + 0.5) * cell + Math.sin(a) * d, r: 3 + 7 * rnd(), at, grow: 0.05 });
  });
  return spots;
}

/** Patches on a jittered grid burst out from the pressed point (nearest first, each a little early or late), a few
 *  fine drops around each and specks flying ahead. */
export function splatSpots(w: number, h: number, ox: number, oy: number, rnd: Rnd = Math.random): Spot[] {
  const cell = Math.max(w, h) / 7, cols = Math.ceil(w / cell) + 1, rows = Math.ceil(h / cell) + 1;
  const far = Math.hypot(Math.max(ox, w - ox), Math.max(oy, h - oy)) || 1;
  const spots: Spot[] = [{ x: ox, y: oy, r: cell * 1.3, at: 0, grow: 0.32 }];
  for (let i = 0; i < cols; i++) for (let j = 0; j < rows; j++) {
    const x = (i + 0.4 * (rnd() - 0.5)) * cell, y = (j + 0.4 * (rnd() - 0.5)) * cell;
    const at = Math.min(0.6, (Math.hypot(x - ox, y - oy) / far) * 0.55 + 0.1 * rnd());
    const patch = { x, y, r: cell * (1.15 + 0.25 * rnd()), at, grow: 0.26 + 0.14 * rnd() };
    spots.push(patch);
    const a = rnd() * Math.PI * 2, d = patch.r * (0.55 + 0.25 * rnd());
    spots.push({ x: x + Math.cos(a) * d, y: y + Math.sin(a) * d, r: 5 + 9 * rnd(), at: at + patch.grow * 0.25, grow: 0.1 });
  }
  for (let k = 0; k < 30; k++) {
    const a = rnd() * Math.PI * 2, d = rnd() * far;
    const x = ox + Math.cos(a) * d, y = oy + Math.sin(a) * d;
    if (x < -10 || y < -10 || x > w + 10 || y > h + 10) continue;
    spots.push({ x, y, r: 5 + 10 * rnd(), at: Math.max(0, (d / far) * 0.55 - 0.1 * rnd()), grow: 0.12 });
  }
  return spots;
}

/**
 * One layer of the veil's mask: the picture it draws and where it is, how big, at a moment of the wave (0–1):
 * [x, y, width, height]. Only place and size change over the wave, so the browser tweens the layers between keyframes.
 * Picture: `dot`, a soft round spot (its edge fades: the sprayed look).
 */
export interface Layer { kind: "dot"; box(t: number): readonly [number, number, number, number] }
const IMAGE: Record<Layer["kind"], string> = {
  dot: "radial-gradient(closest-side, #000 38%, rgba(0,0,0,.7) 58%, rgba(0,0,0,.28) 78%, transparent)",
};

/** A spot as a layer: it grows from its centre once its time comes. */
export const spotLayer = (s: Spot): Layer => ({ kind: "dot", box: (t) => {
  const p = clamp((t - s.at) / s.grow, 0, 1), r = s.r * (1 - (1 - p) ** 3);
  return [s.x - r, s.y - r, 2 * r, 2 * r];
} });

/**
 * A thick paint poured from the top, as one outline: it is poured at one place, where a thick stream runs down
 * fast; from there it spreads to both sides, the edge (points across the screen, each at its own pace) coming down
 * later and slower the farther it is from the pour, in smooth rounded lobes, everything slowing as the paint runs out;
 * from some places along the edge a drip runs ahead, a neck narrowing down to a heavy round drop. `at(t)` gives the
 * edge and the drips at a moment of the wave; by the end the edge is past the bottom.
 */
export interface Drip { x: number; y: number; length: number; neck: number; drop: number }
export interface DripState { w: number; h: number; at(t: number): { edge: readonly (readonly [number, number])[]; drips: readonly Drip[] }; dripsAt: readonly number[] }
export function dripState(w: number, h: number, rnd: Rnd = Math.random): DripState {
  const k = Math.max(6, Math.round(w / Math.max(90, Math.min(w, h) / 4.5)));
  const pad = 40, dx = (w + 2 * pad) / k;
  // the paint is poured at one place along the top; from there it spreads to both sides: the farther a point of the
  // edge is from the pour, the later it starts and the slower it comes down
  const pour = w * (0.25 + 0.5 * rnd());
  const points = Array.from({ length: k + 1 }, (_, j) => {
    const x = -pad + j * dx + (j && j < k ? (rnd() - 0.5) * dx * 0.3 : 0), far = Math.abs(x - pour) / w;
    const start = 0.03 + far * 0.3 + 0.04 * rnd();
    return { x, start, end: Math.min(0.95, start + 0.55 + far * 0.2 + 0.06 * rnd()) };
  });
  // the drips sit between edge points (the segment index), each with its own reach and pace; the pour itself is the
  // first: a thick stream that runs down fast from the top
  const dripsAt: number[] = [], drips: { seg: number; reach: number; from: number; grow: number; neck: number; drop: number; shift: number }[] = [];
  const at = Math.max(0, points.findIndex((p, j) => j < k && points[j + 1]!.x > pour));
  const a = points[at]!.x, b = points[at + 1]!.x;
  const thick = dx * (0.36 + 0.1 * rnd());
  drips.push({ seg: at, reach: h * 1.05, from: 0, grow: 0.62, neck: thick, drop: thick * 1.35, shift: clamp((pour - a) / (b - a) - 0.5, -0.15, 0.15) });
  dripsAt.push(at);
  for (let j = 0; j < k; j++) {
    if (j === at || rnd() < 0.4) continue;
    const neck = dx * (0.18 + 0.12 * rnd());
    drips.push({ seg: j, reach: h * (0.15 + 0.35 * rnd()), from: points[j]!.start + 0.04 + 0.15 * rnd(), grow: 0.25 + 0.3 * rnd(), neck, drop: neck * (1.7 + 0.5 * rnd()), shift: (rnd() - 0.5) * 0.3 });
    dripsAt.push(j);
  }
  const reach = h + pad + Math.max(0, ...drips.map((d) => d.drop * 2));
  // fast at first, slowing as the paint runs out (an ease out)
  const level = (p: { start: number; end: number }, t: number): number => -pad + (reach + pad) * (1 - (1 - clamp((t - p.start) / (p.end - p.start), 0, 1)) ** 1.6);
  return {
    w, h, dripsAt,
    at: (t) => {
      const edge = points.map((p) => [p.x, level(p, t)] as const);
      // (the drips read the edge where they leave it)
      return {
        edge,
        drips: drips.map((d) => {
          const a = edge[d.seg]!, b = edge[d.seg + 1]!, f = 0.5 + d.shift;
          // a drip gathers, runs, and slows as it thins (smooth at both ends); it leaves the edge, never above the page
          const p = clamp((t - d.from) / d.grow, 0, 1), run = p * p * (3 - 2 * p);
          return { x: a[0] + (b[0] - a[0]) * f, y: Math.max(0, a[1] + (b[1] - a[1]) * f), length: d.reach * run, neck: d.neck * (0.6 + 0.4 * run), drop: d.drop * clamp(run * 3, 0, 1) };
        }),
      };
    },
  };
}

const n1 = (v: number): string => String(Math.round(v * 10) / 10);

/**
 * The paint's outline at a moment as a path: the top (above the screen), then its lower edge from right to left
 * through every point of the edge and, on the way, every drip (out of the edge in a soft shoulder, down the neck,
 * round the drop, up the neck, back in), all as one smooth curve through those points (a Catmull-Rom spline: no
 * corner anywhere, a liquid has none). Always the same commands, so the browser tweens it between keyframes. `dx`,
 * `dy` move it (the shine's copy).
 */
export function liquidPath(s: DripState, t: number, dx = 0, dy = 0): string {
  const { edge, drips } = s.at(t);
  const pts: [number, number][] = [];
  for (let j = edge.length - 1; j >= 0; j--) {
    pts.push([edge[j]![0], edge[j]![1]]);
    const di = j > 0 ? s.dripsAt.indexOf(j - 1) : -1;
    if (di < 0) continue;
    // the drip stays within its stretch of the edge (wider, the outline would fold over itself)
    const q = drips[di]!, room = Math.max(0, Math.min(q.x - edge[j - 1]![0], edge[j]![0] - q.x) * 0.9);
    const n = Math.min(q.neck / 2, room * 0.6), f = Math.min(q.neck * 0.9, room - n), r = Math.min(Math.max(n, q.drop / 2), room), L = q.length, y = q.y;
    // grows from nothing: a drip that has not started is all at one point of the edge
    const k = L > 0 ? 1 : 0;
    pts.push([q.x + (n + f) * k, y], [q.x + n * k, y + L * 0.45], [q.x + r * k, y + L], [q.x + r * 0.7 * k, y + L + r * 0.75 * k],
      [q.x, y + L + r * k], [q.x - r * 0.7 * k, y + L + r * 0.75 * k], [q.x - r * k, y + L], [q.x - n * k, y + L * 0.45], [q.x - (n + f) * k, y]);
  }
  const P = (i: number): [number, number] => pts[clamp(i, 0, pts.length - 1)]!;
  const X = (v: number): string => n1(v + dx), Y = (v: number): string => n1(v + dy);
  const first = pts[0]!, last = pts[pts.length - 1]!;
  let d = `M${X(last[0])} -60L${X(first[0])} -60L${X(first[0])} ${Y(first[1])}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
    d += `C${X(p1[0] + (p2[0] - p0[0]) / 6)} ${Y(p1[1] + (p2[1] - p0[1]) / 6)} ${X(p2[0] - (p3[0] - p1[0]) / 6)} ${Y(p2[1] - (p3[1] - p1[1]) / 6)} ${X(p2[0])} ${Y(p2[1])}`;
  }
  return `${d}Z`;
}

const STEPS_LIQUID = 30;
/** The paint's outline at every step: `inside` the paint itself; else everything but the paint (the screen with a
 *  hole, to be filled even-odd). */
function liquidPaths(s: DripState, inside: boolean, dx = 0, dy = 0): string[] {
  const frame = `M-100 -100H${n1(s.w + 100)}V${n1(s.h + 100)}H-100Z`;
  return Array.from({ length: STEPS_LIQUID + 1 }, (_, i) => { const p = liquidPath(s, i / STEPS_LIQUID, dx, dy); return inside ? p : frame + p; });
}
/** Keyframes of a clip by the paint (CSS clip-path): `inside` the paint itself; else everything but the paint. */
export function liquidFrames(s: DripState, inside: boolean, dx = 0, dy = 0): Keyframe[] {
  return liquidPaths(s, inside, dx, dy).map((p, i) => ({ offset: i / STEPS_LIQUID, clipPath: inside ? `path("${p}")` : `path(evenodd, "${p}")` } as Keyframe));
}
/** The layers of a shape. */
export function paintLayers(shape: Exclude<PaintShape, "drip">, w: number, h: number, origin?: { x: number; y: number } | null, rnd: Rnd = Math.random): Layer[] {
  const spots = shape === "spray" ? spraySpots(w, h, rnd) : shape === "sweep" ? sweepSpots(w, h, rnd) : splatSpots(w, h, origin?.x ?? w / 2, origin?.y ?? 0, rnd);
  return spots.map(spotLayer);
}



/**
 * The paint as mask keyframes: every layer's size and place at each step (the same layers in every keyframe, so the
 * browser tweens them, and each layer is painted only inside its own box). With `full`, a first layer covers
 * everything (the veil: everything minus the paint).
 */
export function paintFrames(layers: readonly Layer[], full = true): Keyframe[] {
  const frames: Keyframe[] = [];
  for (let k = 0; k <= STEPS; k++) {
    const t = k / STEPS;
    const size = full ? ["100% 100%"] : [], pos = full ? ["0px 0px"] : [];
    for (const l of layers) {
      const [x, y, bw, bh] = l.box(t);
      size.push(`${px(bw)} ${px(bh)}`); pos.push(`${px(x)} ${px(y)}`);
    }
    frames.push({ offset: t, maskSize: size.join(", "), maskPosition: pos.join(", ") } as Keyframe);
  }
  return frames;
}

/** The mask's pictures and how they combine: with `full`, a full layer minus every paint layer; else their union. */
export const paintMask = (layers: readonly Layer[], full = true): { image: string; composite: string } => ({
  image: [...(full ? ["linear-gradient(#000, #000)"] : []), ...layers.map((l) => IMAGE[l.kind])].join(", "),
  composite: [...(full ? ["subtract"] : []), ...layers.map(() => "add")].join(", "),
});

let veil: HTMLElement | null = null;

/** Puts the paint's mask on an element. */
function masked(el: HTMLElement, layers: readonly Layer[], full: boolean): void {
  const m = paintMask(layers, full);
  el.style.setProperty("mask-image", m.image);
  el.style.setProperty("mask-composite", m.composite);
}

/** A copy of the page in the old look, taken before the look changes (captureVeil), waiting for its wave. */
export interface Captured { veil: HTMLElement; w: number; h: number; release(after: number): void; stop(): void; seal(): void }

/**
 * Takes the old look now: the veil goes up over the page (still whole: it looks exactly like the page) with a live
 * copy of it. Taken before a theme setter changes anything on the page (march/ui calls the restyle transition's
 * prepare first), so even the controls that show the choice are in their old state on the copy. Changes of the page
 * are not copied until the wave runs (`release`): they belong to the new look. Null when the page's styles are not
 * ready yet (the wave then takes its copy when it runs). A copy nobody runs is taken down after a few seconds.
 */
export function captureVeil(doc: Document): Captured | null {
  const root = doc.documentElement, body = doc.body;
  const win = globalThis as unknown as Window;
  if (!body || typeof win.getComputedStyle !== "function" || !(globalThis as { CSS?: { supports?: (p: string, v: string) => boolean } }).CSS?.supports?.("mask-composite", "subtract")) return null;
  const sheets = typeof body.attachShadow === "function" ? shadowSheetsNow(doc) : [];
  if (!sheets) return null;
  veil?.remove();
  const w = win.innerWidth || root.clientWidth, h = win.innerHeight || root.clientHeight;
  // the old look: every custom property of the root as it is now, its colour scheme and background
  const cs = win.getComputedStyle(root);
  const v = doc.createElement("div");
  // the veil wears the root's attributes as they are now (the old look) and holds the copy in its own shadow tree,
  // under the page's styles with every rule about the root moved to it: a rule like ":root[data-theme=dark] .card"
  // dresses the copy by the old look, not by the new one on the real root
  for (const a of root.attributes) if (a.name !== "style" && a.name !== "id") v.setAttribute(a.name, a.value);
  v.classList.add("m-wave-veil");
  v.setAttribute("aria-hidden", "true");
  v.inert = true;
  const had = new Set<string>();
  for (let i = 0; i < cs.length; i++) { const n = cs[i]!; if (n.startsWith("--")) { had.add(n); v.style.setProperty(n, cs.getPropertyValue(n)); } }
  v.style.setProperty("color-scheme", cs.colorScheme);
  v.style.setProperty("background-color", cs.backgroundColor);
  // (without shadow trees the copy sits in the veil itself, dressed by the new look's root rules)
  let shadow: ShadowRoot | HTMLElement = v;
  if (typeof v.attachShadow === "function" && sheets.length) { shadow = v.attachShadow({ mode: "open" }); shadow.adoptedStyleSheets = [...sheets, still()]; }
  const later: (() => void)[] = [], twins: Twins = new WeakMap();
  const page = copyPage(body, w, h, twins, later);
  // the page's own box (the viewport less its scrollbar) where it is scrolled to, so every line breaks where it does
  const box = body.getBoundingClientRect();
  for (const [k, val] of [["position", "absolute"], ["margin", "0"], ["overflow", "hidden"], ["top", px(-win.scrollY)], ["left", px(-win.scrollX)], ["width", px(box.width)], ["height", px(box.height)]] as const) page.style.setProperty(k, val);
  shadow.append(page);
  root.append(v);
  veil = v;
  for (const f of later) f();
  syncAnimations(doc, twins);
  const live = mirror(body, page, twins);
  // nobody ran it (the look did not change after all): taken down
  const idle = setTimeout(() => cap.stop(), 4000);
  const cap: Captured = {
    veil: v, w, h,
    release: (after) => { clearTimeout(idle); live.release(after); },
    // a property the new look defines and the old one did not would reach the copy from the real root: unset here
    seal: () => { const now = win.getComputedStyle(root); for (let i = 0; i < now.length; i++) { const n = now[i]!; if (n.startsWith("--") && !had.has(n)) v.style.setProperty(n, "initial"); } },
    stop: () => { clearTimeout(idle); live.stop(); if (veil === v) veil = null; v.remove(); },
  };
  return cap;
}

/** Runs a painted wave: the veil goes up (or was taken already), the page takes the new look under it, the paint
 *  eats the veil away. */
export async function paintWave(doc: Document, change: () => void, o: PaintOptions, taken?: Captured | null): Promise<void> {
  let cap = taken && taken.veil.isConnected ? taken : null;
  if (!cap) {
    // the page's styles for the copy (made once per sheet; installThemeWave makes them ahead)
    if (typeof doc.body?.attachShadow === "function") await shadowSheets(doc);
    cap = captureVeil(doc);
  }
  if (!cap) { change(); return; }
  const { veil: v, w, h } = cap;
  const runs: [Element, Keyframe[]][] = [];
  let shade: HTMLElement | null = null;
  if (o.shape === "drip") {
    // the paint as one outline: the veil keeps everything but the paint (no line drawn along its edge)
    const st = dripState(w, h);
    runs.push([v, liquidFrames(st, false)]);
    // a wide, soft shadow under the paint's edge, cast on the old look (as if the new one were draped over it):
    // the paint's shape a little lower, blurred, shown only outside the paint
    shade = doc.createElement("div");
    shade.className = "m-wave-shade";
    const blur = doc.createElement("div"), shape = doc.createElement("div");
    blur.className = "m-wave-shade-blur"; shape.className = "m-wave-shade-shape";
    blur.append(shape); shade.append(blur);
    runs.push([shade, liquidFrames(st, false)], [shape, liquidFrames(st, true, 0, 18)]);
  } else if (o.shape === "spray" && sprayOn) {
    // the worklet sprays from a random place in the middle of the screen: a dense core, a mist of specks thinning out,
    // splats, drips (spray-worklet.js); only its progress is animated
    for (const [k, val] of [["mask-image", "paint(m-spray)"], ["mask-size", "100% 100%"], ["--m-spray-x", px(w * (0.3 + 0.4 * Math.random()))],
      ["--m-spray-y", px(h * (0.3 + 0.35 * Math.random()))], ["--m-spray-seed", String(Math.floor(Math.random() * 1e6))]] as const) v.style.setProperty(k, val);
    runs.push([v, [{ "--m-spray-t": "0" } as Keyframe, { "--m-spray-t": "1" } as Keyframe]]);
  } else {
    const layers = paintLayers(o.shape, w, h, o.origin);
    masked(v, layers, true);
    runs.push([v, paintFrames(layers)]);
  }
  if (shade) doc.documentElement.append(shade);
  // the page takes the new look under the veil at once; what the change itself does to the page in its first moments
  // stays off the copy, which follows the page from then on
  change();
  cap.seal();
  cap.release(120);
  // the pour takes its time (thick paint); the sprays are quicker
  const timing = { duration: o.duration ?? (o.shape === "drip" ? 2200 : o.shape === "spray" && sprayOn ? 2000 : 1600), easing: "linear", fill: "forwards" as const };
  const anims = runs.map(([el, frames]) => animateEl(el, frames, timing));
  const done = cap;
  return new Promise<void>((resolve) => {
    const end = (): void => { done.stop(); shade?.remove(); resolve(); };
    const lead = anims[0];
    if (lead) { lead.addEventListener("finish", end); lead.addEventListener("cancel", end); } else end();
  });
}

/**
 * The page's style sheets for the veil's shadow tree, each made once: the sheet's own text (a <style>'s text, a
 * linked sheet's file, from the cache) with every rule about the root (":root…", "html…") made about the veil
 * (":host(…)", which wears the old look's root attributes) and its relative urls made absolute. A sheet whose text is
 * not at hand, or no longer matches its rules (rules added by script), is written from its rules instead.
 */
const shadowCopies = new WeakMap<CSSStyleSheet, Promise<CSSStyleSheet | null>>();
const readyCopies = new WeakMap<CSSStyleSheet, CSSStyleSheet | null>();
function shadowCopy(sheet: CSSStyleSheet): Promise<CSSStyleSheet | null> {
  let made = shadowCopies.get(sheet);
  if (made) return made;
  const node = sheet.ownerNode as Element | null;
  const text: Promise<string | null> = node?.tagName === "STYLE" ? Promise.resolve(node.textContent)
    : sheet.href ? fetch(sheet.href).then((r) => (r.ok ? r.text() : null), () => null) : Promise.resolve(null);
  made = text.then((t) => {
    const media = sheet.media?.mediaText;
    const copy = new CSSStyleSheet(media ? { media } : {});
    let rules = 0;
    try { rules = sheet.cssRules.length; } catch { /* another origin */ }
    if (t != null) { copy.replaceSync(absoluteUrls(hostCss(t), sheet.href ?? globalThis.location?.href ?? "")); if (copy.cssRules.length === rules) return copy; }
    copy.replaceSync(ruleText(sheet.cssRules));
    return copy;
  }).catch(() => null).then((c) => { readyCopies.set(sheet, c); return c; });
  shadowCopies.set(sheet, made);
  return made;
}

/** The copies of all of the page's sheets, in order (and its adopted sheets as they are). */
async function shadowSheets(doc: Document): Promise<CSSStyleSheet[]> {
  const list = [...(doc.styleSheets ?? [])].filter((x) => !x.disabled);
  const copies = await Promise.all(list.map(shadowCopy));
  return [...copies.filter((x): x is CSSStyleSheet => !!x), ...(doc.adoptedStyleSheets ?? [])];
}

/** The copy shows each value at once: a CSS transition would slide it in from another (the page's running ones are
 *  copied as animations on their own clock, syncAnimations). */
let stillSheet: CSSStyleSheet | null = null;
const still = (): CSSStyleSheet => { if (!stillSheet) { stillSheet = new CSSStyleSheet(); stillSheet.replaceSync("*, *::before, *::after { transition: none !important; }"); } return stillSheet; };

/** The copies, now (a sheet not made yet is written from its rules meanwhile). */
function shadowSheetsNow(doc: Document): CSSStyleSheet[] | null {
  const out: CSSStyleSheet[] = [];
  for (const sheet of doc.styleSheets ?? []) {
    if (sheet.disabled) continue;
    if (!readyCopies.has(sheet)) {
      // not made yet (a sheet that came late): written from its rules for now, made properly for the next time
      void shadowCopy(sheet);
      try { const quick = new CSSStyleSheet(sheet.media?.mediaText ? { media: sheet.media.mediaText } : {}); quick.replaceSync(ruleText(sheet.cssRules)); out.push(quick); } catch { /* another origin */ }
      continue;
    }
    const c = readyCopies.get(sheet);
    if (c) out.push(c);
  }
  return [...out, ...(doc.adoptedStyleSheets ?? [])];
}

/** Makes the veil's style sheets ahead, so no wave waits for them, also for the sheets that come later (a colour
 *  theme's stylesheet, a page's lazy styles). */
let watching = false;
export function prepareVeil(doc: Document): void {
  if (typeof doc.body?.attachShadow !== "function") return;
  void shadowSheets(doc);
  const MO = (globalThis as { MutationObserver?: typeof MutationObserver }).MutationObserver;
  if (watching || !MO) return;
  watching = true;
  new MO((list) => {
    for (const m of list) for (const n of m.addedNodes) {
      const el = n as HTMLLinkElement | HTMLStyleElement;
      if (el.tagName === "STYLE" && el.sheet) void shadowCopy(el.sheet);
      else if (el.tagName === "LINK") { const go = (): void => { if (el.sheet) void shadowCopy(el.sheet); }; if (el.sheet) go(); else el.addEventListener("load", go, { once: true }); }
    }
  }).observe(doc.documentElement, { childList: true, subtree: true });
}

/** Rules about the root made about the veil, in a sheet's text. */
const hostCss = (css: string): string => css.replace(/(^|[\s,>+~(}{;/])(?::root|html)((?:\[[^\]]*\]|\.[-\w]+|:(?:not|is|where)\((?:[^()]|\([^()]*\))*\))*)(?![-\w])/g,
  (_m, before: string, rest: string) => `${before}${rest ? `:host(${rest})` : ":host"}`);
/** A sheet's relative urls made absolute (a constructed sheet resolves them against the page, not the file). */
const absoluteUrls = (css: string, base: string): string => css.replace(/url\(\s*(['"]?)(?![a-z][-a-z0-9+.]*:|\/|#)([^'")]+)\1\s*\)/gi,
  (m, q: string, u: string) => { try { return `url(${q}${new URL(u, base).href}${q})`; } catch { return m; } });

function ruleText(list: CSSRuleList): string {
  let text = "";
  for (const r of list) {
    if (r instanceof CSSStyleRule) text += `${hostSelector(r.selectorText)}{${declText(r.style)}${r.cssRules?.length ? ruleText(r.cssRules) : ""}}`;
    else if (r instanceof CSSImportRule) { if (r.styleSheet) { try { text += ruleText(r.styleSheet.cssRules); } catch { /* another origin */ } } }
    else if ("cssRules" in r) { const head = r.cssText.slice(0, r.cssText.indexOf("{")); text += `${head}{${ruleText((r as CSSGroupingRule).cssRules)}}`; }
    else text += r.cssText;
  }
  return text;
}

/**
 * A rule's declarations as text. Not `style.cssText`: a shorthand written with var() ("font: 400 var(--size) …")
 * comes out of it as empty longhands; here such a longhand is written as its shorthand, with the shorthand's text.
 */
function declText(st: CSSStyleDeclaration): string {
  let out = "";
  const done = new Set<string>();
  for (let i = 0; i < st.length; i++) {
    const n = st[i]!;
    let name = n, v = st.getPropertyValue(n);
    if (!v) {
      const parts = n.split("-");
      for (let k = parts.length - 1; k > 0 && !v; k--) { const sh = parts.slice(0, k).join("-"); const sv = sh ? st.getPropertyValue(sh) : ""; if (sv) { name = sh; v = sv; } }
    }
    if (!v || done.has(name)) continue;
    done.add(name);
    out += `${name}:${v}${st.getPropertyPriority(n) ? " !important" : ""};`;
  }
  return out;
}

/** ":root[data-theme=dark] .card" → ":host([data-theme=dark]) .card"; "html.x body" → ":host(.x) body". */
export function hostSelector(sel: string): string {
  return sel.replace(/(^|[\s,>+~(])(?::root|html)((?:\[[^\]]*\]|\.[-\w]+|:(?:not|is|where)\((?:[^()]|\([^()]*\))*\))*)(?![-\w])/g,
    (_m, before: string, rest: string) => `${before}${rest ? `:host(${rest})` : ":host"}`);
}

const MEDIA = new Set(["IFRAME", "VIDEO", "AUDIO", "OBJECT", "EMBED", "SCRIPT"]);
/** Each node of the page and its node in the veil's copy. */
type Twins = WeakMap<Node, Node>;

/**
 * A copy of the page for the veil, cut to what is near the screen: an element more than a screen away keeps its box
 * (an empty element of the same size) but not its content, so the copy lays out in a few milliseconds even on a long
 * page. No ids (no duplicates), no frames or media that would load again; field values, canvas pictures and scroll
 * places are copied (scroll places once the copy is in the page: `later`).
 */
function copyPage(body: HTMLElement, w: number, h: number, twins: Twins, later: (() => void)[]): HTMLElement {
  const page = body.cloneNode(true) as HTMLElement;
  walk(body, page, w, h, twins, later);
  return page;
}

function walk(s: Node, d: Node, w: number, h: number, twins: Twins, later: (() => void)[]): void {
  twins.set(s, d);
  if (!(s instanceof Element) || !(d instanceof Element)) return;
  d.removeAttribute("id");
  if (MEDIA.has(s.tagName)) {
    const r = s.getBoundingClientRect(), stand = d.ownerDocument.createElement("div");
    stand.className = (s as HTMLElement).className;
    stand.style.setProperty("width", px(r.width)); stand.style.setProperty("height", px(r.height));
    d.replaceWith(stand);
    twins.set(s, stand);
    return;
  }
  if (s !== s.ownerDocument.body) {
    const r = s.getBoundingClientRect();
    if (w && h && r.width && r.height && (r.bottom < -h || r.top > 2 * h || r.right < -w || r.left > 2 * w)) {
      // far off screen: the box stays, its content does not
      const box = (d as HTMLElement).style;
      d.replaceChildren();
      box.setProperty("box-sizing", "border-box"); box.setProperty("width", px(r.width)); box.setProperty("height", px(r.height));
      return;
    }
  }
  if (s.scrollTop || s.scrollLeft) { const t = s.scrollTop, l = s.scrollLeft; later.push(() => { d.scrollTop = t; d.scrollLeft = l; }); }
  copyValue(s, d);
  const a = s.childNodes, b = [...d.childNodes];
  for (let i = 0; i < a.length && i < b.length; i++) walk(a[i]!, b[i]!, w, h, twins, later);
}

function copyValue(s: Element, d: Element): void {
  const tag = s.tagName;
  if (tag === "INPUT") { (d as HTMLInputElement).value = (s as HTMLInputElement).value; (d as HTMLInputElement).checked = (s as HTMLInputElement).checked; }
  else if (tag === "TEXTAREA" || tag === "SELECT") (d as HTMLTextAreaElement).value = (s as HTMLTextAreaElement).value;
  else if (tag === "CANVAS") { const c = s as HTMLCanvasElement; if (c.width && c.height) { try { (d as HTMLCanvasElement).getContext("2d")?.drawImage(c, 0, 0); } catch { /* tainted or lost */ } } }
}

/**
 * The copy shows the page as it is this moment, not as it was when it opened: its CSS animations (which start over in
 * a fresh copy) are put at the time of the page's own, and the page's script animations (the motion engine: entries,
 * drags, springs, text effects) and running CSS transitions (which a fresh copy would show at their end) are run on
 * the copy from the same time, so nothing jumps to its start or to its end.
 */
function syncAnimations(doc: Document, twins: Twins): void {
  for (const a of doc.getAnimations?.() ?? []) {
    const eff = a.effect as KeyframeEffect | null, t = eff?.target;
    // the page's own animations only (the copy's live in the veil's shadow tree)
    if (!eff || !t || t.getRootNode() !== doc) continue;
    const d = twins.get(t);
    if (!(d instanceof Element)) continue;
    const name = (a as Animation & { animationName?: string }).animationName;
    try {
      if (name !== undefined) {
        const twin = d.getAnimations?.().find((x) => (x as Animation & { animationName?: string }).animationName === name && (x.effect as KeyframeEffect | null)?.pseudoElement === eff.pseudoElement);
        if (twin) align(twin, a);
        continue;
      }
      const c = d.animate(eff.getKeyframes(), { ...eff.getTiming(), ...(eff.pseudoElement ? { pseudoElement: eff.pseudoElement } : {}) } as KeyframeAnimationOptions);
      c.playbackRate = a.playbackRate;
      align(c, a);
    } catch { /* an animation the copy cannot take */ }
  }
}

/**
 * Puts a copy's animation on the page animation's clock: a running one gets the same start time on the same timeline
 * (not just the same current time, which a pending start would put a frame behind), a paused or finished one the same
 * moment.
 */
function align(copy: Animation, page: Animation): void {
  if (page.playState === "running" && page.startTime !== null) copy.startTime = page.startTime;
  else { copy.currentTime = page.currentTime; copy.pause(); }
}

/** Twins for a node added to the page while the veil is up (its copy gets no ids). */
function pair(s: Node, d: Node, twins: Twins): void {
  twins.set(s, d);
  if (d instanceof Element) d.removeAttribute("id");
  const a = s.childNodes, b = d.childNodes;
  for (let i = 0; i < a.length && i < b.length; i++) pair(a[i]!, b[i]!, twins);
}

/**
 * Keeps the copy live while the veil is up: every change of the page (text, attributes and inline styles, so the
 * motion engine's animations too, nodes coming and going, field values, scroll places) is made on its twin, and the
 * pictures of canvases are copied every frame (the central clock). Returns the function that stops it.
 */
function mirror(body: HTMLElement, page: HTMLElement, twins: Twins): { release(after: number): void; stop(): void } {
  const win = globalThis as unknown as Window;
  const MO = (globalThis as { MutationObserver?: typeof MutationObserver }).MutationObserver;
  if (!MO) return { release: () => undefined, stop: () => undefined };
  const mo = new MO((list) => {
    if (settling) return;
    for (const m of list) {
      const t = twins.get(m.target);
      if (!t) continue;
      if (m.type === "characterData") (t as CharacterData).data = (m.target as CharacterData).data;
      else if (m.type === "attributes" && m.attributeName && m.attributeName !== "id" && t instanceof Element) {
        const v = (m.target as Element).getAttribute(m.attributeName);
        if (v == null) t.removeAttribute(m.attributeName); else t.setAttribute(m.attributeName, v);
      } else if (m.type === "childList") {
        for (const n of m.removedNodes) { const c = twins.get(n); if (c && c.parentNode === t) t.removeChild(c); }
        for (const n of m.addedNodes) {
          if (n.parentNode !== m.target || twins.has(n) || (n instanceof Element && MEDIA.has(n.tagName))) continue;
          const c = n.cloneNode(true);
          pair(n, c, twins);
          const next = n.nextSibling && twins.get(n.nextSibling);
          if (next && next.parentNode === t) t.insertBefore(c, next); else t.appendChild(c);
        }
      }
    }
  });
  mo.observe(body, { subtree: true, childList: true, attributes: true, characterData: true });
  // nothing is copied until the wave runs and its change has settled (those updates belong to the new look)
  let settling = true, settled: ReturnType<typeof setTimeout> | undefined;
  const release = (after: number): void => { mo.takeRecords(); settled = setTimeout(() => { mo.takeRecords(); settling = false; }, after); };
  const onValue = (e: Event): void => { const s = e.target as Element, d = twins.get(s); if (d instanceof Element) copyValue(s, d); };
  const onScroll = (e: Event): void => {
    const s = e.target;
    if (s === win.document) { page.style.setProperty("top", px(-win.scrollY)); page.style.setProperty("left", px(-win.scrollX)); return; }
    const d = twins.get(s as Node);
    if (d instanceof Element && s instanceof Element) { d.scrollTop = s.scrollTop; d.scrollLeft = s.scrollLeft; }
  };
  win.addEventListener("input", onValue, true);
  win.addEventListener("change", onValue, true);
  win.addEventListener("scroll", onScroll, { capture: true, passive: true });
  // a canvas whose drawer takes its copy (it hears "m-wave-twin": march/ui Overlay does) is drawn twice by it, in
  // the colours of each look; any other has its picture copied every frame
  const stops: (() => void)[] = [];
  const canvases = [...body.querySelectorAll("canvas")].map((c) => [c, twins.get(c)] as const).filter((x): x is readonly [HTMLCanvasElement, HTMLCanvasElement] => {
    if (!(x[1] instanceof HTMLCanvasElement)) return false;
    const detail: { copy: HTMLCanvasElement; claimed: boolean; stop?: () => void } = { copy: x[1], claimed: false };
    x[0].dispatchEvent(new CustomEvent("m-wave-twin", { detail }));
    if (detail.stop) stops.push(detail.stop);
    return !detail.claimed;
  });
  const offFrame = canvases.length ? onFrame(() => {
    for (const [c, d] of canvases) {
      if (!c.width || !c.height) continue;
      if (d.width !== c.width || d.height !== c.height) { d.width = c.width; d.height = c.height; }
      const g = d.getContext("2d");
      if (!g) continue;
      g.clearRect(0, 0, d.width, d.height);
      try { g.drawImage(c, 0, 0); } catch { /* tainted or lost */ }
    }
  }, { phase: "render" as never }) : () => undefined;
  return { release, stop: () => { clearTimeout(settled); offFrame(); for (const f of stops) f(); mo.disconnect(); win.removeEventListener("input", onValue, true); win.removeEventListener("change", onValue, true); win.removeEventListener("scroll", onScroll, true); } };
}
