// Off-screen detection for animation targets: one shared IntersectionObserver. JS-driven targets that are not visible
// are not written (their time keeps running, so they are in the right place when they scroll back), endless native
// animations pause, canvas / WebGL targets skip drawing.
const seen = new WeakMap<Element, boolean>();
const subs = new WeakMap<Element, Set<(visible: boolean) => void>>();
const counts = new WeakMap<Element, number>();
let io: IntersectionObserver | null | undefined;

function observer(): IntersectionObserver | null {
  if (io !== undefined) return io;
  const IO = globalThis.IntersectionObserver;
  io = typeof IO === "function"
    ? new IO((entries) => {
      for (const e of entries) {
        if (seen.get(e.target) === e.isIntersecting) continue;
        seen.set(e.target, e.isIntersecting);
        const s = subs.get(e.target);
        if (s) for (const fn of [...s]) fn(e.isIntersecting);
      }
    }, { rootMargin: "64px" })
    : null;
  return io;
}

/** False only when the element is known to be off screen (unknown = visible). */
export const isVisible = (el: Element | null | undefined): boolean => !el || seen.get(el) !== false;

/** Watch an element's visibility while the returned function is not called. */
export function watchVisibility(el: Element, fn?: (visible: boolean) => void): () => void {
  const o = observer();
  if (!o) return () => {};
  const n = counts.get(el) ?? 0;
  counts.set(el, n + 1);
  if (!n) o.observe(el);
  let s = subs.get(el);
  if (fn) { if (!s) subs.set(el, (s = new Set())); s.add(fn); }
  return () => {
    if (fn) s?.delete(fn);
    const c = (counts.get(el) ?? 1) - 1;
    counts.set(el, c);
    if (c <= 0) { o.unobserve(el); seen.delete(el); }
  };
}
