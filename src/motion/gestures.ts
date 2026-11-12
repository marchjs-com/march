// Gestures and micro-interactions as `use:` actions (transform only, pointer events, CSP safe):
//   use:drag={{ axis: "x", bounds: { left: -100, right: 100 }, onEnd }}   use:swipe={{ onSwipe: (dir) => … }}
//   use:press   use:magnet={{ strength: 0.3 }}   use:tilt={{ max: 8 }}
import { animate, type Controls, type AnimateOptions } from "./animate.ts";
import { setStyle, reducedMotion, frame } from "./env.ts";
import { clamp, listen } from "../core/util.ts";

type Opts<T> = T | undefined;
const obj = <T extends object>(raw: unknown): Partial<T> => (raw && typeof raw === "object" ? (raw as Partial<T>) : {});

/**
 * Gestures write the live transform inline and play their release animations WITHOUT fill: a filled animation keeps
 * overriding the inline transform after it ends, so the gesture would work only once. `settle` cancels the previous
 * release animation of the same gesture, sets the final transform inline, then animates from the current one.
 */
interface Slot { a: Controls | null }
function settle(el: Element, slot: Slot, from: string, to: string | null, opts: AnimateOptions): void {
  slot.a?.cancel();
  setStyle(el, { transform: to });
  slot.a = animate(el, [{ transform: from }, { transform: to ?? "none" }], { ...opts, fill: "none" });
}
const stop = (slot: Slot): void => { slot.a?.cancel(); slot.a = null; };

export interface DragOptions {
  axis: "x" | "y" | "both";
  bounds: { left?: number; right?: number; top?: number; bottom?: number };
  onStart: (p: { x: number; y: number }) => void;
  onMove: (p: { x: number; y: number; dx: number; dy: number }) => void;
  onEnd: (p: { x: number; y: number; vx: number; vy: number }) => void;
  /** Spring back to the origin on release. */
  snapBack: boolean;
}

/**
 * While dragging (and until the release animation ends) the element is lifted above everything: it gets `hm-dragging`
 * (+ `hm-dragging-rel` when it is statically positioned), and ancestors that create a stacking context get `hm-drag-lift`,
 * so z-index `--hm-z-drag` wins over sibling cards, sticky bars and dialogs (motion.css). Overflow clipping by an
 * ancestor is not undone: give drag areas room (no overflow: hidden on the way up).
 */
function lift(el: Element): () => void {
  const css = (e: Element): CSSStyleDeclaration | null => globalThis.getComputedStyle?.(e) ?? null;
  // z-index only competes inside the nearest stacking context, so lift the ancestors that create one
  const isContext = (c: CSSStyleDeclaration): boolean => c.zIndex !== "auto" && c.zIndex !== "" || (c.transform && c.transform !== "none") || c.isolation === "isolate"
    || Number(c.opacity) < 1 || (c.filter && c.filter !== "none") || /transform|opacity|filter/.test(c.willChange ?? "") || /paint|layout|strict|content/.test(c.contain ?? "")
    || c.position === "fixed" || c.position === "sticky" || !!(c.backdropFilter && c.backdropFilter !== "none");
  const done: [Element, string[]][] = [];
  const add = (e: Element, cls: string[]): void => { e.classList.add(...cls); done.push([e, cls]); };
  const own = css(el);
  add(el, own?.position === "static" ? ["hm-dragging", "hm-dragging-rel"] : ["hm-dragging"]);
  for (let p = el.parentElement; p && p !== el.ownerDocument?.body && p !== el.ownerDocument?.documentElement; p = p.parentElement) {
    const c = css(p);
    if (c && isContext(c)) add(p, c.position === "static" ? ["hm-drag-lift", "hm-dragging-rel"] : ["hm-drag-lift"]);
  }
  return () => { for (const [e, cls] of done) e.classList.remove(...cls); };
}

/** Action: drag the element with the pointer (keyboard: arrow keys move by 10px when focused). */
export function drag(el: Element, raw?: unknown): () => void {
  const o = obj<DragOptions>(raw);
  const h = el as HTMLElement;
  let x = 0, y = 0, sx = 0, sy = 0, px = 0, py = 0, vx = 0, vy = 0, t = 0, active = false;
  const release: Slot = { a: null };
  let drop: (() => void) | null = null;
  const unlift = (): void => { drop?.(); drop = null; };
  const bound = (v: number, lo?: number, hi?: number): number => clamp(v, lo ?? -Infinity, hi ?? Infinity);
  const apply = (): void => setStyle(el, { transform: `translate3d(${x}px, ${y}px, 0)` });
  const down = (e: PointerEvent): void => {
    stop(release);
    if (!drop) drop = lift(el);
    active = true; sx = e.clientX - x; sy = e.clientY - y; px = e.clientX; py = e.clientY; t = e.timeStamp;
    h.setPointerCapture?.(e.pointerId);
    el.classList.add("is-dragging");
    o.onStart?.({ x, y });
  };
  const move = (e: PointerEvent): void => {
    if (!active) return;
    const nx = o.axis === "y" ? x : bound(e.clientX - sx, o.bounds?.left, o.bounds?.right);
    const ny = o.axis === "x" ? y : bound(e.clientY - sy, o.bounds?.top, o.bounds?.bottom);
    const dt = Math.max(1, e.timeStamp - t);
    vx = (e.clientX - px) / dt; vy = (e.clientY - py) / dt; px = e.clientX; py = e.clientY; t = e.timeStamp;
    o.onMove?.({ x: nx, y: ny, dx: nx - x, dy: ny - y });
    x = nx; y = ny;
    apply();
  };
  const up = (): void => {
    if (!active) return;
    active = false;
    el.classList.remove("is-dragging");
    o.onEnd?.({ x, y, vx, vy });
    if (o.snapBack) {
      const from = `translate3d(${x}px, ${y}px, 0)`; x = 0; y = 0;
      settle(el, release, from, null, { duration: 300, easing: "easeOutBack" });
      const mine = release.a;
      // stay on top until the spring-back ends (a new drag cancels it and keeps the lift)
      void mine?.finished.then(() => { if (release.a === mine && !active) unlift(); });
    } else unlift();
  };
  const key = (e: KeyboardEvent): void => {
    const step = e.shiftKey ? 50 : 10;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    stop(release);
    if (o.axis !== "y") x = bound(x + m[0], o.bounds?.left, o.bounds?.right);
    if (o.axis !== "x") y = bound(y + m[1], o.bounds?.top, o.bounds?.bottom);
    apply();
    o.onMove?.({ x, y, dx: m[0], dy: m[1] });
  };
  const off = listen(h, { pointerdown: down, pointermove: move, pointerup: up, pointercancel: up, keydown: key });
  setStyle(el, { touchAction: o.axis === "x" ? "pan-y" : o.axis === "y" ? "pan-x" : "none" });
  return () => { stop(release); unlift(); off(); };
}

/** Action: detect a swipe (left/right/up/down) with distance and velocity thresholds. */
export function swipe(el: Element, raw?: unknown): () => void {
  const o = obj<{ onSwipe: (dir: "left" | "right" | "up" | "down") => void; threshold: number }>(raw);
  const h = el as HTMLElement;
  let sx = 0, sy = 0, st = 0;
  const down = (e: PointerEvent): void => { sx = e.clientX; sy = e.clientY; st = e.timeStamp; };
  const up = (e: PointerEvent): void => {
    const dx = e.clientX - sx, dy = e.clientY - sy, dt = Math.max(1, e.timeStamp - st);
    const min = o.threshold ?? 40;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < min && Math.hypot(dx, dy) / dt < 0.5) return;
    o.onSwipe?.(Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up");
  };
  return listen(h, { pointerdown: down, pointerup: up });
}

/** Action: subtle press-down scale. */
export function press(el: Element, raw?: Opts<number>): () => void {
  const scale = typeof raw === "number" ? raw : 0.97;
  const h = el as HTMLElement;
  // the pressed scale is a filled animation held only while pressed; release plays unfilled, so nothing outlives the press
  const held: Slot = { a: null }, release: Slot = { a: null };
  let pressed = false;
  const down = (): void => {
    if (reducedMotion()) return;
    stop(release); stop(held); pressed = true;
    held.a = animate(el, [{ transform: "none" }, { transform: `scale(${scale})` }], { duration: 90, fill: "forwards" });
  };
  const up = (): void => {
    if (!pressed) return;
    pressed = false; stop(held);
    release.a = animate(el, [{ transform: `scale(${scale})` }, { transform: "none" }], { duration: 160, easing: "easeOutBack", fill: "none" });
  };
  const off = listen(h, { pointerdown: down, pointerup: up, pointerleave: up, pointercancel: up });
  return () => { stop(held); stop(release); off(); };
}

/** Action: the element is pulled toward the pointer while hovered. */
export function magnet(el: Element, raw?: unknown): () => void {
  const o = obj<{ strength: number }>(raw);
  const k = o.strength ?? 0.25;
  const h = el as HTMLElement;
  let pending = false, inside = false, mx = 0, my = 0;
  const release: Slot = { a: null };
  const update = (): void => { pending = false; if (inside) setStyle(el, { transform: `translate3d(${mx}px, ${my}px, 0)` }); };
  const move = (e: PointerEvent): void => {
    if (reducedMotion()) return;
    if (!inside) { inside = true; stop(release); }
    const r = el.getBoundingClientRect();
    mx = (e.clientX - (r.left + r.width / 2)) * k;
    my = (e.clientY - (r.top + r.height / 2)) * k;
    if (!pending) { pending = true; frame(update); }
  };
  const leave = (): void => {
    if (!inside) return;
    inside = false;
    const from = `translate3d(${mx}px, ${my}px, 0)`; mx = 0; my = 0;
    settle(el, release, from, null, { duration: 400, easing: "easeOutElastic" });
  };
  const off = listen(h, { pointermove: move, pointerleave: leave });
  return () => { stop(release); off(); };
}

/** Action: 3D tilt toward the pointer (max degrees), with an optional glare via --hm-tilt-x/--hm-tilt-y custom properties. */
export function tilt(el: Element, raw?: unknown): () => void {
  const o = obj<{ max: number; perspective: number }>(raw);
  const max = o.max ?? 8, persp = o.perspective ?? 800;
  const h = el as HTMLElement;
  const release: Slot = { a: null };
  let inside = false;
  const move = (e: PointerEvent): void => {
    if (reducedMotion()) return;
    if (!inside) { inside = true; stop(release); }
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / (r.width || 1) - 0.5, py = (e.clientY - r.top) / (r.height || 1) - 0.5;
    setStyle(el, { transform: `perspective(${persp}px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`, "--hm-tilt-x": `${((px + 0.5) * 100).toFixed(1)}%`, "--hm-tilt-y": `${((py + 0.5) * 100).toFixed(1)}%` });
  };
  const leave = (): void => {
    if (!inside) return;
    inside = false;
    settle(el, release, getComputedTransform(el), null, { duration: 300 });
  };
  const off = listen(h, { pointermove: move, pointerleave: leave });
  return () => { stop(release); off(); };
}
function getComputedTransform(el: Element): string {
  return (el as HTMLElement).style?.getPropertyValue?.("transform") || "none";
}
