// Scroll-driven motion: reveal when visible (IntersectionObserver), scroll progress signal, parallax.
// Actions for `use:`:  <section use:inView={{ once: true }} />   <img use:parallax={0.3} />   <h2 use:reveal />
import { signal, onCleanup } from "../core/reactive.js";
import { animate, type Frames } from "./animate.ts";
import { frame, setStyle, reducedMotion } from "./env.ts";

export interface InViewOptions { once?: boolean; threshold?: number; rootMargin?: string; enter?: (el: Element) => void; leave?: (el: Element) => void; className?: string }

/** Action: calls `enter` (and sets `className`, default "is-visible") when the element scrolls into view. */
export function inView(el: Element, raw?: unknown): () => void {
  const o: InViewOptions = raw && typeof raw === "object" ? (raw as InViewOptions) : {};
  const cls = o.className ?? "is-visible";
  const on = (): void => { el.classList.add(cls); o.enter?.(el); };
  const off = (): void => { el.classList.remove(cls); o.leave?.(el); };
  if (typeof globalThis.IntersectionObserver !== "function") { on(); return () => {}; }
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (e.isIntersecting) { on(); if (o.once !== false) io.disconnect(); }
      else if (o.once === false) off();
    }
  }, { threshold: o.threshold ?? 0.15, rootMargin: o.rootMargin ?? "0px 0px -10% 0px" });
  io.observe(el);
  return () => io.disconnect();
}

const REVEAL: Frames = [{ opacity: 0, transform: "translateY(24px)" }, { opacity: 1, transform: "none" }];
/** Action: fade/slide in once when visible. `use:reveal={{ delay: 100, frames }}` */
export function reveal(el: Element, raw?: unknown): () => void {
  const o = (raw && typeof raw === "object" ? raw : {}) as { delay?: number; duration?: number; frames?: Frames };
  if (!reducedMotion()) setStyle(el, { opacity: "0" });
  return inView(el, { once: true, enter: () => { setStyle(el, { opacity: null }); animate(el, o.frames ?? REVEAL, { duration: o.duration ?? 600, delay: o.delay ?? 0, easing: "easeOutExpo" }); } });
}

/**
 * Scroll progress 0..1 (signal) of the page, or of an element passing through the viewport.
 * Cleans up with the current owner.
 */
export function scrollProgress(target?: Element | (() => Element | null)): () => number {
  const p = signal(0) as unknown as { (): number; set(v: number): number };
  let pending = false;
  const measure = (): void => {
    pending = false;
    const el = typeof target === "function" ? target() : target;
    const vh = globalThis.innerHeight || 1;
    if (!el) {
      const doc = globalThis.document?.documentElement;
      const max = (doc?.scrollHeight ?? 0) - vh;
      p.set(max > 0 ? Math.min(1, Math.max(0, (globalThis.scrollY ?? 0) / max)) : 0);
      return;
    }
    const r = el.getBoundingClientRect();
    const total = r.height + vh;
    p.set(total > 0 ? Math.min(1, Math.max(0, (vh - r.top) / total)) : 0);
  };
  const on = (): void => { if (!pending) { pending = true; frame(measure); } };
  globalThis.addEventListener?.("scroll", on, { passive: true });
  globalThis.addEventListener?.("resize", on, { passive: true });
  measure();
  onCleanup(() => { globalThis.removeEventListener?.("scroll", on); globalThis.removeEventListener?.("resize", on); });
  return () => p();
}

/** Action: move the element at `speed` × scroll (negative = opposite). transform only. */
export function parallax(el: Element, raw?: unknown): () => void {
  const speed = typeof raw === "number" ? raw : 0.2;
  let pending = false;
  const update = (): void => {
    pending = false;
    if (reducedMotion()) { setStyle(el, { transform: null }); return; }
    const r = el.getBoundingClientRect();
    const center = r.top + r.height / 2 - (globalThis.innerHeight ?? 0) / 2;
    setStyle(el, { transform: `translate3d(0, ${(-center * speed).toFixed(1)}px, 0)` });
  };
  const on = (): void => { if (!pending) { pending = true; frame(update); } };
  globalThis.addEventListener?.("scroll", on, { passive: true });
  update();
  return () => globalThis.removeEventListener?.("scroll", on);
}
