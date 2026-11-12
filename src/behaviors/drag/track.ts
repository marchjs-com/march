// track(): pointer drags measured inside an area, for editors (color areas, sliders, curve handles, timeline heads,
// crop frames). Built on pointerDrag (capture, Escape, one session per press): positions come as 0–1 fractions of the
// area (x mirrored in RTL when asked) and as pixels, and onMove runs on the press itself (a click on a track jumps).
import { clamp, listen } from "../../core/util.ts";
import { pointerDrag } from "./drag.ts";

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

/** Track pointer drags that start on `el`. Returns the cleanup (also run with the current owner). */
export function track(el: Element, o: TrackOptions): () => void {
  const point = (e: PointerEvent, x0: number, y0: number): TrackPoint => {
    const rect = (o.area?.() ?? el).getBoundingClientRect();
    const px = e.clientX - rect.left, py = e.clientY - rect.top;
    let x = rect.width ? px / rect.width : 0, y = rect.height ? py / rect.height : 0;
    if (o.rtl?.()) x = 1 - x;
    if (o.clamp !== false) { x = clamp(x, 0, 1); y = clamp(y, 0, 1); }
    return { x, y, px, py, dx: e.clientX - x0, dy: e.clientY - y0, rect, event: e };
  };
  const down = (e: PointerEvent): void => {
    if (e.pointerType === "mouse" && !((o.buttons ?? 1) & (1 << e.button))) return;
    const x0 = e.clientX, y0 = e.clientY;
    const p = point(e, x0, y0);
    if (o.onStart?.(p) === false) return;
    e.preventDefault();
    o.onMove(p);
    let last = e;
    const at = (q: { event: PointerEvent | null }): PointerEvent => (last = q.event ?? last);
    pointerDrag(e, {
      threshold: 0,
      onMove: (q) => o.onMove(point(at(q), x0, y0)),
      onEnd: (q) => o.onEnd?.(point(at(q), x0, y0)),
      onClick: (u) => o.onEnd?.(point(u, x0, y0)),
    });
  };
  return listen(el, { pointerdown: down });
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
