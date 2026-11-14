// behaviors/hide-on-scroll — a bar (site header, app header, bottom bar) slides away while the page scrolls down and
// comes back on the way up. One rule for it, two ways to use it:
//   const hidden = scrollHider({ after: 120 });  hidden(y)                     // feed positions you already read
//   const stop = hideOnScroll({ onChange: (hidden) => header.toggleAttribute("data-hidden", hidden) })   // listens itself
// The module only decides "hidden or shown"; the host moves the bar (a class or an attribute and its own transition).
import { getOwner, onCleanup } from "../../core/reactive.ts";

/** When a bar hides. */
export interface ScrollHiderOptions {
  /** Scrolled distance (px) before the bar may hide (default 120): near the top it always shows. */
  after?: number | undefined;
  /** Smallest move (px) between two positions that counts (default 4): a jitter does not flip the bar. */
  tolerance?: number | undefined;
  /** Veto: return true to keep the bar shown (focus is inside it, a menu of it is open). */
  keep?: (() => boolean) | undefined;
}

/**
 * The rule itself, without any listener: returns a function that takes the current scroll position and gives
 * "hidden" (true while scrolling down past `after`, false on the way up). Call it from a scroll callback you already
 * have (the motion scroll core's `onScrollProgress`).
 */
export function scrollHider(o: ScrollHiderOptions = {}): (y: number) => boolean {
  const after = o.after ?? 120, tolerance = o.tolerance ?? 4;
  let last = 0, hidden = false;
  return (y) => {
    const moved = y - last;
    last = y;
    if (Math.abs(moved) > tolerance) hidden = moved > 0 && y > after && !o.keep?.();
    return hidden;
  };
}

/** Options of hideOnScroll(). */
export interface HideOnScrollOptions extends ScrollHiderOptions {
  /** Called when the bar should hide (true) or show (false); only on a change. */
  onChange: (hidden: boolean) => void;
  /** The scrolling element to follow. Default: whatever scrolls in the document (the page or a scroll box). */
  source?: Element | null | undefined;
}

/**
 * Follow the scrolling and report when a bar should hide or show. Returns stop (also run with the current owner);
 * stopping shows the bar again.
 * `hideOnScroll({ onChange: (hidden) => bar.classList.toggle("is-hidden", hidden), keep: () => bar.contains(document.activeElement) })`
 */
export function hideOnScroll(o: HideOnScrollOptions): () => void {
  const doc = globalThis.document;
  if (!doc) return () => {};
  const next = scrollHider(o);
  let hidden = false;
  const set = (v: boolean): void => { if (v !== hidden) { hidden = v; o.onChange(v); } };
  const onScroll = (e: Event): void => {
    const tg = e.target as Element | Document | null;
    set(next(tg && (tg as Element).nodeType === 1 ? (tg as Element).scrollTop : globalThis.scrollY ?? 0));
  };
  // one passive listener; in the capture phase on the document it hears every scroll box (scroll does not bubble)
  const target: EventTarget = o.source ?? doc;
  const opts = { capture: !o.source, passive: true };
  target.addEventListener("scroll", onScroll, opts);
  let stopped = false;
  const stop = (): void => { if (stopped) return; stopped = true; target.removeEventListener("scroll", onScroll, opts); set(false); };
  if (getOwner()) onCleanup(stop);
  return stop;
}
