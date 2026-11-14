// The painted theme waves (themeWave shapes "drip", "spray", "sweep", "splat"): a lazy part of the motion package,
// loaded the first time one of them runs (installThemeWave loads it ahead). No snapshots and nothing waits: the page
// takes the new look at once and stays the page (every press and key reaches it, its animations run on); above it a
// passive veil (.m-wave-veil: no pointer, inert, hidden from assistive tech) holds a live copy of the page in the old
// look, kept in step with the page while it is up, and the paint eats soft holes into the veil until none of it is left.
//   drip   paint gathers along the top and runs down in streams (soft-sided bands led by a round drop), some fast, some
//          slow, thickening into each other until the screen is covered
//   spray  one nozzle from a random place, strokes in changing directions, each heading for a bare part
//   sweep  the nozzle sweeps its row from a random place, then the rows above and below in turn
//   splat  patches burst out from the pressed point, specks flying ahead
import { animateEl } from "./env.ts";
import { onFrame } from "./engine/clock.ts";
import { clamp } from "../core/util.ts";

export type PaintShape = "drip" | "spray" | "sweep" | "splat";
export interface PaintOptions { shape: PaintShape; origin?: { x: number; y: number } | null | undefined; duration?: number | undefined }

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
 * One layer of the veil's mask: the picture it draws (`kind`: a soft round spot, a stream's body — a band with soft
 * sides —, or the pool along the top) and where it is, how big, at a moment of the wave (0–1): [x, y, width, height].
 * Only place and size change over the wave, so the browser tweens the layers between keyframes.
 */
export interface Layer { kind: "dot" | "band" | "pool"; box(t: number): readonly [number, number, number, number] }
const IMAGE: Record<Layer["kind"], string> = {
  // the soft spot: its edge fades
  dot: "radial-gradient(closest-side, #000 38%, rgba(0,0,0,.7) 58%, rgba(0,0,0,.28) 78%, transparent)",
  // a stream's body: solid in the middle, its sides fade
  band: "linear-gradient(90deg, transparent, #000 28%, #000 72%, transparent)",
  // the pool along the top: solid, its lower edge fades
  pool: "linear-gradient(180deg, #000 55%, transparent)",
};

/** A spot as a layer: it grows from its centre once its time comes. */
export const spotLayer = (s: Spot): Layer => ({ kind: "dot", box: (t) => {
  const p = clamp((t - s.at) / s.grow, 0, 1), r = s.r * (1 - (1 - p) ** 3);
  return [s.x - r, s.y - r, 2 * r, 2 * r];
} });

/**
 * Paint running down from many points along the top, like a real pour: the paint first gathers along the top edge,
 * then runs down in streams, each with its own speed (the fastest reach the bottom in half the time of the slowest),
 * starting thin and slow, flowing faster, thickening as more paint comes (thickest near the top), each led by a round
 * drop; neighbouring streams thicken into each other, so when the slowest is down nothing is bare.
 */
export function dripLayers(w: number, h: number, rnd: Rnd = Math.random): Layer[] {
  const n = Math.max(6, Math.round(w / Math.max(48, Math.min(w, h) / 9))), gap = w / n;
  const layers: Layer[] = [];
  // the pool: gathers in the first moments, then stays
  layers.push({ kind: "pool", box: (t) => [0, 0, w, h * 0.14 * clamp(t / 0.18, 0, 1) ** 0.7] });
  for (let i = 0; i <= n; i++) {
    const x = (i + (rnd() - 0.5) * 0.5) * gap;
    const start = 0.03 + 0.12 * rnd(), end = clamp(start + 0.35 + 0.5 * rnd(), 0, END);
    const life = (t: number): number => clamp((t - start) / (end - start), 0, 1);
    // slow at first, then flowing; its length reaches past the bottom
    const length = (t: number): number => (h + gap) * life(t) ** 1.35;
    // thin at first, thickening until it meets its neighbours
    const width = (t: number): number => gap * (0.4 + 1.35 * life(t) ** 1.4);
    // the body
    layers.push({ kind: "band", box: (t) => { const W = width(t); return [x - W / 2, 0, W, length(t)]; } });
    // the thicker upper part (more paint near the top)
    layers.push({ kind: "band", box: (t) => { const W = width(t) * 1.35; return [x - W / 2, 0, W, length(t) * 0.45]; } });
    // the drop that leads it
    layers.push({ kind: "dot", box: (t) => { const W = width(t) * 1.25, H = W * 1.1, L = length(t); return L > 0 ? [x - W / 2, L - H * 0.55, W, H] : [x, 0, 0, 0]; } });
  }
  return layers;
}

/** The layers of a shape. */
export function paintLayers(shape: PaintShape, w: number, h: number, origin?: { x: number; y: number } | null, rnd: Rnd = Math.random): Layer[] {
  if (shape === "drip") return dripLayers(w, h, rnd);
  const spots = shape === "spray" ? spraySpots(w, h, rnd) : shape === "sweep" ? sweepSpots(w, h, rnd) : splatSpots(w, h, origin?.x ?? w / 2, origin?.y ?? 0, rnd);
  return spots.map(spotLayer);
}

/**
 * The paint as keyframes of the veil's mask: the first layer covers the page and every paint layer is subtracted from
 * it, so the old look gets holes with soft edges. Only the size and place of each layer change (the same layers in
 * every keyframe), so the browser tweens them, and each layer is painted only inside its own box.
 */
export function paintFrames(layers: readonly Layer[]): Keyframe[] {
  const frames: Keyframe[] = [];
  for (let k = 0; k <= STEPS; k++) {
    const t = k / STEPS;
    const size = ["100% 100%"], pos = ["0px 0px"];
    for (const l of layers) { const [x, y, bw, bh] = l.box(t); size.push(`${px(bw)} ${px(bh)}`); pos.push(`${px(x)} ${px(y)}`); }
    frames.push({ offset: t, maskSize: size.join(", "), maskPosition: pos.join(", ") } as Keyframe);
  }
  return frames;
}

/** The mask's pictures and how they combine: a full layer, minus every paint layer. */
export const paintMask = (layers: readonly Layer[]): { image: string; composite: string } => ({
  image: ["linear-gradient(#000, #000)", ...layers.map((l) => IMAGE[l.kind])].join(", "),
  composite: ["subtract", ...layers.map(() => "add")].join(", "),
});

let veil: HTMLElement | null = null;

/** Runs a painted wave: the veil goes up, the page takes the new look under it, the paint eats the veil away. */
export function paintWave(doc: Document, change: () => void, o: PaintOptions): Promise<void> {
  const root = doc.documentElement, body = doc.body;
  const win = globalThis as unknown as Window;
  if (!body || typeof win.getComputedStyle !== "function" || !(globalThis as { CSS?: { supports?: (p: string, v: string) => boolean } }).CSS?.supports?.("mask-composite", "subtract")) { change(); return Promise.resolve(); }
  veil?.remove();
  const w = win.innerWidth || root.clientWidth, h = win.innerHeight || root.clientHeight;
  // the old look: every custom property of the root as it is now, its colour scheme and background
  const cs = win.getComputedStyle(root);
  const v = doc.createElement("div");
  v.className = "m-wave-veil";
  v.setAttribute("aria-hidden", "true");
  v.inert = true;
  for (let i = 0; i < cs.length; i++) { const n = cs[i]!; if (n.startsWith("--")) v.style.setProperty(n, cs.getPropertyValue(n)); }
  v.style.setProperty("color-scheme", cs.colorScheme);
  v.style.setProperty("background-color", cs.backgroundColor);
  const later: (() => void)[] = [], twins: Twins = new WeakMap();
  const page = copyPage(body, w, h, twins, later);
  page.style.setProperty("top", px(-win.scrollY));
  page.style.setProperty("left", px(-win.scrollX));
  // the page's own box (the viewport less its scrollbar), so every line breaks where it does on the page
  const box = body.getBoundingClientRect();
  page.style.setProperty("width", px(box.width));
  page.style.setProperty("height", px(box.height));
  v.append(page);
  const layers = paintLayers(o.shape, w, h, o.origin);
  const mask = paintMask(layers);
  v.style.setProperty("mask-image", mask.image);
  v.style.setProperty("mask-composite", mask.composite);
  root.append(v);
  veil = v;
  for (const f of later) f();
  syncAnimations(doc, twins);
  const stop = mirror(body, page, twins);
  // the page takes the new look under the veil at once
  change();
  const anim = animateEl(v, paintFrames(layers), { duration: o.duration ?? 1600, easing: "linear", fill: "forwards" });
  return new Promise<void>((resolve) => {
    const end = (): void => { stop(); if (veil === v) veil = null; v.remove(); resolve(); };
    if (anim) { anim.addEventListener("finish", end); anim.addEventListener("cancel", end); } else end();
  });
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
    if (!eff || !t || t.closest(".m-wave-veil")) continue;
    const d = twins.get(t);
    if (!(d instanceof Element)) continue;
    const name = (a as Animation & { animationName?: string }).animationName;
    try {
      if (name !== undefined) {
        const twin = d.getAnimations?.().find((x) => (x as Animation & { animationName?: string }).animationName === name && (x.effect as KeyframeEffect | null)?.pseudoElement === eff.pseudoElement);
        if (twin) { twin.currentTime = a.currentTime; if (a.playState === "paused") twin.pause(); }
        continue;
      }
      const c = d.animate(eff.getKeyframes(), { ...eff.getTiming(), ...(eff.pseudoElement ? { pseudoElement: eff.pseudoElement } : {}) } as KeyframeAnimationOptions);
      c.currentTime = a.currentTime;
      c.playbackRate = a.playbackRate;
      if (a.playState === "paused" || a.playState === "finished") c.pause();
    } catch { /* an animation the copy cannot take */ }
  }
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
function mirror(body: HTMLElement, page: HTMLElement, twins: Twins): () => void {
  const win = globalThis as unknown as Window;
  const MO = (globalThis as { MutationObserver?: typeof MutationObserver }).MutationObserver;
  if (!MO) return () => undefined;
  const mo = new MO((list) => {
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
  const canvases = [...body.querySelectorAll("canvas")].map((c) => [c, twins.get(c)] as const).filter((x): x is readonly [HTMLCanvasElement, HTMLCanvasElement] => x[1] instanceof HTMLCanvasElement);
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
  return () => { offFrame(); mo.disconnect(); win.removeEventListener("input", onValue, true); win.removeEventListener("change", onValue, true); win.removeEventListener("scroll", onScroll, true); };
}
