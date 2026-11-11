// Virtual scrolling for fixed-height rows: only the visible window (+ overscan) is rendered, spacers keep the scroll size.
import { signal, computed, type Accessor, type Signal } from "../core/reactive.ts";

export interface WindowRange { start: number; end: number; top: number; bottom: number }
export interface WindowInput { count: number; scrollTop?: number; height: number; rowHeight: number; overscan?: number | undefined }

/** Rows [start, end) to render and the spacer heights above/below them. */
export function windowRange({ count, scrollTop = 0, height, rowHeight, overscan = 6 }: WindowInput): WindowRange {
  const first = Math.min(count, Math.floor(Math.max(0, scrollTop) / rowHeight));
  const start = Math.max(0, first - overscan);
  const end = Math.min(count, first + Math.ceil(height / rowHeight) + 1 + overscan);
  return { start, end, top: start * rowHeight, bottom: Math.max(0, (count - end) * rowHeight) };
}

export interface VirtualOptions { count: () => number; rowHeight: number; height: number; overscan?: number | undefined }
export interface Virtual {
  scrollTop: Signal<number>;
  viewport: Signal<number>;
  range: Accessor<WindowRange>;
  rowHeight: number;
  onScroll(el: { scrollTop: number; clientHeight: number }): void;
}

/** Reactive window over `count()` rows. Call `onScroll(el)` from the scroll container's "scroll" event. */
export function createVirtual(o: VirtualOptions): Virtual {
  const scrollTop = signal(0);
  const viewport = signal(o.height);
  const range = computed(() => windowRange({ count: o.count(), scrollTop: scrollTop(), height: viewport(), rowHeight: o.rowHeight, overscan: o.overscan }),
    { equals: (a, b) => !!a && a.start === b.start && a.end === b.end && a.top === b.top && a.bottom === b.bottom });
  return {
    scrollTop, viewport, range, rowHeight: o.rowHeight,
    onScroll(el) { scrollTop.set(el.scrollTop || 0); if (el.clientHeight) viewport.set(el.clientHeight); },
  };
}
