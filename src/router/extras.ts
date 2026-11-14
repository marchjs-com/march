// Router helpers apps call from a page or a part (not from the start-up shell): their own module, so the start-up chunk
// carries only the router itself (router.ts). Same import path: hadi-march/router.
import { effect, untrack, onCleanup, getOwner } from "../core/reactive.ts";
import { _router as I, query, setQuery, type Match, type RouteTarget } from "./router.ts";
import { preloadChunks, loaderKey, saveData } from "../dom/preload.ts";

/** One query parameter as a signal-like value: read `tab()`, write `tab.set("x")` (replaces history). */
export function queryParam(name: string, fallback = ""): (() => string) & { set(v: string | null): Promise<void> } {
  const fn = (() => { const v = query()[name]; return (Array.isArray(v) ? v[0] : v) ?? fallback; }) as (() => string) & { set(v: string | null): Promise<void> };
  fn.set = (v) => setQuery({ [name]: v });
  return fn;
}
/** Current match (reactive). */
export const route = (): Match | null => I.S.match();
/** True while a lazy page or guard is resolving. */
export const navigating = (): boolean => I.S.pending();
/** The current navigation's signal: aborted as soon as another navigation starts (pass it to fetches a page starts). */
export const navigationSignal = (): AbortSignal | undefined => I.S.ctl?.signal;

/**
 * Register a check that runs before leaving the page (links, navigate, back/forward, closing the tab).
 * Return false (or a promise of false) to stay. Removed automatically with the current owner.
 *   beforeLeave(() => !dirty() || confirm({ title: "Discard changes?" }))
 */
export function beforeLeave(fn: () => boolean | Promise<boolean>): () => void {
  I.leaveGuards.add(fn);
  const off = (): void => { I.leaveGuards.delete(fn); };
  if (getOwner()) onCleanup(off);
  return off;
}

/** What a named outlet shows (reactive): its target, or null. */
export const outletRoute = (name: string): RouteTarget | null => I.slot(name)()?.to ?? null;

/** Mark the outlet whose content changes, so a View Transition animates only that part (the shell stays put). */
export function transitionOutlet(): Element | null {
  return globalThis.document?.querySelector(`.m-outlet[data-depth="${I.depth()}"]`) ?? null;
}

/** Run `fn` whenever the route changes (cleanup with the owner). */
export function onRouteChange(fn: (m: Match | null) => void): void {
  let first = true;
  effect(() => { const m = I.S.match(); if (first) { first = false; return; } untrack(() => fn(m)); });
}

/**
 * Prefetch (lowest priority, <link rel="prefetch">) the routes linked from what is on screen now, at most `max`
 * routes; called when idle after the first page.
 */
export function prefetchLinks(max = 6): void {
  const d = globalThis.document, r = I.S.router;
  if (!d || !r || saveData()) return;
  const seen = new Set<string>();
  const vh = globalThis.innerHeight || 0, vw = globalThis.innerWidth || 0;
  for (const a of d.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (seen.size >= max) break;
    const b = a.getBoundingClientRect?.();
    if (b && vh && (b.bottom < 0 || b.top > vh || b.right < 0 || b.left > vw || (!b.width && !b.height))) continue;
    // the route a link points to: "#/x", or a path under the base ("../x"); another site's path matches no route
    const raw = a.getAttribute("href") ?? "";
    const to = raw[0] === "#" ? (raw[1] === "/" ? raw.slice(1) : null) : raw && I.stripBase(new URL(raw, globalThis.location.href).pathname, r.base);
    if (!to || seen.has(to)) continue;
    seen.add(to);
    const m = I.matchTo(r, to);
    if (m && !m.route.component && m.path !== I.S.path.peek()) for (const l of [m.route.load, ...(m.route.layouts ?? [])]) if (l) preloadChunks(loaderKey(l), true);
  }
}
