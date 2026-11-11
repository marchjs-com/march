// Virtual scrolling for fixed-height rows: only the visible window (+ overscan) is rendered, spacers keep the scroll size.
import { signal, computed } from "../core/reactive.ts";

/** Rows [start, end) to render and the spacer heights above/below them. */
export function windowRange({ count, scrollTop = 0, height, rowHeight, overscan = 6 }) {
  const first = Math.min(count, Math.floor(Math.max(0, scrollTop) / rowHeight));
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + Math.ceil(height / rowHeight) + 1 + overscan);
  return { start, end, top: start * rowHeight, bottom: Math.max(0, (count - end) * rowHeight) };
}

/**
 * Reactive window over `count()` rows. Call `onScroll(el)` from the scroll container's "scroll" event.
 * @param {{ count: () => number, rowHeight: number, height: number, overscan?: number }} o
 */
export function createVirtual(o) {
  const scrollTop = signal(0);
  const viewport = signal(o.height);
  const range = computed(() => windowRange({ count: o.count(), scrollTop: scrollTop(), height: viewport(), rowHeight: o.rowHeight, overscan: o.overscan }),
    { equals: (a, b) => a && a.start === b.start && a.end === b.end && a.top === b.top && a.bottom === b.bottom });
  return {
    scrollTop, viewport, range, rowHeight: o.rowHeight,
    onScroll(el) { scrollTop.set(el.scrollTop || 0); if (el.clientHeight) viewport.set(el.clientHeight); },
  };
}
