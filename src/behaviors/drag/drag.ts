// Drag behavior (hadi-march/behaviors/drag), the one source of pointer dragging. pointerDrag(): one pointer drag session for components that move or resize things on a grid (DataGrid columns,
// Scheduler events, Gantt bars, TreeView and FileManager items). Movement threshold (a click stays a click), pointer
// capture, Escape cancels, and edge auto-scroll of a scroll container driven by the motion clock (onFrame), so global
// pause and speed apply. Deltas include the container's scroll change: positions stay right while it scrolls.
import { onFrame } from "../../motion/engine/clock.ts";
import { listen, isRtl } from "../../core/util.ts";

export interface DragPoint {
  /** Pointer movement since the start, plus the scroll container's scroll change (content coordinates). */
  dx: number;
  dy: number;
  /** dx along the writing direction: positive toward the inline end (left in RTL). */
  di: number;
  clientX: number;
  clientY: number;
  event: PointerEvent | null;
}
export interface PointerDragOptions {
  /** Px before the drag starts (default 4); below it pointerup is a click. */
  threshold?: number | undefined;
  /** Container to auto-scroll when the pointer nears its edges. */
  scroll?: HTMLElement | null | undefined;
  /** Edge size in px that triggers auto-scroll (default 48). */
  edge?: number | undefined;
  onStart?: ((p: DragPoint) => void) | undefined;
  onMove?: ((p: DragPoint) => void) | undefined;
  /** `cancelled`: Escape, pointercancel or `stop()`. Not called when the threshold was never passed. */
  onEnd?: ((p: DragPoint, cancelled: boolean) => void) | undefined;
  /** Pointerup before the threshold (a click). */
  onClick?: ((e: PointerEvent) => void) | undefined;
}

/** Start a drag from a pointerdown event. Returns `stop()` (ends it as cancelled). */
export function pointerDrag(down: PointerEvent, o: PointerDragOptions = {}): () => void {
  const x0 = down.clientX, y0 = down.clientY, sc = o.scroll ?? null;
  const sl0 = sc ? Math.abs(sc.scrollLeft) : 0, st0 = sc ? sc.scrollTop : 0;
  const threshold = o.threshold ?? 4, edge = o.edge ?? 48;
  let started = false, done = false, cx = x0, cy = y0, last: PointerEvent | null = down;
  const target = down.target as Element | null;
  try { (target as HTMLElement | null)?.setPointerCapture?.(down.pointerId); } catch { /* synthetic event */ }
  const rtl = !!target && isRtl(target);
  const point = (): DragPoint => {
    const dx = cx - x0 + (sc ? Math.abs(sc.scrollLeft) - sl0 : 0) * (sc && sc.scrollLeft < 0 ? -1 : 1);
    return { dx, dy: cy - y0 + (sc ? sc.scrollTop - st0 : 0), di: rtl ? -dx : dx, clientX: cx, clientY: cy, event: last };
  };
  // edge auto-scroll on the motion clock
  const stopFrames = sc ? onFrame((_t, dt) => {
    if (!started) return;
    const r = sc.getBoundingClientRect();
    const speed = (d: number): number => (d < edge ? ((edge - d) / edge) * 0.9 * dt : 0);
    const vy = speed(cy - r.top) ? -speed(cy - r.top) : speed(r.bottom - cy);
    const vx = speed(cx - r.left) ? -speed(cx - r.left) : speed(r.right - cx);
    if (!vx && !vy) return;
    const bt = sc.scrollTop, bl = sc.scrollLeft;
    sc.scrollTop += vy; sc.scrollLeft += vx;
    if (sc.scrollTop !== bt || sc.scrollLeft !== bl) o.onMove?.(point());
  }) : () => {};
  const finish = (cancelled: boolean): void => {
    if (done) return;
    done = true;
    off(); stopFrames();
    if (started) o.onEnd?.(point(), cancelled);
  };
  const move = (e: PointerEvent): void => {
    if (e.pointerId !== down.pointerId) return;
    cx = e.clientX; cy = e.clientY; last = e;
    if (!started) {
      if (Math.hypot(cx - x0, cy - y0) < threshold) return;
      started = true;
      o.onStart?.(point());
    }
    e.preventDefault();
    o.onMove?.(point());
  };
  const up = (e: PointerEvent): void => {
    if (e.pointerId !== down.pointerId) return;
    last = e;
    if (!started) { done = true; off(); stopFrames(); o.onClick?.(e); return; }
    finish(false);
  };
  const doc = (target?.ownerDocument ?? globalThis.document) as Document;
  const off = listen(doc, {
    pointermove: move, pointerup: up, pointercancel: () => finish(true),
    keydown: (e: KeyboardEvent) => { if (e.key === "Escape" && started) { e.preventDefault(); finish(true); } },
  });
  return () => finish(true);
}
