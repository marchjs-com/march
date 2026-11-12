// Component-level code splitting: `const Chart = lazy(() => import("./SalesChart.tsx"))` → a component that shows a
// skeleton, downloads its chunk (all of its files at once, see preload.ts) the first time it renders, then renders the
// real component in place. Later uses render synchronously from the cache. `Chart.preload()` warms it up (hover, idle).
import { signal, getOwner, runWithOwner, untrack, onCleanup, reportError } from "../core/reactive.ts";
import { h } from "./h.ts";
import { preloadChunks, loaderKey } from "./preload.ts";

type Comp<P> = (props: P) => unknown;
type Loaded<P> = Comp<P> | { default: Comp<P> } | Record<string, unknown>;

export interface LazyOptions<P> {
  /** Shown while loading (default: a skeleton block with role="status"). */
  fallback?: (props: P) => unknown;
  /** Named export to use instead of `default`: `lazy(() => import("hadi-march/charts"), { pick: "LineChart" })`. */
  pick?: string;
}

export type LazyComponent<P> = Comp<P> & { preload(): Promise<Comp<P>>; readonly loaded: boolean };

/** A skeleton placeholder (styles: `.hm-lazy` in tokens.css). */
export const skeleton = (): Element => h("div", { class: "hm-lazy hm-skeleton", role: "status", "aria-busy": "true", "aria-label": "…" });

/**
 * `const Map = lazy(() => import("./Map.tsx"))` then `<Map lat={…} />`. The chunk is fetched on first render (or on
 * `Map.preload()`), with a skeleton meanwhile; errors go to the nearest error boundary.
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
      preloadChunks(loaderKey(load));
      pending = load().then((m) => (comp = pick(m)), (e: unknown) => { pending = null; throw e; });
    }
    return pending;
  };
  const C = ((props: P): unknown => {
    if (comp) { const c = comp; return untrack(() => c(props)); }
    const owner = getOwner();
    const view = signal<unknown>(undefined);
    const ready = signal(false);
    let alive = true;
    onCleanup(() => { alive = false; });
    preload().then(
      (c) => { if (alive) runWithOwner(owner, () => { view.set(untrack(() => c(props))); ready.set(true); }); },
      (e: unknown) => { if (alive) runWithOwner(owner, () => reportError(e, owner)); },
    );
    const fb = opts.fallback ? untrack(() => (opts.fallback as (p: P) => unknown)(props)) : skeleton();
    return () => (ready() ? view() : fb);
  }) as LazyComponent<P>;
  Object.defineProperty(C, "preload", { value: preload });
  Object.defineProperty(C, "loaded", { get: () => comp != null });
  return C;
}
