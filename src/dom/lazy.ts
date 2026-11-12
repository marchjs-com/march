// Component-level code splitting: `const Chart = lazy(() => import("./SalesChart.tsx"), { placeholder: "chart", height: "16rem" })`.
// The component's place is reserved at its final size (no layout shift), a themed skeleton of its kind shows only if
// loading takes longer than 100 ms (a cached chunk appears without any flicker), a thin progress line after 300 ms; when
// it arrives it fades in and its children stagger in. `when` decides the moment: idle (default, after the first paint),
// visible (near the viewport), interaction (hover / focus / touch) or immediate. Errors show a retry in place.
// Motion is transform / opacity only and honours prefers-reduced-motion.
import "./lazy.css";
import { signal, getOwner, runWithOwner, untrack, onCleanup } from "../core/reactive.ts";
import { h } from "./h.ts";
import { whenIdle, runLoad } from "./preload.ts";
import { t } from "../core/i18n.ts";

type Comp<P> = (props: P) => unknown;
type Loaded<P> = Comp<P> | { default: Comp<P> } | Record<string, unknown>;
export type LazyWhen = "idle" | "visible" | "interaction" | "immediate";
export type LazyPlaceholder = "block" | "text" | "card" | "table" | "chart" | "form" | "none";

export interface LazyOptions<P> {
  /** When to load (default "immediate" — on first render; "idle" after the first paint; "visible" near the viewport). */
  when?: LazyWhen;
  /** Skeleton kind while loading (default "block"), or your own fallback. */
  placeholder?: LazyPlaceholder | ((props: P) => unknown);
  /** @deprecated use placeholder: a function. */
  fallback?: (props: P) => unknown;
  /** Reserved size so nothing moves when the component arrives: a CSS length, or an aspect ratio ("16 / 9"). */
  height?: string;
  aspect?: string;
  /** Named export to use instead of `default`: `lazy(() => import("hadi-march/charts"), { pick: "LineChart" })`. */
  pick?: string;
}

export type LazyComponent<P> = Comp<P> & { preload(): Promise<Comp<P>>; readonly loaded: boolean };

/** A skeleton of a given kind: one element, the shape (lines, rows, bars, fields) is drawn by CSS (lazy.css). */
export const skeleton = (kind: LazyPlaceholder = "block"): Element => h("div", { class: `hm-lazy-skel hm-lazy-skel-${kind}`, "aria-hidden": "true" });

/**
 * `const Map = lazy(() => import("./Map.tsx"), { when: "visible", placeholder: "card", height: "20rem" })` then `<Map … />`.
 * `Map.preload()` warms it up (hover, idle). Later renders are synchronous (no skeleton).
 */
export function lazy<P = Record<string, unknown>>(load: () => Promise<Loaded<P>>, opts: LazyOptions<P> = {}): LazyComponent<P> {
  let comp: Comp<P> | null = null;
  let pending: Promise<Comp<P>> | null = null;
  const pick = (m: Loaded<P>): Comp<P> => {
    const c = typeof m === "function" ? m : (m as Record<string, unknown>)[opts.pick ?? "default"];
    if (typeof c !== "function") throw new TypeError(`March lazy(): the module has no ${opts.pick ? `export "${opts.pick}"` : "default export"}`);
    return c as Comp<P>;
  };
  const preload = (): Promise<Comp<P>> => {
    if (comp) return Promise.resolve(comp);
    if (!pending) {
      pending = runLoad(load, { kind: "part", key: "" }).then((m) => (comp = pick(m)), (e: unknown) => { pending = null; throw e; });
    }
    return pending;
  };
  const C = ((props: P): unknown => {
    if (comp) { const c = comp; return untrack(() => c(props)); }
    const owner = getOwner();
    const state = signal<"wait" | "ready" | "error">("wait");
    const view = signal<unknown>(undefined);
    let alive = true;
    onCleanup(() => { alive = false; });
    const ph = opts.placeholder ?? (opts.fallback ? opts.fallback : "block");
    const fb = typeof ph === "function" ? untrack(() => (ph as (p: P) => unknown)(props)) : ph === "none" ? null : skeleton(ph);
    const slot = h("div", {
      class: () => `hm-lazy-slot is-${state()}${opts.height || opts.aspect ? " hm-lazy-sized" : ""}`, "aria-busy": () => (state() === "wait" ? "true" : null),
    }, () => (state() === "ready" ? view() : state() === "error" ? h("div", { class: "hm-lazy-error", role: "alert" },
      h("span", {}, () => t`Could not load this part.`), h("button", { type: "button", class: "hm-btn hm-btn-secondary hm-btn-sm", onClick: () => { state.set("wait"); start(); } }, () => t`Try again`)) : fb)) as HTMLElement;
    if (opts.height) slot.style.setProperty("--hm-lazy-h", opts.height);
    if (opts.aspect) slot.style.setProperty("--hm-lazy-aspect", opts.aspect);
    const start = (): void => {
      void preload().then(
        (c) => { if (alive) runWithOwner(owner, () => { view.set(untrack(() => c(props))); state.set("ready"); }); },
        // handled in place (message + retry), so it is not rethrown to an error boundary
        (e: unknown) => { if (!alive) return; slot.dataset["error"] = String((e as Error)?.message ?? e); state.set("error"); },
      );
    };
    const when = opts.when ?? "immediate";
    if (when === "immediate") start();
    else if (when === "idle") { const cancel = whenIdle(start, 1500); onCleanup(cancel); }
    else queueMicrotask(() => {
      if (!alive) return;
      if (when === "visible" && typeof IntersectionObserver === "function") {
        const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { io.disconnect(); start(); } }, { rootMargin: "300px" });
        io.observe(slot);
        onCleanup(() => io.disconnect());
      } else if (when === "interaction") {
        const go = (): void => { for (const ev of EVENTS) slot.removeEventListener(ev, go); start(); };
        for (const ev of EVENTS) slot.addEventListener(ev, go, { passive: true });
        onCleanup(() => { for (const ev of EVENTS) slot.removeEventListener(ev, go); });
      } else start();
    });
    return slot;
  }) as LazyComponent<P>;
  Object.defineProperty(C, "preload", { value: preload });
  Object.defineProperty(C, "loaded", { get: () => comp != null });
  return C;
}
const EVENTS = ["pointerenter", "focusin", "touchstart"] as const;
