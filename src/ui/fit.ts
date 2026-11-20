// Fit a row of items into the width it has: which items stay visible and which go to a "more" menu / are hidden.
// Shared by OverflowToolbar, StatusBar and Breadcrumbs (one measuring rule, no copies).
//   const shown = fitItems(widths, priorities, available, moreWidth)   pure: true = visible
//   observeWidth(el, (w) => …)                                          ResizeObserver, removed with the owner
//   const fit = overflowFit({ items, measure, priority, reserve })      the whole loop: measure once, refit on resize
import { signal, effect, untrack } from "../core/reactive.ts";
import { observeSize } from "./observe.ts";
import type { Handler } from "../core/util.ts";

/**
 * Which items fit in `available` px. Items drop lowest `priority` first (ties: the last one first); while any item is
 * dropped, `reserve` px are kept for the "more" button. Returns one boolean per item (true = visible).
 */
export function fitItems(widths: readonly number[], priorities: readonly number[], available: number, reserve = 0): boolean[] {
  const shown = widths.map(() => true);
  let total = widths.reduce((a, b) => a + b, 0);
  if (total <= available) return shown;
  const order = widths.map((_, i) => i).sort((a, b) => (priorities[a] ?? 0) - (priorities[b] ?? 0) || b - a);
  for (const i of order) {
    if (total + reserve <= available) break;
    shown[i] = false;
    total -= widths[i] ?? 0;
  }
  return shown;
}

/** Call `fn` with the element's content width now and whenever it changes. Returns stop (also run with the owner). */
export const observeWidth = (el: Element, fn: (width: number) => void): (() => void) => observeSize(el, (s) => fn(s.width));

export interface OverflowFitOptions {
  /** The items (tracked): a new list is measured again. */
  items: () => readonly unknown[];
  /** Width of every item in px, read while all of them are shown; null when the row is not there yet. */
  measure: () => number[] | null;
  /** Higher stays longer (default 0 for all). */
  priority?: (index: number, count: number) => number;
  /** Px kept for the "more" button while anything is hidden. */
  reserve?: () => number;
  /** The room in px from the observed element's width (default: the width itself). */
  room?: (width: number) => number;
  /** false: nothing is hidden (the row is clipped or wraps instead). */
  enabled?: () => boolean;
  /** Last word on the result before it is shown (e.g. drop a separator left at an edge). */
  adjust?: (next: boolean[]) => void;
  /** After the visible set changed. */
  onChange?: Handler<[next: boolean[], before: boolean[]]> | undefined;
}
export interface OverflowFit {
  /** One boolean per item (empty until measured: everything shown). */
  shown: () => boolean[];
  /** Is item `i` visible (live)? */
  isShown(i: number): boolean;
  /** Watch this element's width: the room the items have. */
  observe(el: Element): void;
}
/**
 * The "what fits stays, the rest goes to a More menu" loop of a row (OverflowToolbar, Breadcrumbs, StatusBar): measure
 * every item once while all are shown (at start and when the list changes), then fit them (`fitItems`) on every resize.
 * Call it in a component's setup; draw items with `hidden: () => !fit.isShown(i)`.
 */
export function overflowFit(o: OverflowFitOptions): OverflowFit {
  const shown = signal<boolean[]>([]);
  let widths: number[] = [], avail = 0;
  const refit = (): void => {
    const n = untrack(o.items).length;
    if (widths.length !== n || o.enabled?.() === false) return;
    const next = fitItems(widths, widths.map((_, i) => o.priority?.(i, n) ?? 0), avail, o.reserve?.() ?? 0);
    o.adjust?.(next);
    const before = untrack(shown);
    if (next.length === before.length && next.every((v, i) => v === before[i])) return;
    shown.set(next);
    o.onChange?.(next, before);
  };
  effect(() => { o.items(); untrack(() => { shown.set([]); queueMicrotask(() => { const w = o.measure(); if (w) { widths = w; refit(); } }); }); });
  return { shown, isShown: (i) => shown()[i] !== false, observe: (el) => { observeWidth(el, (w) => { avail = o.room ? o.room(w) : w; refit(); }); } };
}
