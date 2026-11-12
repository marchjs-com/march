// Fit a row of items into the width it has: which items stay visible and which go to a "more" menu / are hidden.
// Shared by OverflowToolbar, StatusBar and Breadcrumbs (one measuring rule, no copies).
//   const shown = fitItems(widths, priorities, available, moreWidth)   pure: true = visible
//   observeWidth(el, (w) => …)                                          ResizeObserver, removed with the owner
import { getOwner, onCleanup } from "../core/reactive.ts";

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
export function observeWidth(el: Element, fn: (width: number) => void): () => void {
  if (typeof ResizeObserver !== "function") { fn((el as HTMLElement).clientWidth ?? 0); return () => {}; }
  const ro = new ResizeObserver((entries) => { for (const e of entries) fn(e.contentRect.width); });
  ro.observe(el);
  const stop = (): void => ro.disconnect();
  if (getOwner()) onCleanup(stop);
  return stop;
}
