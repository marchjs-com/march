// Virtual windows: only the items in view (+ overscan) are rendered; spacers / offsets keep the scroll size.
// One home for every virtual list: Table rows, DataGrid rows AND columns, TreeView, FileManager.
//   windowRange() — fixed-size items, pure.
//   createAxis()  — one scroll axis with fixed or per-item sizes (prefix sums + binary search): offsetOf, indexAt, range.
//   createVirtual() — reactive rows window (kept for Table).
//   createViewport() — reactive 2-D window over a row axis and an optional column axis, bound to a scroll element.
import { signal, computed, onCleanup, getOwner, type Accessor, type Signal } from "./reactive.ts";
import { on } from "./util.ts";

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

const sameRange = (a: WindowRange | undefined, b: WindowRange): boolean => !!a && a.start === b.start && a.end === b.end && a.top === b.top && a.bottom === b.bottom;

/** Reactive window over `count()` rows. Call `onScroll(el)` from the scroll container's "scroll" event. */
export function createVirtual(o: VirtualOptions): Virtual {
  const scrollTop = signal(0);
  const viewport = signal(o.height);
  const range = computed(() => windowRange({ count: o.count(), scrollTop: scrollTop(), height: viewport(), rowHeight: o.rowHeight, overscan: o.overscan }), { equals: sameRange });
  return {
    scrollTop, viewport, range, rowHeight: o.rowHeight,
    onScroll(el) { scrollTop.set(el.scrollTop || 0); if (el.clientHeight) viewport.set(el.clientHeight); },
  };
}

// ------------------------------------------------------------------ axis (fixed or variable item sizes)

export interface AxisOptions {
  count: () => number;
  /** One size for every item (O(1) math) or a size per index (prefix sums, rebuilt when count / sizes change). */
  size: number | ((index: number) => number);
  overscan?: number | undefined;
}
export interface Axis {
  count(): number;
  /** Sum of all sizes. */
  total(): number;
  offsetOf(index: number): number;
  sizeOf(index: number): number;
  /** Index of the item covering `px` (clamped to [0, count - 1]; 0 when empty). */
  indexAt(px: number): number;
  /** Items [start, end) for a scroll position and viewport length; `top` / `bottom` are the spacer lengths. */
  range(scroll: number, viewport: number, overscan?: number): WindowRange;
}

/** One scroll axis. Reactive: `total()` / `offsetOf()` track `count()` and a reactive `size` function. */
export function createAxis(o: AxisOptions): Axis {
  const fixed = typeof o.size === "number" ? o.size : 0;
  const sizeFn = typeof o.size === "function" ? o.size : null;
  // prefix sums: offsets[i] = start of item i, offsets[n] = total
  const offsets = computed((): Float64Array => {
    const n = o.count();
    const out = new Float64Array(n + 1);
    if (sizeFn) for (let i = 0; i < n; i++) out[i + 1] = (out[i] as number) + Math.max(0, sizeFn(i));
    return out;
  });
  const axis: Axis = {
    count: o.count,
    total: () => (sizeFn ? (offsets()[o.count()] ?? 0) : o.count() * fixed),
    offsetOf: (i) => (sizeFn ? (offsets()[Math.max(0, Math.min(i, o.count()))] ?? 0) : Math.max(0, i) * fixed),
    sizeOf: (i) => (sizeFn ? sizeFn(i) : fixed),
    indexAt(px) {
      const n = o.count();
      if (n <= 0) return 0;
      if (!sizeFn) return Math.max(0, Math.min(n - 1, Math.floor(px / (fixed || 1))));
      const off = offsets();
      let lo = 0, hi = n - 1;
      while (lo < hi) { const mid = (lo + hi + 1) >> 1; if ((off[mid] as number) <= px) lo = mid; else hi = mid - 1; }
      return lo;
    },
    range(scroll, viewport, overscan = o.overscan ?? 4) {
      const n = o.count();
      if (n <= 0) return { start: 0, end: 0, top: 0, bottom: 0 };
      const first = axis.indexAt(Math.max(0, scroll)), last = axis.indexAt(Math.max(0, scroll) + Math.max(0, viewport));
      const start = Math.max(0, first - overscan), end = Math.min(n, last + 1 + overscan);
      return { start, end, top: axis.offsetOf(start), bottom: Math.max(0, axis.total() - axis.offsetOf(end)) };
    },
  };
  return axis;
}

// ------------------------------------------------------------------ viewport (2-D window bound to a scroll element)

export interface ViewportOptions {
  rows: Axis;
  cols?: Axis | undefined;
  /** Px taken by sticky chrome inside the scroller (header / footer rows, pinned columns): not part of the window. */
  inset?: (() => { top?: number; bottom?: number; start?: number; end?: number }) | undefined;
  overscan?: number | undefined;
  /** Initial viewport size before the element is measured. */
  height?: number | undefined;
  width?: number | undefined;
}
export interface Viewport {
  scrollTop: Signal<number>;
  scrollLeft: Signal<number>;
  height: Signal<number>;
  width: Signal<number>;
  rows: Accessor<WindowRange>;
  cols: Accessor<WindowRange>;
  /** Follow `el`'s scroll position and size (scroll + ResizeObserver; removed with the owner). */
  bind(el: HTMLElement): void;
  /** Scroll so item (row, col) is fully visible; returns true when it scrolled. */
  reveal(row: number | null, col?: number | null): boolean;
}

/** Reactive 2-D window. `scrollLeft` is the inline distance from the start edge (positive in RTL too). */
export function createViewport(o: ViewportOptions): Viewport {
  const scrollTop = signal(0), scrollLeft = signal(0), height = signal(o.height ?? 480), width = signal(o.width ?? 960);
  const inset = (): { top: number; bottom: number; start: number; end: number } => ({ top: 0, bottom: 0, start: 0, end: 0, ...(o.inset?.() ?? {}) });
  const rows = computed(() => { const i = inset(); return o.rows.range(scrollTop(), height() - i.top - i.bottom, o.overscan); }, { equals: sameRange });
  const cols = computed(() => {
    if (!o.cols) return { start: 0, end: 0, top: 0, bottom: 0 };
    const i = inset();
    return o.cols.range(scrollLeft(), width() - i.start - i.end, 1);
  }, { equals: sameRange });
  let el: HTMLElement | null = null;
  const vp: Viewport = {
    scrollTop, scrollLeft, height, width, rows, cols,
    bind(target) {
      el = target;
      const read = (): void => {
        scrollTop.set(target.scrollTop || 0);
        scrollLeft.set(Math.abs(target.scrollLeft || 0));
        if (target.clientHeight) height.set(target.clientHeight);
        if (target.clientWidth) width.set(target.clientWidth);
      };
      on(target, "scroll", read, { passive: true });
      const RO = globalThis.ResizeObserver;
      if (RO) { const ro = new RO(read); ro.observe(target); if (getOwner()) onCleanup(() => ro.disconnect()); }
      read();
    },
    reveal(row, col) {
      if (!el) return false;
      const i = inset();
      let moved = false;
      if (row != null && row >= 0) {
        const top = o.rows.offsetOf(row), bottom = top + o.rows.sizeOf(row), view = el.clientHeight - i.top - i.bottom;
        if (top < el.scrollTop) { el.scrollTop = top; moved = true; }
        else if (bottom > el.scrollTop + view) { el.scrollTop = bottom - view; moved = true; }
      }
      if (o.cols && col != null && col >= 0) {
        const start = o.cols.offsetOf(col), end = start + o.cols.sizeOf(col), view = el.clientWidth - i.start - i.end;
        const cur = Math.abs(el.scrollLeft), sign = el.scrollLeft < 0 || globalThis.getComputedStyle?.(el).direction === "rtl" ? -1 : 1;
        if (start < cur) { el.scrollLeft = sign * start; moved = true; }
        else if (end > cur + view) { el.scrollLeft = sign * (end - view); moved = true; }
      }
      if (moved) { scrollTop.set(el.scrollTop); scrollLeft.set(Math.abs(el.scrollLeft)); }
      return moved;
    },
  };
  return vp;
}
