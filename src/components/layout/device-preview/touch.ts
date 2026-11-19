// The finger of DevicePreview: the mouse becomes one, two or three fingers on a touch screen. The code inside gets real
// TouchEvents (touches, targetTouches, changedTouches) and PointerEvents with pointerType "touch" (one pointer per finger,
// implicitly captured like a real touch; setPointerCapture works on them), never the mouse's own events. A drag scrolls
// what is under it (unless touchstart / touchmove was prevented or touch-action forbids it) and flings; a long press
// opens the context menu. Shift + drag: two fingers mirrored around a pivot (pinch and rotate); the finger count (1–3)
// moves that many fingers side by side (two-finger scroll, three-finger swipe). play() performs a gesture by itself.
import { animateValue } from "../../../motion/engine/value.ts";

export type Gesture = "tap" | "double-tap" | "long-press" | "swipe-left" | "swipe-right" | "swipe-up" | "swipe-down" | "pinch-in" | "pinch-out" | "rotate" | "pan-2" | "swipe-3-left" | "swipe-3-right" | "swipe-3-up";
/** Every gesture play() performs. */
export const GESTURES: readonly Gesture[] = ["tap", "double-tap", "long-press", "swipe-left", "swipe-right", "swipe-up", "swipe-down", "pinch-in", "pinch-out", "rotate", "pan-2", "swipe-3-left", "swipe-3-right", "swipe-3-up"];

export interface TouchSimOptions {
  /** Where the mouse is listened to (the screen element, or the document of a framed page). */
  surface: Document | HTMLElement;
  /** Where the finger dots are drawn (positioned). */
  layer: HTMLElement;
  /** A point of the surface (client px) → the layer's own px. */
  toLayer(x: number, y: number): { x: number; y: number };
  /** The layer's px → a point of the surface (client px). */
  fromLayer(x: number, y: number): { x: number; y: number };
  /** The scrolling root of the page shown. */
  root(): HTMLElement;
  /** Touch on now. */
  on(): boolean;
  /** How many fingers a drag uses (1–3). */
  fingers(): number;
  /** The mouse moved over the surface (client px): the hover dot. */
  onHover?(x: number, y: number): void;
  /** Pressed / released. */
  onPress?(down: boolean): void;
  /** A gesture was recognised or played (for a log). */
  onGesture?(name: string): void;
  /** Elements the mouse keeps (an on-screen keyboard). */
  skip?(target: Element): boolean;
}
export interface TouchSim { play(g: Gesture, at?: { x: number; y: number }): Promise<void>; dispose(): void }

interface Finger { id: number; pid: number; x: number; y: number; target: Element; primary: boolean; dot: HTMLElement; dx: number; dy: number }

// synthetic pointers: setPointerCapture on them records the capture (the browser would throw: it does not know them)
let nextId = 2000;
const synthetic = new Map<number, { el: Element | null }>();
const patched = new WeakSet<object>();
function patchCapture(win: Window & typeof globalThis): void {
  const P = win.Element?.prototype;
  if (!P || patched.has(P)) return;
  patched.add(P);
  const set = P.setPointerCapture, rel = P.releasePointerCapture, has = P.hasPointerCapture;
  P.setPointerCapture = function (this: Element, id: number) { const s = synthetic.get(id); if (s) { s.el = this; return; } return set.call(this, id); };
  P.releasePointerCapture = function (this: Element, id: number) { const s = synthetic.get(id); if (s) { if (s.el === this) s.el = null; return; } return rel.call(this, id); };
  P.hasPointerCapture = function (this: Element, id: number) { const s = synthetic.get(id); return s ? s.el === this : has.call(this, id); };
}

/** The nearest element under `el` that can scroll on the axis. */
function scrollerOf(el: Element | null, stop: Element, axis: "x" | "y"): HTMLElement {
  for (let e = el as HTMLElement | null; e && e !== stop; e = e.parentElement) {
    const s = getComputedStyle(e), o = axis === "y" ? s.overflowY : s.overflowX;
    if (/(auto|scroll)/.test(o) && (axis === "y" ? e.scrollHeight > e.clientHeight : e.scrollWidth > e.clientWidth)) return e;
  }
  return stop as HTMLElement;
}
/** The axes touch-action lets the browser pan on, from the target up. */
function panAxes(el: Element | null, stop: Element): { x: boolean; y: boolean } {
  let x = true, y = true;
  for (let e = el as HTMLElement | null; e && e !== stop.parentElement; e = e.parentElement) {
    const ta = getComputedStyle(e).touchAction;
    if (!ta || ta === "auto" || ta === "manipulation") continue;
    if (ta === "none") return { x: false, y: false };
    if (!/pan-x|pan-left|pan-right/.test(ta)) x = false;
    if (!/pan-y|pan-up|pan-down/.test(ta)) y = false;
  }
  return { x, y };
}

/** Make the mouse a finger on `surface` (see the module comment). */
export function touchSim(o: TouchSimOptions): TouchSim {
  const doc = (o.surface as Document).nodeType === 9 ? (o.surface as Document) : (o.surface as HTMLElement).ownerDocument;
  const win = doc.defaultView as Window & typeof globalThis;
  patchCapture(win);
  const live = new Map<number, Finger>();
  const ownerDoc = o.layer.ownerDocument;
  const pivot = ownerDoc.createElement("div");
  pivot.className = "m-device-pivot";
  pivot.setAttribute("aria-hidden", "true");
  o.layer.appendChild(pivot);
  const place = (el: HTMLElement, x: number, y: number): void => { const p = o.toLayer(x, y); el.style.translate = `${p.x}px ${p.y}px`; };
  const unit = (): number => { const a = o.fromLayer(0, 0), b = o.fromLayer(100, 0); return (b.x - a.x) / 100 || 1; };

  const touch = (f: Finger): Touch | null => {
    const T = (win as unknown as { Touch?: typeof Touch }).Touch;
    if (!T) return null;
    try { return new T({ identifier: f.id, target: f.target, clientX: f.x, clientY: f.y, pageX: f.x + win.scrollX, pageY: f.y + win.scrollY, screenX: f.x, screenY: f.y, radiusX: 11, radiusY: 11, rotationAngle: 0, force: 0.5 }); } catch { return null; }
  };
  /** A TouchEvent per target of the changed fingers; false when one was prevented. */
  const sendTouch = (type: string, changed: Finger[]): boolean => {
    const TE = (win as unknown as { TouchEvent?: typeof TouchEvent }).TouchEvent;
    if (!TE) return true;
    const all = [...live.values()];
    const list = (fs: Finger[]): Touch[] => fs.map(touch).filter((t): t is Touch => !!t);
    let ok = true;
    for (const target of new Set(changed.map((f) => f.target))) {
      const e = new TE(type, { bubbles: true, cancelable: type !== "touchcancel", composed: true, view: win,
        touches: list(all), targetTouches: list(all.filter((f) => f.target === target)), changedTouches: list(changed.filter((f) => f.target === target)) });
      if (!target.dispatchEvent(e)) ok = false;
    }
    return ok;
  };
  const sendPointer = (type: string, f: Finger): boolean => {
    const target = synthetic.get(f.pid)?.el ?? f.target;
    const up = type === "pointerup" || type === "pointercancel";
    return target.dispatchEvent(new win.PointerEvent(type, { bubbles: true, cancelable: true, composed: true, view: win, pointerId: f.pid, pointerType: "touch", isPrimary: f.primary,
      clientX: f.x, clientY: f.y, screenX: f.x, screenY: f.y, button: type === "pointermove" ? -1 : 0, buttons: up ? 0 : 1, width: 22, height: 22, pressure: up ? 0 : 0.5 }));
  };
  const at = (x: number, y: number, fallback: Element): Element => {
    const el = doc.elementFromPoint(x, y);
    return el && (o.surface as Node).contains(el) ? el : fallback;
  };
  const addFinger = (x: number, y: number, target: Element, primary: boolean, dx = 0, dy = 0): Finger => {
    const dot = ownerDoc.createElement("div");
    dot.className = "m-device-finger";
    dot.setAttribute("aria-hidden", "true");
    o.layer.appendChild(dot);
    const f: Finger = { id: live.size, pid: nextId++, x, y, target, primary, dot, dx, dy };
    synthetic.set(f.pid, { el: null });
    live.set(f.pid, f);
    place(dot, x, y);
    sendPointer("pointerover", f); sendPointer("pointerdown", f);
    return f;
  };
  const moveFinger = (f: Finger, x: number, y: number): void => { f.x = x; f.y = y; place(f.dot, x, y); sendPointer("pointermove", f); };
  const lift = (cancel = false): boolean => {
    const fs = [...live.values()];
    for (const f of fs) { sendPointer(cancel ? "pointercancel" : "pointerup", f); sendPointer("pointerout", f); }
    live.clear();
    const ok = sendTouch(cancel ? "touchcancel" : "touchend", fs);
    for (const f of fs) { synthetic.delete(f.pid); f.dot.classList.add("is-up"); setTimeout(() => f.dot.remove(), 260); }
    pivot.classList.remove("is-on");
    return ok;
  };

  // ---- the mouse as fingers
  let drag: { x: number; y: number; mirror: boolean; cx: number; cy: number; moved: boolean; prevented: boolean; axes: { x: boolean; y: boolean }; sx?: HTMLElement; sy?: HTMLElement; target: Element } | null = null;
  let last = { x: 0, y: 0, t: 0, vx: 0, vy: 0 };
  let fling: { cancel(): void } | null = null;
  let press: ReturnType<typeof setTimeout> | undefined;
  let eatClick = false, playing = false;
  const positions = (px: number, py: number): { x: number; y: number }[] => {
    if (!drag) return [];
    if (drag.mirror) return [{ x: px, y: py }, { x: 2 * drag.cx - px, y: 2 * drag.cy - py }];
    return [...live.values()].map((f) => ({ x: px + f.dx, y: py + f.dy }));
  };
  const scrollBy = (dx: number, dy: number): void => {
    if (!drag || drag.prevented) return;
    const r = o.root(), k = unit();
    drag.sy ??= scrollerOf(drag.target, r, "y");
    drag.sx ??= scrollerOf(drag.target, r, "x");
    if (drag.axes.y) drag.sy.scrollTop -= dy / k;
    if (drag.axes.x && (drag.sx !== r || r.scrollWidth > r.clientWidth)) drag.sx.scrollLeft -= dx / k;
  };
  const begin = (x: number, y: number, target: Element, n: number, mirror: boolean): void => {
    fling?.cancel();
    const k = unit(), gap = 46 * k;
    drag = { x, y, mirror, cx: x - 70 * k, cy: y, moved: false, prevented: false, axes: panAxes(target, o.root()), target };
    const made: Finger[] = [];
    if (mirror) {
      made.push(addFinger(x, y, target, true));
      const bx = 2 * drag.cx - x, by = 2 * drag.cy - y;
      made.push(addFinger(bx, by, at(bx, by, target), false));
      place(pivot, drag.cx, drag.cy); pivot.classList.add("is-on");
    } else {
      for (let i = 0; i < n; i++) { const dx = (i - (n - 1) / 2) * gap; made.push(addFinger(x + dx, y, i === 0 && n === 1 ? target : at(x + dx, y, target), i === 0, dx, 0)); }
    }
    drag.prevented = !sendTouch("touchstart", made);
    last = { x, y, t: performance.now(), vx: 0, vy: 0 };
    o.onPress?.(true);
  };
  const moveTo = (x: number, y: number, t: number): boolean => {
    if (!drag) return true;
    const ps = positions(x, y), fs = [...live.values()];
    fs.forEach((f, i) => moveFinger(f, ps[i]!.x, ps[i]!.y));
    const ok = sendTouch("touchmove", fs);
    if (!ok) drag.prevented = true;
    const dx = x - last.x, dy = y - last.y, dt = Math.max(1, t - last.t);
    if (!drag.mirror) scrollBy(dx, dy);
    last = { x, y, t, vx: dx / dt, vy: dy / dt };
    return ok;
  };
  const finish = (): boolean => {
    if (!drag) return true;
    const d = drag, n = live.size;
    const ok = lift();
    if (d.moved) o.onGesture?.(d.mirror ? "pinch / rotate" : n > 1 ? `${n}-finger swipe` : "swipe");
    if (d.moved && !d.mirror && !d.prevented && d.sy && Math.abs(last.vy) > 0.05) {
      const sy = d.sy, v = (last.vy * 16) / unit();
      if (Math.abs(v) > 0.5) { const from = sy.scrollTop; fling = animateValue(0, 1, { duration: 700, easing: "easeOutCubic", onUpdate: (p: number) => { sy.scrollTop = from - v * 22 * p; } }); }
    }
    drag = null;
    o.onPress?.(false);
    return ok;
  };
  const mine = (e: Event): boolean => e.isTrusted && o.on() && !playing && !(o.skip && e.target instanceof Element && o.skip(e.target));
  const stop = (e: Event): void => { e.stopImmediatePropagation(); };
  const down = (e: PointerEvent): void => {
    if (!mine(e) || e.pointerType !== "mouse") return;
    stop(e);
    if (e.button !== 0) return;
    // the mouse stays with the fingers when it leaves the screen while pressed (its release lifts them)
    try { (e.target as Element).setPointerCapture?.(e.pointerId); } catch { /* not capturable */ }
    begin(e.clientX, e.clientY, e.target as Element, Math.max(1, Math.min(3, o.fingers() | 0)), e.shiftKey);
    const target = e.target as Element, cx = e.clientX, cy = e.clientY;
    clearTimeout(press);
    if (live.size === 1) press = setTimeout(() => { if (drag && !drag.moved) { target.dispatchEvent(new win.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: cx, clientY: cy })); o.onGesture?.("long press"); } }, 550);
  };
  const move = (e: PointerEvent): void => {
    if (!mine(e) || e.pointerType !== "mouse") return;
    stop(e);
    o.onHover?.(e.clientX, e.clientY);
    if (!drag) return;
    if (!drag.moved && Math.hypot(e.clientX - drag.x, e.clientY - drag.y) > 6) { drag.moved = true; clearTimeout(press); }
    if (drag.moved) moveTo(e.clientX, e.clientY, e.timeStamp);
  };
  const up = (e: PointerEvent): void => {
    if (!mine(e) || e.pointerType !== "mouse") return;
    stop(e);
    clearTimeout(press);
    const moved = !!drag?.moved, many = live.size > 1;
    const ok = finish();
    eatClick = moved || many || !ok;
  };
  const click = (e: Event): void => { if (eatClick && e.isTrusted) { eatClick = false; e.preventDefault(); e.stopImmediatePropagation(); } };
  const quiet = (e: Event): void => { if (mine(e) && (e as PointerEvent).pointerType !== "touch") stop(e); };
  const noDrag = (e: Event): void => { if (o.on()) e.preventDefault(); };
  const map: [string, EventListener][] = [["pointerdown", down as EventListener], ["pointermove", move as EventListener], ["pointerup", up as EventListener], ["pointercancel", up as EventListener], ["click", click], ["dragstart", noDrag],
    ...["mousedown", "mousemove", "mouseup", "mouseover", "mouseout", "pointerover", "pointerout", "pointerenter", "pointerleave"].map((t) => [t, quiet] as [string, EventListener])];
  const host: EventTarget = (o.surface as Document).nodeType === 9 ? win : o.surface;
  for (const [t, f] of map) host.addEventListener(t, f, true);

  // ---- gestures played by themselves (around the middle of the screen, or a point of the layer)
  const sleep = (ms: number): Promise<void> => new Promise((r) => { setTimeout(r, ms); });
  const tween = (ms: number, f: (p: number) => void): Promise<void> => new Promise((r) => { animateValue(0, 1, { duration: ms, easing: "easeInOutCubic", onUpdate: f, onComplete: () => r() }); });
  async function play(g: Gesture, pt?: { x: number; y: number }): Promise<void> {
    if (playing || drag) return;
    playing = true;
    try {
      const r = o.layer.getBoundingClientRect(), k = unit();
      const mid = pt ? o.fromLayer(pt.x, pt.y) : { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      const target = at(mid.x, mid.y, o.root());
      const path = (fn: (p: number) => { x: number; y: number }[]): ((p: number) => { x: number; y: number }[]) => fn;
      const tapAt = async (): Promise<void> => {
        begin(mid.x, mid.y, target, 1, false);
        await sleep(70);
        const ok = finish();
        if (ok) target.dispatchEvent(new win.MouseEvent("click", { bubbles: true, cancelable: true, clientX: mid.x, clientY: mid.y, view: win }));
      };
      if (g === "tap") { await tapAt(); o.onGesture?.("tap"); return; }
      if (g === "double-tap") { await tapAt(); await sleep(110); await tapAt(); target.dispatchEvent(new win.MouseEvent("dblclick", { bubbles: true, cancelable: true, clientX: mid.x, clientY: mid.y, view: win })); o.onGesture?.("double tap"); return; }
      if (g === "long-press") {
        begin(mid.x, mid.y, target, 1, false); await sleep(600);
        target.dispatchEvent(new win.MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: mid.x, clientY: mid.y, view: win }));
        finish(); o.onGesture?.("long press"); return;
      }
      const R = 110 * k, S = Math.min(r.height * 0.32, 220 * k);
      const row = (n: number, x: number, y: number): { x: number; y: number }[] => Array.from({ length: n }, (_, i) => ({ x: x + (i - (n - 1) / 2) * 46 * k, y }));
      const paths: Record<string, (p: number) => { x: number; y: number }[]> = {
        "swipe-left": path((p) => row(1, mid.x + S * (0.6 - 1.2 * p), mid.y)),
        "swipe-right": path((p) => row(1, mid.x - S * (0.6 - 1.2 * p), mid.y)),
        "swipe-up": path((p) => row(1, mid.x, mid.y + S * (0.6 - 1.2 * p))),
        "swipe-down": path((p) => row(1, mid.x, mid.y - S * (0.6 - 1.2 * p))),
        "pinch-in": path((p) => { const d = R * (1 - 0.7 * p); return [{ x: mid.x - d, y: mid.y - d * 0.4 }, { x: mid.x + d, y: mid.y + d * 0.4 }]; }),
        "pinch-out": path((p) => { const d = R * (0.3 + 0.7 * p); return [{ x: mid.x - d, y: mid.y - d * 0.4 }, { x: mid.x + d, y: mid.y + d * 0.4 }]; }),
        "rotate": path((p) => { const a = (p * Math.PI) / 2; return [{ x: mid.x - R * Math.cos(a), y: mid.y - R * Math.sin(a) }, { x: mid.x + R * Math.cos(a), y: mid.y + R * Math.sin(a) }]; }),
        "pan-2": path((p) => row(2, mid.x, mid.y + S * (0.6 - 1.2 * p))),
        "swipe-3-left": path((p) => row(3, mid.x + S * (0.6 - 1.2 * p), mid.y)),
        "swipe-3-right": path((p) => row(3, mid.x - S * (0.6 - 1.2 * p), mid.y)),
        "swipe-3-up": path((p) => row(3, mid.x, mid.y + S * (0.6 - 1.2 * p))),
      };
      const fn = paths[g];
      if (!fn) return;
      const start = fn(0), mirror = g === "pinch-in" || g === "pinch-out" || g === "rotate";
      fling?.cancel();
      drag = { x: start[0]!.x, y: start[0]!.y, mirror, cx: mid.x, cy: mid.y, moved: true, prevented: false, axes: panAxes(target, o.root()), target };
      const made = start.map((s, i) => addFinger(s.x, s.y, at(s.x, s.y, target), i === 0, s.x - start[0]!.x, s.y - start[0]!.y));
      if (mirror) { place(pivot, mid.x, mid.y); pivot.classList.add("is-on"); }
      drag.prevented = !sendTouch("touchstart", made);
      last = { x: start[0]!.x, y: start[0]!.y, t: performance.now(), vx: 0, vy: 0 };
      await sleep(60);
      await tween(g.startsWith("swipe") ? 380 : 750, (p) => {
        const ps = fn(p), fs = [...live.values()];
        fs.forEach((f, i) => moveFinger(f, ps[i]!.x, ps[i]!.y));
        if (!sendTouch("touchmove", fs) && drag) drag.prevented = true;
        if (!mirror && g !== "swipe-3-left" && g !== "swipe-3-right" && g !== "swipe-3-up") { scrollBy(ps[0]!.x - last.x, ps[0]!.y - last.y); }
        last = { x: ps[0]!.x, y: ps[0]!.y, t: performance.now(), vx: 0, vy: 0 };
      });
      await sleep(40);
      lift(); drag = null;
      o.onGesture?.(g);
    } finally { playing = false; }
  }
  return {
    play,
    dispose() { clearTimeout(press); fling?.cancel(); if (live.size) lift(true); for (const [t, f] of map) host.removeEventListener(t, f, true); pivot.remove(); },
  };
}
