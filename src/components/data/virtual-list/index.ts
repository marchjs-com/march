// VirtualList (hadi-march/ui): a long list that only keeps the rows near the viewport in the DOM. Rows can have any
// height: each row is measured when it renders (ResizeObserver) and an estimate stands in until then; rows above the
// viewport that change height keep the content still (scroll anchoring). Rows keep their DOM while they stay in range
// and get an accessor to their item, so an updated item (a like) updates the row instead of rebuilding it. The scroll
// area is the list itself or its nearest scrolling parent (a PullToRefresh, the page). Reads and writes are batched on
// the motion engine's frame (measure / mutate).
import { signal, effect, untrack, onCleanup, createRoot, type Signal } from "../../../core/reactive.ts";
import { h } from "../../../dom/h.ts";
import { val, cx, listen, setStyle, type MaybeFn, type ClassProp } from "../../../ui/util.ts";
import { clamp } from "../../../core/util.ts";
import { measure } from "../../../motion/engine/clock.ts";
import "./virtual-list.css";

export interface VirtualListProps<T> {
  items: MaybeFn<readonly T[]>;
  /** Stable row key (default: the index). */
  key?: ((item: T, index: number) => string | number) | undefined;
  /** Draws a row; `item` is an accessor that follows updates of the same key. */
  render: (item: () => T, index: number) => unknown;
  /** Height guess (px) for rows not measured yet. Default 120. */
  estimate?: number | undefined;
  /** Extra pixels kept rendered above and below the viewport. Default 600. */
  overscan?: number | undefined;
  /** Space between rows (px). Default 0. */
  gap?: number | undefined;
  /** self: the list scrolls (give it a height) · parent: the nearest scrolling ancestor. Default self. */
  scroll?: "self" | "parent" | undefined;
  /** Called once per item count when the viewport is within `endDistance` of the end (infinite scroll). */
  onEndReached?: (() => void) | undefined;
  /** Default 800 px. */
  endDistance?: number | undefined;
  /** Before the rows (inside the scroll area). */
  header?: unknown;
  /** After the rows: a loader, "no more" … */
  footer?: unknown;
  label?: MaybeFn<string | undefined>;
  /** Role of the rows' container (default "list"). With another role ("listbox", "menu") the rows are yours: the row wrappers become presentational and what `render` returns carries the role, the state and `aria-posinset` / `aria-setsize`. */
  role?: string | undefined;
  /** Id of the rows' container (a field's `aria-controls`). */
  id?: string | undefined;
  /** Receives the list's handle once: `scrollToIndex(i)` brings a row into view (keyboard movement in a picker). */
  api?: ((api: VirtualListApi) => void) | undefined;
  class?: ClassProp;
}

/** Handle of a VirtualList (`api` prop). */
export interface VirtualListApi {
  /** Scroll so row `index` is in view: "nearest" (default: only as far as needed), "start" or "center". */
  scrollToIndex(index: number, align?: "nearest" | "start" | "center"): void;
}

interface Row<T> { el: HTMLElement; item: Signal<T>; index: Signal<number>; dispose: () => void }

const scrollParent = (el: HTMLElement): HTMLElement => {
  for (let p = el.parentElement; p; p = p.parentElement) {
    const o = typeof getComputedStyle === "function" ? getComputedStyle(p).overflowY : "";
    if (o === "auto" || o === "scroll") return p;
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement;
};

/** `<VirtualList items={$posts} key={(p) => p.id} render={(p) => <PostCard post={p} />} onEndReached={loadMore} />` */
export function VirtualList<T>(props: VirtualListProps<T>): Element {
  const estimate = props.estimate ?? 120, overscan = props.overscan ?? 600, gap = props.gap ?? 0;
  const plain = !props.role || props.role === "list";
  const keyOf = (it: T, i: number): string | number => (props.key ? props.key(it, i) : i);
  const heights = new Map<string | number, number>();
  const rows = new Map<string | number, Row<T>>();
  const range = signal<[number, number]>([0, 0]);
  let items: readonly T[] = [];
  let tops: number[] = [], total = 0, dirty = true, endAt = -1;
  let root!: HTMLElement, win!: HTMLElement, scroller: HTMLElement | null = null, cancel: (() => void) | null = null;
  const ro = typeof ResizeObserver === "function" ? new ResizeObserver((entries) => {
    let anchor = 0;
    for (const e of entries) {
      const el = e.target as HTMLElement, k = (el as unknown as { mKey?: string | number }).mKey;
      if (k === undefined) continue; // the scroll area itself: only a new viewport size
      const hgt = el.offsetHeight, was = heights.get(k) ?? estimate;
      if (hgt === was) continue;
      heights.set(k, hgt); dirty = true;
      // a row above the viewport changed: keep what the reader sees still
      if (scroller && el.getBoundingClientRect().bottom <= scroller.getBoundingClientRect().top + 1) anchor += hgt - was;
    }
    if (anchor && scroller) scroller.scrollTop += anchor;
    schedule();
  }) : null;

  const layout = (): void => {
    if (!dirty) return;
    tops = new Array(items.length);
    let y = 0;
    for (let i = 0; i < items.length; i++) { tops[i] = y; y += (heights.get(keyOf(items[i] as T, i)) ?? estimate) + gap; }
    total = Math.max(0, y - gap);
    dirty = false;
  };
  const update = (): void => {
    cancel = null;
    if (!root?.isConnected && rows.size) return;
    layout();
    const sc = scroller ?? root;
    const view = sc.clientHeight || (typeof innerHeight === "number" ? innerHeight : 800);
    // where the rows start inside the scroll content
    const n = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);
    const st = n(sc.scrollTop);
    const start = props.scroll === "parent" && scroller ? n(win.getBoundingClientRect?.().top) - n(scroller.getBoundingClientRect?.().top) + n(scroller.scrollTop) : n(win.offsetTop);
    const top = st - start - overscan, bottom = st - start + view + overscan;
    let a = 0, lo = 0, hi = items.length - 1;
    while (lo <= hi) { const m = (lo + hi) >> 1; if ((tops[m] as number) + (heights.get(keyOf(items[m] as T, m)) ?? estimate) < top) { a = m + 1; lo = m + 1; } else hi = m - 1; }
    let b = a;
    while (b < items.length && (tops[b] as number) < bottom) b++;
    const [ra, rb] = range.peek();
    if (ra !== a || rb !== b) range.set([a, b]);
    else draw();
    if (props.onEndReached && items.length && endAt !== items.length && st - start + view >= total - (props.endDistance ?? 800)) { endAt = items.length; props.onEndReached(); }
  };
  const schedule = (): void => { if (!cancel) cancel = measure(update); };

  const draw = (): void => {
    const [a, b] = range.peek();
    const keep = new Set<string | number>();
    const nodes: HTMLElement[] = [];
    for (let i = a; i < b; i++) {
      const it = items[i] as T, k = keyOf(it, i);
      keep.add(k);
      let r = rows.get(k);
      if (!r) {
        r = createRoot((dispose) => {
          const item = signal(it), index = signal(i);
          const el = h("div", { class: "m-vlist-row", role: plain ? "listitem" : "presentation" }, props.render(() => item(), i)) as HTMLElement;
          return { el, item, index, dispose };
        });
        (r.el as unknown as { mKey: string | number }).mKey = k;
        rows.set(k, r);
        ro?.observe(r.el);
      } else { r.item.set(it); r.index.set(i); }
      if (plain) { r.el.setAttribute("aria-posinset", String(i + 1)); r.el.setAttribute("aria-setsize", String(items.length)); }
      nodes.push(r.el);
    }
    for (const [k, r] of rows) if (!keep.has(k)) { ro?.unobserve(r.el); r.dispose(); rows.delete(k); }
    win.replaceChildren(...nodes);
    const last = b - 1;
    const after = b > a && b <= items.length ? total - ((tops[last] as number) + (heights.get(keyOf(items[last] as T, last)) ?? estimate)) : 0;
    setStyle(win, { "padding-block-start": `${tops[a] ?? 0}px`, "padding-block-end": `${Math.max(0, after)}px`, "row-gap": gap ? `${gap}px` : null });
  };

  root = h("div", {
    class: () => cx("m-vlist", props.scroll === "parent" ? "m-vlist-parent" : "m-vlist-self", val(props.class)),
    role: "list", "aria-label": () => val(props.label) ?? null,
  }, props.header ?? null, h("div", { class: "m-vlist-win", ref: (x: HTMLElement) => { win = x; } }), props.footer ?? null) as HTMLElement;
  // the root is a list for its rows only: header and footer sit outside it
  root.removeAttribute("role");
  win.setAttribute("role", props.role ?? "list");
  if (props.id) win.id = props.id;
  const lbl = val(props.label); if (lbl) win.setAttribute("aria-label", lbl);

  effect(() => {
    const next = val(props.items);
    untrack(() => {
      if (next !== items) { items = next; dirty = true; if (endAt > items.length) endAt = -1; }
      // rows already drawn follow their item at once (same key, new object)
      for (let i = range.peek()[0]; i < Math.min(range.peek()[1], items.length); i++) { const r = rows.get(keyOf(items[i] as T, i)); r?.item.set(items[i] as T); }
      schedule();
    });
  });
  effect(() => { range(); untrack(draw); });
  queueMicrotask(() => {
    scroller = props.scroll === "parent" ? scrollParent(root) : root;
    const target = scroller === document.scrollingElement || scroller === document.documentElement ? window : scroller;
    listen(target, { scroll: schedule }, { passive: true });
    ro?.observe(scroller === document.documentElement ? document.body : scroller);
    update();
  });
  props.api?.({
    scrollToIndex: (index, align = "nearest") => {
      const sc = scroller ?? root;
      if (!items.length) return;
      const i = clamp(index, 0, items.length - 1);
      if (props.scroll === "parent") { rows.get(keyOf(items[i] as T, i))?.el.scrollIntoView?.({ block: align }); return; }
      dirty = true; layout();
      const n = (x: unknown): number => (typeof x === "number" && Number.isFinite(x) ? x : 0);
      const top = (tops[i] as number) + n(win.offsetTop), size = heights.get(keyOf(items[i] as T, i)) ?? estimate, now = n(sc.scrollTop);
      const view = sc.clientHeight || (typeof innerHeight === "number" ? innerHeight : 800);
      const at = Math.max(0, align === "start" ? top : align === "center" ? top - (view - size) / 2 : top < now ? top : top + size > now + view ? top + size - view : now);
      if (at !== now) { sc.scrollTop = at; schedule(); }
    },
  });
  onCleanup(() => { cancel?.(); ro?.disconnect(); for (const r of rows.values()) r.dispose(); rows.clear(); });
  return root;
}
