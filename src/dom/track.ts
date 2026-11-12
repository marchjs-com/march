// Pointer tracking inside an area: the shared drag of editors (color areas, sliders, curve handles, timeline heads,
// crop frames). Positions come as 0–1 fractions of the area (x mirrored in RTL when asked) and as pixels; the pointer
// is captured, so the drag continues outside the area. Listeners go with the owner (core/util › listen).
import { listen, clamp } from "../core/util.ts";

export interface TrackPoint {
  /** 0–1 across the area (from the inline start when `rtl` mirrors it). */
  x: number;
  /** 0–1 down the area. */
  y: number;
  /** Pixels from the area's left / top. */
  px: number;
  py: number;
  /** Pixels moved since the press. */
  dx: number;
  dy: number;
  rect: DOMRect;
  event: PointerEvent;
}
export interface TrackOptions {
  /** Called on press; return false to ignore this press. */
  onStart?: (p: TrackPoint) => boolean | void;
  onMove: (p: TrackPoint) => void;
  onEnd?: (p: TrackPoint) => void;
  /** Keep x / y inside 0–1 (default true). */
  clamp?: boolean;
  /** Mirror x in right-to-left text (x = 0 at the right edge). */
  rtl?: () => boolean;
  /** The element whose box gives the fractions (default: the element itself). */
  area?: () => Element | null | undefined;
  /** Mouse buttons that start a drag (default: primary only). */
  buttons?: number;
}

/** Track pointer drags that start on `el`. Returns a stop function (also run with the current owner). */
export function track(el: Element, o: TrackOptions): () => void {
  let start: { x: number; y: number } | null = null;
  const point = (e: PointerEvent): TrackPoint => {
    const rect = (o.area?.() ?? el).getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    let x = rect.width ? px / rect.width : 0, y = rect.height ? py / rect.height : 0;
    if (o.rtl?.()) x = 1 - x;
    if (o.clamp !== false) { x = clamp(x, 0, 1); y = clamp(y, 0, 1); }
    return { x, y, px, py, dx: e.clientX - (start?.x ?? e.clientX), dy: e.clientY - (start?.y ?? e.clientY), rect, event: e };
  };
  let offMove: (() => void) | null = null;
  const end = (e: PointerEvent): void => {
    if (!start) return;
    const p = point(e);
    start = null;
    offMove?.();
    offMove = null;
    o.onEnd?.(p);
  };
  return listen(el, {
    pointerdown: (e: PointerEvent) => {
      if (e.pointerType === "mouse" && !((o.buttons ?? 1) & (1 << e.button))) return;
      start = { x: e.clientX, y: e.clientY };
      const p = point(e);
      if (o.onStart?.(p) === false) { start = null; return; }
      (el as HTMLElement).setPointerCapture?.(e.pointerId);
      e.preventDefault();
      o.onMove(p);
      offMove = listen(el, { pointermove: (ev: PointerEvent) => { if (start) o.onMove(point(ev)); }, pointerup: end, pointercancel: end, lostpointercapture: end });
    },
  });
}

/** Arrow / Home / End / Page keys → a step (−1 … 1 per press, ×10 with Shift or Page keys); null for other keys. */
export function arrowStep(e: KeyboardEvent, rtl = false): { dx: number; dy: number; home?: boolean; end?: boolean } | null {
  const big = e.shiftKey ? 10 : 1;
  switch (e.key) {
    case "ArrowRight": return { dx: (rtl ? -1 : 1) * big, dy: 0 };
    case "ArrowLeft": return { dx: (rtl ? 1 : -1) * big, dy: 0 };
    case "ArrowUp": return { dx: 0, dy: -big };
    case "ArrowDown": return { dx: 0, dy: big };
    case "PageUp": return { dx: 0, dy: -10 };
    case "PageDown": return { dx: 0, dy: 10 };
    case "Home": return { dx: 0, dy: 0, home: true };
    case "End": return { dx: 0, dy: 0, end: true };
  }
  return null;
}
