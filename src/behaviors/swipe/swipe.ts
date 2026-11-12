// Swipe behavior (hadi-march/behaviors/swipe): one source for "follow the finger, then settle" gestures — sheets and
// drawers, pull to refresh, swipe to reply, story navigation, lightbox paging. Axis lock (the first clear movement
// decides; the other axis is left to the page's own scrolling), a veto before the gesture is claimed, velocity from the
// last 100 ms for flings, rubber-band resistance past a limit, tap and hold for presses that never became a swipe, and
// the click that ends a mouse swipe is swallowed. Listens on the element itself (pointer capture once claimed).
import { clamp, isRtl, listen } from "../../core/util.ts";
import { getOwner, onCleanup } from "../../core/reactive.ts";

export type SwipeAxis = "x" | "y";
export interface SwipePoint {
  /** Movement since the gesture was claimed (px). */
  dx: number;
  dy: number;
  /** dx along the writing direction: positive toward the inline end (mirrored in RTL). */
  di: number;
  /** The locked axis. */
  axis: SwipeAxis;
  /** Velocity over the last ~100 ms (px / ms; positive = right / down). */
  vx: number;
  vy: number;
  event: PointerEvent;
}
export interface SwipeOptions {
  /** Which axis may be claimed: "x", "y" or "both" (the first clear movement decides). Default "both". */
  axis?: SwipeAxis | "both" | undefined;
  /** Px of movement before the axis is decided (default 6). */
  threshold?: number | undefined;
  /** Targets inside that never start a swipe (default: form fields, buttons, links, sliders, editable text). */
  ignore?: string | undefined;
  /** Called on pointerdown; return false to skip this press. */
  onPress?: ((e: PointerEvent) => boolean | void) | undefined;
  /** Called once the axis is decided, with the movement so far; return false to leave the gesture to the page. */
  accept?: ((p: { dx: number; dy: number; axis: SwipeAxis; event: PointerEvent }) => boolean) | undefined;
  onStart?: ((p: SwipePoint) => void) | undefined;
  onMove?: ((p: SwipePoint) => void) | undefined;
  /** `cancelled`: pointercancel. `p` carries the release velocity (for flings). */
  onEnd?: ((p: SwipePoint, cancelled: boolean) => void) | undefined;
  /** A press released without swiping (and without a hold when `holdMs` is set). */
  onTap?: ((e: PointerEvent) => void) | undefined;
  /** Hold: after `holdMs` without a swipe, `onHold` runs; `onRelease` when that press ends (or turns into a swipe). */
  holdMs?: number | undefined;
  onHold?: (() => void) | undefined;
  onRelease?: (() => void) | undefined;
  /** Mouse button (default 0); touch and pen always count. */
  button?: number | undefined;
  disabled?: (() => boolean) | undefined;
}

const IGNORE = "button, a, input, select, textarea, label, [contenteditable], [role=slider]";

/** Resistance past a limit: `over` px of pull give `k·√over` px of travel (default 4·√over). */
export const rubberBand = (over: number, k = 4): number => (over <= 0 ? 0 : Math.sqrt(over) * k);
/** Where a release at `pos` with velocity `v` (px / ms) would come to rest, capped (for snapping to the nearest point). */
export const fling = (pos: number, v: number, ms = 160, cap = 2): number => pos + clamp(v, -cap, cap) * ms;
/** The resting point nearest to `target` among `points`. */
export const nearest = <T extends number>(points: readonly T[], target: number): T =>
  points.reduce((a, b) => (Math.abs(b - target) < Math.abs(a - target) ? b : a));

/** Make `el` swipeable. Returns the cleanup. Works as an action: `<div use:swipeable={[swipeable, opts]}>`. */
export function swipeable(el: Element, o: SwipeOptions = {}): () => void {
  const node = el as HTMLElement;
  const threshold = o.threshold ?? 6;
  let pressed = false, claimed = false, swiped = false, held = false, sx = 0, sy = 0, ox = 0, oy = 0, axis: SwipeAxis = "x";
  let hold: ReturnType<typeof setTimeout> | null = null;
  let samples: [t: number, x: number, y: number][] = [];
  const stopHold = (): void => { if (hold) { clearTimeout(hold); hold = null; } };
  const point = (e: PointerEvent): SwipePoint => {
    const now = e.timeStamp;
    samples.push([now, e.clientX, e.clientY]);
    while (samples.length > 2 && now - (samples[0] as [number, number, number])[0] > 100) samples.shift();
    const [t0, x0, y0] = samples[0] as [number, number, number], dt = Math.max(1, now - t0);
    const dx = e.clientX - ox, dy = e.clientY - oy;
    return { dx, dy, di: isRtl(node) ? -dx : dx, axis, vx: (e.clientX - x0) / dt, vy: (e.clientY - y0) / dt, event: e };
  };
  const down = (ev: Event): void => {
    const e = ev as PointerEvent;
    if (o.disabled?.() || (e.pointerType === "mouse" || e.pointerType == null) && (e.button ?? 0) !== (o.button ?? 0)) return;
    const t = e.target as Element | null;
    const skip = t?.closest?.(o.ignore ?? IGNORE);
    if (skip && skip !== node && node.contains(skip)) return;
    if (o.onPress?.(e) === false) return;
    pressed = true; claimed = false; held = false; sx = e.clientX; sy = e.clientY; samples = [[e.timeStamp, e.clientX, e.clientY]];
    if (o.holdMs != null) hold = setTimeout(() => { hold = null; held = true; o.onHold?.(); }, o.holdMs);
  };
  const move = (ev: Event): void => {
    const e = ev as PointerEvent;
    if (!pressed) return;
    if (!claimed) {
      const ax = Math.abs(e.clientX - sx), ay = Math.abs(e.clientY - sy);
      if (Math.max(ax, ay) < threshold) return;
      stopHold();
      axis = ax > ay ? "x" : "y";
      const want = o.axis ?? "both";
      if ((want !== "both" && want !== axis) || o.accept?.({ dx: e.clientX - sx, dy: e.clientY - sy, axis, event: e }) === false) {
        pressed = false;
        if (held) { held = false; o.onRelease?.(); }
        return;
      }
      claimed = true; swiped = true; ox = sx; oy = sy;
      try { node.setPointerCapture?.(e.pointerId); } catch { /* the pointer is already gone */ }
      if (held) { held = false; o.onRelease?.(); }
      o.onStart?.(point(e));
    }
    e.preventDefault();
    o.onMove?.(point(e));
  };
  const end = (cancelled: boolean) => (ev: Event): void => {
    const e = ev as PointerEvent;
    if (!pressed) return;
    pressed = false;
    stopHold();
    if (claimed) { claimed = false; o.onEnd?.(point(e), cancelled); return; }
    if (held) { held = false; o.onRelease?.(); return; }
    if (!cancelled) o.onTap?.(e);
  };
  // the click that ends a mouse swipe must not activate what is under the pointer
  const click = (e: Event): void => { if (swiped) { swiped = false; e.preventDefault(); e.stopPropagation(); } };
  const down0 = (): void => { swiped = false; };
  // listeners leave with the current owner too (listen); the returned function removes them earlier
  const offCapture = listen(node, { pointerdown: down0, click }, true);
  const off = listen(node, { pointerdown: down, pointermove: move, pointerup: end(false), pointercancel: end(true) });
  if (getOwner()) onCleanup(stopHold);
  return () => { stopHold(); off(); offCapture(); };
}
