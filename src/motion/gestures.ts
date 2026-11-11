// Gestures and micro-interactions as `use:` actions (transform only, pointer events, CSP safe):
//   use:drag={{ axis: "x", bounds: { left: -100, right: 100 }, onEnd }}   use:swipe={{ onSwipe: (dir) => … }}
//   use:press   use:magnet={{ strength: 0.3 }}   use:tilt={{ max: 8 }}
import { animate } from "./animate.ts";
import { setStyle, reducedMotion, frame } from "./env.ts";

type Opts<T> = T | undefined;
const obj = <T extends object>(raw: unknown): Partial<T> => (raw && typeof raw === "object" ? (raw as Partial<T>) : {});

export interface DragOptions {
  axis: "x" | "y" | "both";
  bounds: { left?: number; right?: number; top?: number; bottom?: number };
  onStart: (p: { x: number; y: number }) => void;
  onMove: (p: { x: number; y: number; dx: number; dy: number }) => void;
  onEnd: (p: { x: number; y: number; vx: number; vy: number }) => void;
  /** Spring back to the origin on release. */
  snapBack: boolean;
}

/** Action: drag the element with the pointer (keyboard: arrow keys move by 10px when focused). */
export function drag(el: Element, raw?: unknown): () => void {
  const o = obj<DragOptions>(raw);
  const h = el as HTMLElement;
  let x = 0, y = 0, sx = 0, sy = 0, px = 0, py = 0, vx = 0, vy = 0, t = 0, active = false;
  const clamp = (v: number, lo?: number, hi?: number): number => Math.min(hi ?? Infinity, Math.max(lo ?? -Infinity, v));
  const apply = (): void => setStyle(el, { transform: `translate3d(${x}px, ${y}px, 0)` });
  const down = (e: PointerEvent): void => {
    active = true; sx = e.clientX - x; sy = e.clientY - y; px = e.clientX; py = e.clientY; t = e.timeStamp;
    h.setPointerCapture?.(e.pointerId);
    el.classList.add("is-dragging");
    o.onStart?.({ x, y });
  };
  const move = (e: PointerEvent): void => {
    if (!active) return;
    const nx = o.axis === "y" ? x : clamp(e.clientX - sx, o.bounds?.left, o.bounds?.right);
    const ny = o.axis === "x" ? y : clamp(e.clientY - sy, o.bounds?.top, o.bounds?.bottom);
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
    if (o.snapBack) { animate(el, [{ transform: `translate3d(${x}px, ${y}px, 0)` }, { transform: "none" }], { duration: 300, easing: "easeOutBack" }); x = 0; y = 0; }
  };
  const key = (e: KeyboardEvent): void => {
    const step = e.shiftKey ? 50 : 10;
    const d: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    const m = d[e.key];
    if (!m) return;
    e.preventDefault();
    if (o.axis !== "y") x = clamp(x + m[0], o.bounds?.left, o.bounds?.right);
    if (o.axis !== "x") y = clamp(y + m[1], o.bounds?.top, o.bounds?.bottom);
    apply();
    o.onMove?.({ x, y, dx: m[0], dy: m[1] });
  };
  h.addEventListener("pointerdown", down);
  h.addEventListener("pointermove", move);
  h.addEventListener("pointerup", up);
  h.addEventListener("pointercancel", up);
  h.addEventListener("keydown", key);
  setStyle(el, { touchAction: o.axis === "x" ? "pan-y" : o.axis === "y" ? "pan-x" : "none" });
  return () => { h.removeEventListener("pointerdown", down); h.removeEventListener("pointermove", move); h.removeEventListener("pointerup", up); h.removeEventListener("pointercancel", up); h.removeEventListener("keydown", key); };
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
  h.addEventListener("pointerdown", down);
  h.addEventListener("pointerup", up);
  return () => { h.removeEventListener("pointerdown", down); h.removeEventListener("pointerup", up); };
}

/** Action: subtle press-down scale. */
export function press(el: Element, raw?: Opts<number>): () => void {
  const scale = typeof raw === "number" ? raw : 0.97;
  const h = el as HTMLElement;
  const down = (): void => { if (!reducedMotion()) animate(el, [{ transform: "none" }, { transform: `scale(${scale})` }], { duration: 90, fill: "forwards" }); };
  const up = (): void => { animate(el, [{ transform: `scale(${scale})` }, { transform: "none" }], { duration: 160, easing: "easeOutBack" }); };
  h.addEventListener("pointerdown", down);
  h.addEventListener("pointerup", up);
  h.addEventListener("pointerleave", up);
  return () => { h.removeEventListener("pointerdown", down); h.removeEventListener("pointerup", up); h.removeEventListener("pointerleave", up); };
}

/** Action: the element is pulled toward the pointer while hovered. */
export function magnet(el: Element, raw?: unknown): () => void {
  const o = obj<{ strength: number }>(raw);
  const k = o.strength ?? 0.25;
  const h = el as HTMLElement;
  let pending = false, mx = 0, my = 0;
  const update = (): void => { pending = false; setStyle(el, { transform: `translate3d(${mx}px, ${my}px, 0)` }); };
  const move = (e: PointerEvent): void => {
    if (reducedMotion()) return;
    const r = el.getBoundingClientRect();
    mx = (e.clientX - (r.left + r.width / 2)) * k;
    my = (e.clientY - (r.top + r.height / 2)) * k;
    if (!pending) { pending = true; frame(update); }
  };
  const leave = (): void => { animate(el, [{ transform: `translate3d(${mx}px, ${my}px, 0)` }, { transform: "none" }], { duration: 400, easing: "easeOutElastic" }); mx = 0; my = 0; setStyle(el, { transform: null }); };
  h.addEventListener("pointermove", move);
  h.addEventListener("pointerleave", leave);
  return () => { h.removeEventListener("pointermove", move); h.removeEventListener("pointerleave", leave); };
}

/** Action: 3D tilt toward the pointer (max degrees), with an optional glare via --hm-tilt-x/--hm-tilt-y custom properties. */
export function tilt(el: Element, raw?: unknown): () => void {
  const o = obj<{ max: number; perspective: number }>(raw);
  const max = o.max ?? 8, persp = o.perspective ?? 800;
  const h = el as HTMLElement;
  const move = (e: PointerEvent): void => {
    if (reducedMotion()) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / (r.width || 1) - 0.5, py = (e.clientY - r.top) / (r.height || 1) - 0.5;
    setStyle(el, { transform: `perspective(${persp}px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg)`, "--hm-tilt-x": `${((px + 0.5) * 100).toFixed(1)}%`, "--hm-tilt-y": `${((py + 0.5) * 100).toFixed(1)}%` });
  };
  const leave = (): void => { animate(el, [{ transform: getComputedTransform(el) }, { transform: "none" }], { duration: 300 }); setStyle(el, { transform: null }); };
  h.addEventListener("pointermove", move);
  h.addEventListener("pointerleave", leave);
  return () => { h.removeEventListener("pointermove", move); h.removeEventListener("pointerleave", leave); };
}
function getComputedTransform(el: Element): string {
  return (el as HTMLElement).style?.getPropertyValue?.("transform") || "none";
}
