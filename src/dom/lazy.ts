// Component-level code splitting: `const Chart = lazy(() => import("./SalesChart.tsx"), { placeholder: "chart", height: "16rem" })`.
// The component's place is reserved at its final size (no layout shift), a themed skeleton of its kind shows only if
// loading takes longer than 100 ms (a cached chunk appears without any flicker), a thin progress line after 300 ms; when
// it arrives it fades in and its children stagger in. `when` decides the moment: idle (default, after the first paint),
// visible (near the viewport), interaction (hover / focus / touch) or immediate. A failed load is tried again on its
// own (after 0.4 s, 1.2 s, 3.6 s) while the skeleton stays; if it still fails (often a chunk of an older build that a new
// deploy removed) the page reloads once (not again within 30 s), and only then does the part show a retry in place.
// Motion is transform / opacity only and honours prefers-reduced-motion.
import "./lazy.css";
import { signal, getOwner, runWithOwner, untrack, onCleanup } from "../core/reactive.ts";
import { h } from "./h.ts";
import { whenIdle, runLoad } from "./preload.ts";
import { t } from "../core/i18n.ts";
import { onVisible, listen } from "../core/util.ts";

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
  /** Named export to use instead of `default`: `lazy(() => import("march/charts"), { pick: "LineChart" })`. */
  pick?: string;
  /** Automatic retries after a failed load, with growing pauses (default 3; 0 shows the error at once). */
  retries?: number;
}


/** A skeleton of a given kind: one element, the shape (lines, rows, bars, fields) is drawn by CSS (lazy.css). */
export const skeleton = (kind: LazyPlaceholder = "block"): Element => h("div", { class: `m-lazy-skel m-lazy-skel-${kind}`, "aria-hidden": "true" });

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
      const tries = opts.retries ?? 3;
      const attempt = (n: number): Promise<Comp<P>> => runLoad(load, { kind: "part", key: "" }).then((m) => (comp = pick(m)),
        (e: unknown) => (n < tries ? new Promise((r) => setTimeout(r, 400 * 3 ** n)).then(() => attempt(n + 1)) : Promise.reject(e)));
      pending = attempt(0).catch((e: unknown) => {
        pending = null;
        // still failing: reload once to pick up a new build (a chunk of the old one is gone); never twice in 30 s
        try { const k = "m-lazy-reload"; if (tries && Date.now() - +(sessionStorage.getItem(k) ?? 0) > 3e4) { sessionStorage.setItem(k, `${Date.now()}`); location.reload(); return new Promise<Comp<P>>(() => {}); } } catch { /* no storage */ }
        throw e;
      });
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
    // built while hydrate() takes over a prerendered page (march/seo): its content is already on screen, no fade-in
    const still = !!globalThis.document?.documentElement.hasAttribute("data-m-hydrating");
    const slot = h("div", {
      class: () => `m-lazy-slot is-${state()}${opts.height || opts.aspect ? " m-lazy-sized" : ""}${still ? " m-lazy-still" : ""}`, "aria-busy": () => (state() === "wait" ? "true" : null),
    }, () => (state() === "ready" ? view() : state() === "error" ? h("div", { class: "m-lazy-error", role: "alert" },
      h("span", {}, () => t`Could not load this part.`), h("button", { type: "button", class: "m-btn m-btn-secondary m-btn-sm", onClick: () => { state.set("wait"); start(); } }, () => t`Try again`)) : fb)) as HTMLElement;
    if (opts.height) slot.style.setProperty("--m-lazy-h", opts.height);
    if (opts.aspect) slot.style.setProperty("--m-lazy-aspect", opts.aspect);
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
      if (when === "visible" && typeof IntersectionObserver === "function") onVisible(slot, start, { rootMargin: "300px" });
      else if (when === "interaction") {
        const go = (): void => { off(); start(); };
        const off = listen(slot, Object.fromEntries(EVENTS.map((ev) => [ev, go])), { passive: true });
      } else start();
    });
    return slot;
  }) as LazyComponent<P>;
  Object.defineProperty(C, "preload", { value: preload });
  Object.defineProperty(C, "loaded", { get: () => comp != null });
  return C;
}
const EVENTS = ["pointerenter", "focusin", "touchstart"] as const;
