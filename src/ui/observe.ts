// Observers and scroll helpers shared by components; each one stops with the owner it was created under.
//   owned(stop)                         run `stop` when the current owner is disposed (no owner: nothing registered)
//   observeSize(el, (size) => …)        ResizeObserver
//   whenVisible(el, (visible) => …)     IntersectionObserver: run while on screen
//   stickToBottom(scroller, { … })      a log / chat that follows its last line until the reader scrolls up
//   scrollIntoArea(row, scroller)       bring the active row into its own scroll area (the page never scrolls)
import { getOwner, onCleanup } from "../core/reactive.ts";

/** Register a cleanup with the current owner when there is one; returns the same function (call it to stop earlier). */
export function owned<F extends () => void>(stop: F): F {
  if (getOwner()) onCleanup(stop);
  return stop;
}

/** The content box of an observed element, in px. */
export interface ObservedSize { width: number; height: number }
/**
 * Call `fn` with the element's content size now and whenever it changes (ResizeObserver; once, at once, where there is
 * none). Returns stop (also run with the owner).
 */
export function observeSize<E extends Element>(el: E, fn: (size: ObservedSize, el: E) => void): () => void {
  const RO = globalThis.ResizeObserver;
  if (typeof RO !== "function") {
    const x = el as unknown as HTMLElement;
    fn({ width: x.clientWidth ?? 0, height: x.clientHeight ?? 0 }, el);
    return () => {};
  }
  const ro = new RO((entries) => { for (const e of entries) fn({ width: e.contentRect.width, height: e.contentRect.height }, el); });
  ro.observe(el);
  return owned(() => ro.disconnect());
}

/**
 * Run something only while the element is on screen: `fn(true)` when it comes into view, `fn(false)` when it leaves
 * and when watching stops (owner disposed or the returned stop called). Without IntersectionObserver it counts as
 * visible. For "once, when it first appears" use onVisible (core/util).
 */
export function whenVisible(el: Element, fn: (visible: boolean) => void, opts?: IntersectionObserverInit): () => void {
  const IO = globalThis.IntersectionObserver;
  let seen = false, stopped = false;
  const set = (v: boolean): void => { if (v !== seen) { seen = v; fn(v); } };
  const io = typeof IO === "function" ? new IO((es) => { if (!stopped) set(es.some((e) => e.isIntersecting)); }, opts) : null;
  if (io) io.observe(el); else set(true);
  return owned(() => { if (stopped) return; stopped = true; io?.disconnect(); set(false); });
}

/** Options of stickToBottom(). */
export interface StickOptions {
  /** How near the end (px) still counts as "at the bottom". Default 8. */
  threshold?: number | undefined;
  /** An element whose growth keeps the end in view while pinned (the content box of a log). Default: nothing follows by itself. */
  follow?: Element | null | undefined;
  /** Called when the pinned state changes (the reader scrolled away / came back). */
  onChange?: ((pinned: boolean) => void) | undefined;
}
/** What stickToBottom() returns. */
export interface StickControls {
  /** True while the scroller is at its end (new content should follow). */
  pinned(): boolean;
  /** Scroll to the end and pin; `smooth` animates the scroll. */
  toBottom(smooth?: boolean): void;
  stop(): void;
}
/**
 * A scroll area that sticks to its end: it is pinned until the reader scrolls up and pinned again when they come
 * back down. Call `toBottom()` after adding content (or pass `follow` so growing content keeps the end in view).
 */
export function stickToBottom(scroller: HTMLElement, o: StickOptions = {}): StickControls {
  let pinned = true;
  const near = o.threshold ?? 8;
  const set = (v: boolean): void => { if (v !== pinned) { pinned = v; o.onChange?.(v); } };
  const jump = (smooth: boolean): void => {
    if (smooth && typeof scroller.scrollTo === "function") scroller.scrollTo({ top: scroller.scrollHeight, behavior: "smooth" });
    else scroller.scrollTop = scroller.scrollHeight;
  };
  const onScroll = (): void => set(scroller.scrollHeight - scroller.scrollTop - scroller.clientHeight < near);
  scroller.addEventListener("scroll", onScroll, { passive: true });
  const unfollow = o.follow && typeof globalThis.ResizeObserver === "function" ? observeSize(o.follow, () => { if (pinned) jump(false); }) : null;
  const stop = owned(() => { scroller.removeEventListener("scroll", onScroll); unfollow?.(); });
  return { pinned: () => pinned, toBottom: (smooth = false) => { set(true); jump(smooth); }, stop };
}

/**
 * Bring `el` into view inside its scroll area `scroller` (like scrollIntoView block "nearest", but only that area
 * scrolls: never the page nor a drawer around it). `margin` keeps px of room around it. Returns true when it scrolled.
 */
export function scrollIntoArea(el: Element | null | undefined, scroller: HTMLElement | null | undefined, o: { smooth?: boolean | undefined; margin?: number | undefined } = {}): boolean {
  if (!el || !scroller) return false;
  const r = el.getBoundingClientRect(), c = scroller.getBoundingClientRect(), m = o.margin ?? 0;
  if (!c.height) return false;
  const top = c.top + m, bottom = c.bottom - m;
  const d = r.top < top ? r.top - top : r.bottom > bottom ? Math.min(r.bottom - bottom, r.top - top) : 0;
  if (!d) return false;
  if (typeof scroller.scrollTo === "function") scroller.scrollTo({ top: scroller.scrollTop + d, behavior: o.smooth ? "smooth" : "auto" });
  else scroller.scrollTop += d;
  return true;
}
