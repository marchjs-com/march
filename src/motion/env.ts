// Motion environment: reduced-motion preference (live), frame scheduling, element style helpers (CSSOM only — CSP safe).
import { signal } from "../core/reactive.js";

type Accessor<T> = (() => T) & { peek(): T };

const mq = typeof globalThis.matchMedia === "function" ? globalThis.matchMedia("(prefers-reduced-motion: reduce)") : null;
const reduced = signal<boolean>(mq?.matches ?? false) as Accessor<boolean> & { set(v: boolean): boolean };
mq?.addEventListener?.("change", (e: MediaQueryListEvent) => reduced.set(e.matches));

/** True when the user asked for reduced motion (live). Animations shorten to a near-instant fade or skip. */
export const reducedMotion = (): boolean => reduced();
/** Force reduced motion on/off (tests, user setting). */
export function setReducedMotion(on: boolean): void { reduced.set(on); }

export const now = (): number => (globalThis.performance?.now?.() ?? Date.now());

/** requestAnimationFrame with a timer fallback (node tests). Returns a cancel function. */
export function frame(fn: (t: number) => void): () => void {
  if (typeof globalThis.requestAnimationFrame === "function") {
    const id = globalThis.requestAnimationFrame(fn);
    return () => globalThis.cancelAnimationFrame?.(id);
  }
  const id = setTimeout(() => fn(now()), 16);
  return () => clearTimeout(id);
}

/** Set CSS properties through CSSOM (never the style attribute string). */
export function setStyle(el: Element, props: Record<string, string | number | null>): void {
  const s = (el as HTMLElement).style;
  if (!s) return;
  for (const [k, v] of Object.entries(props)) {
    const name = k.startsWith("--") ? k : k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
    if (v == null || v === "") s.removeProperty(name);
    else s.setProperty(name, typeof v === "number" && !/opacity|scale|z-index/.test(name) ? `${v}px` : String(v));
  }
}

/** Milliseconds from a CSS duration token (e.g. "--hm-dur-2") or a number. */
export function ms(v: number | string | undefined, fallback: number): number {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = parseFloat(v);
    if (Number.isFinite(n)) return v.trim().endsWith("ms") || !v.trim().endsWith("s") ? n : n * 1000;
  }
  return fallback;
}
