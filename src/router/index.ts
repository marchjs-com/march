// HADI March router (TypeScript): History API (or hash) routing with lazy pages, nested layouts, guards, redirects,
// preloading, leave confirmation, title/meta, live `params`/`query` signals and scroll restoration.
// File based: `march gen routes` turns `pages/users/[id].jsx` (+ `_layout.jsx` files) into a route table and a
// `pages.d.ts` that registers the paths so `navigate()` / `<Link href>` reject unknown routes at compile time.
//
//   createRouter({ routes, redirects: { "/old": "/new" } });  render(() => <Router />, app)
//   navigate("/users/42")   params().id   query().tab   setQuery({ tab: "x" })   beforeLeave(() => !dirty() || confirm…)
//
// Outlets: layouts are mounted once and stay alive while the route changes below them; only the deepest level that
// differs is rebuilt (a layout renders <Outlet /> — or props.children — where the next level goes). Every level has its
// own error boundary (message + retry) and busy state, so the shell stays interactive while a page loads.
//   <Outlet name="aside" />          a named outlet, routed by the URL (?~aside=/users/7) — openOutlet("aside", "/users/7")
//   navigate("/photos/3", { modal: true }) / <Link modal>   the page opens over the current one (<Outlet name="modal">);
//                                    back closes it; a direct visit or a reload shows it as a full page
import { provideLink } from "../dom/link.ts";
import "./router.css";
import { signal, computed, untrack, batch, effect, onCleanup, read, getOwner, context, provide, useContext } from "../core/reactive.ts";
import { t } from "../core/i18n.ts";
import { h, lazyChildren } from "../dom/h.ts";
import { Try } from "../dom/flow.ts";
import { lazy } from "../dom/lazy.ts";
import { preloadChunks, loaderKey, saveData, whenIdle, loadDelay } from "../dom/preload.ts";

// ------------------------------------------------------------------ types
export type Component = (props: Record<string, unknown>) => unknown;
type Loader = () => Promise<unknown>;
export interface PageModule { default?: Component; component?: Component; guard?: Guard; title?: string | ((to: RouteTarget) => string); meta?: Record<string, unknown> }
export interface RouteTarget { path: string; params: Record<string, string>; query: Record<string, string>; meta: Record<string, unknown>; route: CompiledRoute }
export type GuardResult = boolean | string | void | undefined;
export type Guard = (to: RouteTarget) => GuardResult | Promise<GuardResult>;
export interface RouteDef { path: string; component?: Component; load?: Loader; layouts?: Loader[]; meta?: Record<string, unknown>; title?: string; preload?: boolean;
  /** Shown at once (after 100 ms) while this page loads; else the Router's `skeleton`, else its `loading`. */ skeleton?: unknown }
export type RouteTable = Record<string, Loader | Omit<RouteDef, "path">>;
export interface CompiledRoute extends RouteDef { pattern: string; keys: string[]; re: RegExp; score: number }
export interface Match { route: CompiledRoute; params: Record<string, string>; path: string; meta: Record<string, unknown> }
export interface RouterOptions {
  routes: RouteTable | RouteDef[];
  mode?: "history" | "hash";
  base?: string;
  guard?: Guard;
  redirects?: Record<string, string>;
  notFound?: unknown;
  scroll?: boolean;
  title?: (to: RouteTarget) => string | null | undefined;
  /**
   * Speculative downloads (default "idle"): once the first page is shown and the browser is idle, the chunks of the
   * routes linked from the page are fetched with <link rel="modulepreload"> (not executed). Off with "none", and
   * always off when the user saves data or is on a 2G-class connection.
   */
  prefetch?: "idle" | "none";
  /** Route tables of named outlets: `outlets: { aside: { "/users/:id": () => import("./user-card.tsx") } }`. */
  outlets?: Record<string, RouteTable | RouteDef[]>;
}

/** Augmented by the generated pages.d.ts: `declare module "hadi-march/router" { interface Register { routes: "/" | "/users/:id" } }`. */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface Register {}
type Seg<S extends string> = S extends `:${string}?` ? string : S extends `:${string}` ? string : S extends `*${string}` ? string : S;
type ToHref<P extends string> = P extends `${infer A}/${infer B}` ? `${Seg<A>}/${ToHref<B>}` : Seg<P>;
type Routes = Register extends { routes: infer R extends string } ? R : string;
/** A same-origin path accepted by navigate()/Link: a registered route (params filled), optionally with ?query or #hash. */
export type Href = string extends Routes ? string : ToHref<Routes> | `${ToHref<Routes>}?${string}` | `${ToHref<Routes>}#${string}`;
/** Params of a registered route pattern. */
type ParamNames<P extends string> = P extends `${string}:${infer N}/${infer R}` ? Clean<N> | ParamNames<`/${R}`> : P extends `${string}:${infer N}` ? Clean<N> : P extends `${string}*${infer N}` ? N : never;
export type ParamsOf<P extends string> = { [K in ParamNames<P>]: string };
type Clean<N extends string> = N extends `${infer X}?` ? X : N;

interface Sig<T> { (): T; peek(): T; set(v: T): T }
const sig = <T>(v: T, name?: string): Sig<T> => signal(v, name ? { name } : undefined) as unknown as Sig<T>;

/** One level of the outlet tree: a layout or the page. The key decides whether it is kept (same key) or rebuilt. */
interface Level { key: string; comp: Component; to?: RouteTarget; page?: boolean }
interface View { to?: RouteTarget; levels: Level[]; error?: unknown }
/** What a named outlet (or the modal outlet) shows. */
export interface Slot { key: string; comp: Component; to: RouteTarget }
export interface RouterState { loading?: Renderable; skeleton?: Renderable; routes: CompiledRoute[]; mode: "history" | "hash"; base: string; opts: RouterOptions; cache: Map<string, Promise<PageModule | null>>; seq: number; view: Sig<View | null>; redirects: CompiledRoute[]; outlets: Map<string, CompiledRoute[]>; dispose: () => void }

const S = {
  router: null as RouterState | null,
  path: sig("/", "router.path"),
  search: sig("", "router.search"),
  hash: sig(""),
  match: sig<Match | null>(null, "router.match"),
  pending: sig(false),
  /** Depth of the outlet that is loading new content (-1: none). */
  pendingDepth: sig(-1),
  /** A navigation has been loading for 150 ms: the progress bar and the clicked link's spinner show. */
  slow: sig(false),
  /** Aborted when a newer navigation starts (navigationSignal()). */
  ctl: null as AbortController | null,
  /** Named outlets ("modal" included): name → what it shows. */
  slots: new Map<string, Sig<Slot | null>>(),
  /** The path the modal outlet shows (from history state), or null. */
  modalTo: sig<string | null>(null),
};
const slot = (name: string): Sig<Slot | null> => { let x = S.slots.get(name); if (!x) S.slots.set(name, (x = sig<Slot | null>(null))); return x; };
/** A stable id per layout loader / component (the level key of a layout). */
const ids = new WeakMap<object, string>();
let nextId = 0;
const idOf = (o: object): string => { let v = ids.get(o); if (!v) ids.set(o, (v = String(++nextId))); return v; };
const pageKey = (route: CompiledRoute, prm: Record<string, string>): string => `page:${route.pattern}:${JSON.stringify(prm)}`;
const NO_ROUTER = "March: call createRouter() first";
const leaveGuards = new Set<() => boolean | Promise<boolean>>();

let navWrapper: ((apply: () => void, o: { pop: boolean }) => void | Promise<void>) | null = null;
/** Wrap every page swap (hadi-march/motion uses it for View Transitions). */
export function setNavigationWrapper(fn: typeof navWrapper): void { navWrapper = fn; }

/** Current path (reactive). */
export const path = (): string => S.path();
/** Route params of the current match (reactive). */
export const params = (): Record<string, string> => S.match()?.params ?? {};
/** Query string as an object (reactive). Repeated keys become arrays. */
export const query = computed(() => {
  const out: Record<string, string | string[]> = {};
  for (const [k, v] of new URLSearchParams(S.search())) { const cur = out[k]; out[k] = cur === undefined ? v : ([] as string[]).concat(cur, v); }
  return out;
}) as unknown as () => Record<string, string | string[]>;
/** One query parameter as a signal-like value: read `tab()`, write `tab.set("x")` (replaces history). */
export function queryParam(name: string, fallback = ""): (() => string) & { set(v: string | null): Promise<void> } {
  const fn = (() => { const v = query()[name]; return (Array.isArray(v) ? v[0] : v) ?? fallback; }) as (() => string) & { set(v: string | null): Promise<void> };
  fn.set = (v) => setQuery({ [name]: v });
  return fn;
}
/** Current match (reactive). */
export const route = (): Match | null => S.match();
/** True while a lazy page or guard is resolving. */
export const navigating = (): boolean => S.pending();
/** The current navigation's signal: aborted as soon as another navigation starts (pass it to fetches a page starts). */
export const navigationSignal = (): AbortSignal | undefined => S.ctl?.signal;

/** Compile "/users/:id/*rest" to a matcher. */
export function compilePath(pattern: string): { pattern: string; keys: string[]; re: RegExp; score: number } {
  const keys: string[] = [];
  const src = pattern.replace(/\/+$/, "") || "/";
  const re = src === "/" ? "^/?$" : `^${src.split("/").map((seg) => {
    if (!seg) return "";
    if (seg.startsWith(":")) { const opt = seg.endsWith("?"); keys.push(seg.slice(1).replace(/\?$/, "")); return opt ? "(?:/([^/]+))?" : "/([^/]+)"; }
    if (seg.startsWith("*")) { keys.push(seg.slice(1) || "rest"); return "(?:/(.*))?"; }
    return `/${seg.replace(/[.+?^${}()|[\]\\]/g, "\\$&")}`;
  }).join("")}/?$`;
  const score = src.split("/").reduce((s, seg) => s + (seg.startsWith("*") ? 1 : seg.startsWith(":") ? 2 : seg ? 3 : 0), 0);
  return { pattern, keys, re: new RegExp(re), score };
}

export function matchRoute(routes: CompiledRoute[], p: string): { route: CompiledRoute; params: Record<string, string>; path: string } | null {
  for (const r of routes) {
    const m = r.re.exec(p);
    if (!m) continue;
    const params: Record<string, string> = {};
    r.keys.forEach((k, i) => { const v = m[i + 1]; if (v !== undefined) params[k] = decodeURIComponent(v); });
    return { route: r, params, path: p };
  }
  return null;
}
/** Fill ":param" placeholders: fillPath("/users/:id", { id: 7 }) → "/users/7". */
export function fillPath(pattern: string, values: Record<string, string | number>): string {
  return pattern.replace(/[:*](\w+)\??/g, (_m, k: string) => encodeURIComponent(String(values[k] ?? "")).replace(/%2F/g, "/")).replace(/\/+$/, "") || "/";
}

const compile = (r: RouteDef): CompiledRoute => ({ ...r, ...compilePath(r.path) });

export function createRouter(opts: RouterOptions): { navigate: typeof navigate; back: typeof back; routes: CompiledRoute[]; dispose: () => void } {
  // Object form: a function value is a LOADER (`() => import("./page.jsx")`); use { component } for a direct component.
  // one router per page: a second createRouter() (HMR, tests) replaces the first and drops its listeners
  S.router?.dispose();
  const list: RouteDef[] = Array.isArray(opts.routes) ? opts.routes : Object.entries(opts.routes).map(([p, v]) => (typeof v === "function" ? { path: p, load: v } : { ...v, path: p }));
  const routes = list.map(compile).sort((a, b) => b.score - a.score);
  const redirects = Object.entries(opts.redirects ?? {}).map(([from, to]) => compile({ path: from, meta: { to } }));
  const mode = opts.mode ?? "history";
  const base = (opts.base ?? "").replace(/\/$/, "");
  const outlets = new Map(Object.entries(opts.outlets ?? {}).map(([name, tbl]) => [name, (Array.isArray(tbl) ? tbl : Object.entries(tbl).map(([p, v]) => (typeof v === "function" ? { path: p, load: v } : { ...v, path: p }))).map(compile).sort((a, b) => b.score - a.score)]));
  const r: RouterState = { routes, mode, base, opts, cache: new Map(), seq: 0, view: sig<View | null>(null), redirects, outlets, dispose: () => {} };
  S.router = r;
  const onPop = (): void => { void sync({ pop: true }); };
  const onUnload = (e: BeforeUnloadEvent): void => { if ([...leaveGuards].some((g) => g() === false)) { e.preventDefault(); e.returnValue = ""; } };
  globalThis.addEventListener?.("popstate", onPop);
  globalThis.addEventListener?.("beforeunload", onUnload);
  if (mode === "hash") globalThis.addEventListener?.("hashchange", onPop);
  r.dispose = () => { globalThis.removeEventListener?.("popstate", onPop); globalThis.removeEventListener?.("hashchange", onPop); globalThis.removeEventListener?.("beforeunload", onUnload); };
  if (globalThis.history && "scrollRestoration" in globalThis.history && opts.scroll !== false) globalThis.history.scrollRestoration = "manual";
  void sync({ initial: true });
  return { navigate, back, routes, dispose: r.dispose };
}

function currentLocation(): { p: string; search: string; hash: string } {
  const l = globalThis.location;
  const r = S.router;
  if (!l) return { p: "/", search: "", hash: "" };
  if (r?.mode === "hash") {
    const u = new URL(l.hash.slice(1) || "/", "http://x");
    return { p: u.pathname, search: u.search, hash: "" };
  }
  const p = r?.base && l.pathname.startsWith(r.base) ? l.pathname.slice(r.base.length) || "/" : l.pathname;
  return { p, search: l.search, hash: l.hash };
}

let lastUrl = "";
async function sync({ pop = false, initial = false }: { pop?: boolean; initial?: boolean } = {}): Promise<void> {
  const r = S.router;
  if (!r) return;
  let { p, search, hash } = currentLocation();
  // modal route: the URL is the modal's, the page behind stays the one it was opened from (history state hmBg)
  const st = globalThis.history?.state as { hmModal?: boolean; hmBg?: string } | null;
  let modalTo: string | null = null;
  if (st?.hmModal && st.hmBg) {
    // a direct visit / reload of a modal URL shows the page in full (and forgets the modal state)
    if (initial) globalThis.history.replaceState({ ...st, hmModal: undefined, hmBg: undefined }, "");
    else { modalTo = `${p}${search}`; const u = new URL(st.hmBg, "http://x"); p = u.pathname; search = u.search; }
  }
  S.modalTo.set(modalTo);
  // leave confirmation on back/forward: restore the URL when a guard says no
  if (pop && leaveGuards.size && !(await allowLeave())) { if (lastUrl) globalThis.history.pushState(globalThis.history.state, "", lastUrl); return; }
  const redirect = matchRoute(r.redirects, p);
  if (redirect) { const to = String(redirect.route.meta?.["to"] ?? "/"); await navigate(fillPath(to, redirect.params) as Href, { replace: true }); return; }
  const m = matchRoute(r.routes, p);
  const cur = S.match.peek();
  const view = r.view.peek();
  if (!initial && m && cur && view?.levels.length && !view.error && cur.route === m.route && JSON.stringify(cur.params) === JSON.stringify(m.params)) {
    batch(() => { S.path.set(p); S.search.set(search); S.hash.set(hash); });
    lastUrl = globalThis.location?.href ?? "";
    return;
  }
  const seq = ++r.seq;
  S.ctl?.abort();
  S.ctl = new AbortController();
  const prev = [S.path.peek(), S.search.peek(), S.hash.peek()] as const;
  // the first level that will change: everything above it stays mounted (and interactive) while this one loads
  const nextKeys = m ? [...(m.route.layouts ?? []).map((l) => `layout:${idOf(l)}`), pageKey(m.route, m.params)] : ["notfound"];
  const curLevels = view?.levels ?? [];
  let depth = 0;
  while (depth < nextKeys.length && curLevels[depth]?.key === nextKeys[depth]) depth++;
  batch(() => {
    S.pending.set(true); S.pendingDepth.set(Math.min(depth, Math.max(curLevels.length - 1, 0)));
    // instant: the URL state (active links, breadcrumb) changes on the click; if the page is not here in 100 ms its
    // skeleton replaces the changing level (the layouts above stay); after 150 ms the progress bar shows
    if (view) { S.path.set(p); S.search.set(search); S.hash.set(hash); }
  });
  const later = (ms: number, fn: () => void): void => { setTimeout(() => { if (seq === r.seq && S.pending.peek()) fn(); }, ms); };
  if (view && m) {
    later(100, () => r.view.set({ ...view, levels: [...curLevels.slice(0, depth), { key: "loading", comp: () => read(m.route.skeleton ?? r.skeleton ?? r.loading), page: true }] }));
    later(150, () => S.slow.set(true));
  }
  try {
    let page: View | null = null, mod: PageModule | null = null;
    const layoutLevels = (mods: (PageModule | null)[], to: RouteTarget): Level[] => (m?.route.layouts ?? []).map((l, i) => ({ key: `layout:${idOf(l)}`, comp: mods[i]?.default ?? mods[i]?.component ?? passThrough, to }));
    let meta: Record<string, unknown> = {};
    if (m) {
      // page and layouts in parallel (each preloads all of its chunks at once: no import waterfall)
      const pageP = loadRoute(m.route);
      const layoutsP = Promise.all((m.route.layouts ?? []).map((l) => loadModule(l)));
      // first paint: the layouts (the app shell) show as soon as they are here, with a loading placeholder for the page
      if (!view && m.route.layouts?.length) void layoutsP.then((mods) => {
        if (seq !== r.seq || r.view.peek()) return;
        const to0: RouteTarget = { path: p, params: m.params, query: Object.fromEntries(new URLSearchParams(search)), meta: { ...(m.route.meta ?? {}) }, route: m.route };
        r.view.set({ to: to0, levels: [...layoutLevels(mods, to0), { key: "loading", comp: () => (r.loading !== undefined ? read(r.loading) : null), page: true }] });
      }, () => undefined);
      const [pageMod, layouts] = await Promise.all([pageP, layoutsP]);
      mod = pageMod ?? null;
      if (seq !== r.seq) return;
      meta = { ...(m.route.meta ?? {}), ...(mod?.meta ?? {}) };
      const to: RouteTarget = { path: p, params: m.params, query: Object.fromEntries(new URLSearchParams(search)), meta, route: m.route };
      for (const g of [r.opts.guard, ...layouts.map((l) => l?.guard), mod?.guard]) {
        if (typeof g !== "function") continue;
        const res = await g(to);
        if (seq !== r.seq) return;
        if (res === false) { if (!initial && !pop) { batch(() => { S.pending.set(false); S.pendingDepth.set(-1); S.path.set(prev[0]); S.search.set(prev[1]); S.hash.set(prev[2]); r.view.set(view); }); return; } page = { to, levels: [...layoutLevels(layouts, to), { key: "forbidden", comp: forbiddenComp, page: true, to }] }; break; }
        if (typeof res === "string" && res !== p) { await navigate(res as Href, { replace: true }); return; }
      }
      const comp = mod?.default ?? mod?.component ?? m.route.component;
      page ??= { to, levels: [...layoutLevels(layouts, to), { key: pageKey(m.route, m.params), comp: comp ?? (() => null), page: true, to }] };
      const title = r.opts.title?.(to) ?? (typeof mod?.title === "function" ? mod.title(to) : mod?.title) ?? m.route.title;
      setMeta({ ...(title ? { title } : {}), ...(typeof meta["description"] === "string" ? { description: meta["description"] } : {}) });
    }
    const apply = (): void => batch(() => {
      S.path.set(p); S.search.set(search); S.hash.set(hash);
      S.match.set(m ? { route: m.route, params: m.params, path: p, meta } : null);
      r.view.set(page ?? { levels: [{ key: "notfound", comp: notFoundComp, page: true }] });
      S.pendingDepth.set(-1);
    });
    vtDepth = depth;
    if (navWrapper && !initial) await navWrapper(apply, { pop }); else apply();
    lastUrl = globalThis.location?.href ?? "";
    if (r.opts.scroll !== false) restoreScroll(pop);
    if (initial && r.opts.prefetch !== "none") whenIdle(prefetchLinks, 3000);
  } catch (e) {
    // the error shows at the level that failed; the layouts above it stay
    if (seq === r.seq) batch(() => { r.view.set({ error: e, levels: [...curLevels.slice(0, depth), { key: `error:${seq}`, comp: () => routeError(e, () => { void sync({ initial: true }); }), page: true }] }); S.pendingDepth.set(-1); });
  } finally {
    if (seq === r.seq) batch(() => { S.pending.set(false); S.slow.set(false); });
  }
}

/** The depth whose content the last navigation replaced (page transitions name only that outlet). */
let vtDepth = 0;
const passThrough: Component = (p) => p["children"];
const notFoundComp: Component = () => untrack(() => call(S.router?.opts.notFound ?? (() => h("p", { class: "hm-empty" }, () => t`Not found`))));
const forbiddenComp: Component = () => h("p", { class: "hm-empty", role: "alert" }, () => t`Not allowed`);
export function routeError(e: unknown, retry: () => void): Element {
  return h("div", { class: "hm-error hm-route-error", role: "alert" },
    h("p", {}, () => t`This page could not be loaded.`), h("p", { class: "hm-muted" }, String((e as { message?: unknown } | null)?.message ?? e)),
    h("button", { type: "button", class: "hm-btn hm-btn-secondary hm-btn-sm", onClick: retry }, () => t`Try again`));
}

const moduleCache = new Map<Loader, Promise<PageModule | null>>();
function loadModule(l: Loader): Promise<PageModule | null> {
  let p = moduleCache.get(l);
  if (!p) {
    preloadChunks(loaderKey(l));
    const delay = loadDelay();
    p = (delay ? new Promise((r) => setTimeout(r, delay)).then(() => l()) : Promise.resolve(l())).then((m) => (typeof m === "function" ? { default: m as Component } : (m as PageModule)));
    p.catch(() => moduleCache.delete(l));
    moduleCache.set(l, p);
  }
  return p;
}
function loadRoute(rt: CompiledRoute): Promise<PageModule | null> {
  if (rt.component) return Promise.resolve({ default: rt.component });
  return rt.load ? loadModule(rt.load) : Promise.resolve(null);
}

/**
 * Fetch (but do not run) every chunk a route needs, via the build manifest: one round of <link rel="modulepreload">.
 * Without a manifest (dev server, tests) it falls back to preload(). Skipped when the user saves data.
 */
export function prefetch(to: string): void {
  const r = S.router;
  if (!r || saveData()) return;
  const m = matchRoute(r.routes, String(to).split(/[?#]/)[0] ?? "/");
  if (!m || m.route.component) return;
  const loaders = [m.route.load, ...(m.route.layouts ?? [])].filter((l): l is Loader => !!l);
  const known = loaders.map((l) => preloadChunks(loaderKey(l)));
  if (known.some((k) => !k)) void preload(to);
}

/**
 * Prefetch (lowest priority, <link rel="prefetch">) the routes linked from what is on screen now, at most `max`
 * routes; called when idle after the first page.
 */
export function prefetchLinks(max = 6): void {
  const d = globalThis.document, r = S.router;
  if (!d || !r || saveData()) return;
  const seen = new Set<string>();
  const vh = globalThis.innerHeight || 0, vw = globalThis.innerWidth || 0;
  for (const a of d.querySelectorAll<HTMLAnchorElement>("a[href]")) {
    if (seen.size >= max) break;
    const b = a.getBoundingClientRect?.();
    if (b && vh && (b.bottom < 0 || b.top > vh || b.right < 0 || b.left > vw || (!b.width && !b.height))) continue;
    const raw = a.getAttribute("href") ?? "";
    const to = r.mode === "hash" ? (raw.startsWith("#/") ? raw.slice(1) : null) : raw.startsWith("/") && !raw.startsWith("//") ? raw.slice(r.base.length) || "/" : null;
    if (!to || seen.has(to)) continue;
    seen.add(to);
    const m = matchRoute(r.routes, to.split(/[?#]/)[0] ?? "/");
    if (m && !m.route.component && m.path !== S.path.peek()) for (const l of [m.route.load, ...(m.route.layouts ?? [])]) if (l) preloadChunks(loaderKey(l), true);
  }
}

/** Load a route's page (and layouts) ahead of time, e.g. on hover. */
export function preload(to: string): Promise<void> {
  const r = S.router;
  if (!r) return Promise.resolve();
  const m = matchRoute(r.routes, String(to).split(/[?#]/)[0] ?? "/");
  if (!m) return Promise.resolve();
  return Promise.all([loadRoute(m.route), ...(m.route.layouts ?? []).map(loadModule)]).then(() => undefined, () => undefined);
}

// ------------------------------------------------------------------ title and meta
/** Set document.title and <meta name="description"> (DOM APIs only). */
export function setMeta({ title, description }: { title?: string; description?: string }): void {
  const doc = globalThis.document;
  if (!doc) return;
  if (title) doc.title = title;
  if (description != null) {
    let m = doc.head?.querySelector('meta[name="description"]');
    if (!m && doc.head) { m = doc.createElement("meta"); m.setAttribute("name", "description"); doc.head.appendChild(m); }
    m?.setAttribute("content", description);
  }
}

// ------------------------------------------------------------------ leave confirmation
/**
 * Register a check that runs before leaving the page (links, navigate, back/forward, closing the tab).
 * Return false (or a promise of false) to stay. Removed automatically with the current owner.
 *   beforeLeave(() => !dirty() || confirm({ title: "Discard changes?" }))
 */
export function beforeLeave(fn: () => boolean | Promise<boolean>): () => void {
  leaveGuards.add(fn);
  const off = (): void => { leaveGuards.delete(fn); };
  if (getOwner()) onCleanup(off);
  return off;
}
async function allowLeave(): Promise<boolean> {
  for (const g of [...leaveGuards]) if ((await g()) === false) return false;
  return true;
}

// ------------------------------------------------------------------ scroll
const SCROLL_KEY = "hm.scroll";
function scrollStore(): Record<string, [number, number]> { try { return JSON.parse(globalThis.sessionStorage?.getItem(SCROLL_KEY) ?? "{}") as Record<string, [number, number]>; } catch { return {}; } }
function saveScroll(): void {
  try {
    const k = (globalThis.history?.state as { hmKey?: string } | null)?.hmKey;
    if (!k) return;
    const s = scrollStore();
    s[k] = [globalThis.scrollX ?? 0, globalThis.scrollY ?? 0];
    globalThis.sessionStorage?.setItem(SCROLL_KEY, JSON.stringify(s));
  } catch { /* storage blocked */ }
}
function restoreScroll(pop: boolean): void {
  const k = (globalThis.history?.state as { hmKey?: string } | null)?.hmKey;
  const pos = pop && k ? scrollStore()[k] : undefined;
  const go = (): void => globalThis.scrollTo?.(pos?.[0] ?? 0, pos?.[1] ?? 0);
  if (globalThis.requestAnimationFrame) globalThis.requestAnimationFrame(go); else go();
}

// ------------------------------------------------------------------ navigation
/** Go to a path (same origin only). Leave guards may cancel. */
export async function navigate(to: Href, { replace = false, state = null, force = false, modal = false }: { replace?: boolean; state?: Record<string, unknown> | null; force?: boolean; modal?: boolean } = {}): Promise<void> {
  const r = S.router;
  if (!r) throw new Error(NO_ROUTER);
  const s = String(to);
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith("//")) throw new Error("March: navigate(): same-origin paths only");
  const samePage = s.split(/[?#]/)[0] === untrack(() => S.path());
  if (!force && !samePage && leaveGuards.size && !(await allowLeave())) return;
  saveScroll();
  const url = r.mode === "hash" ? `#${s}` : `${r.base}${s}`;
  // a modal keeps the page it was opened from (or that page's own background, when one modal opens another)
  const curState = globalThis.history?.state as { hmModal?: boolean; hmBg?: string } | null;
  const bg = curState?.hmModal && curState.hmBg ? curState.hmBg : `${untrack(() => S.path())}${untrack(() => S.search())}`;
  const st = { ...(state ?? {}), hmKey: Math.random().toString(36).slice(2), ...(modal ? { hmModal: true, hmBg: bg } : {}) };
  if (replace) globalThis.history.replaceState(st, "", url); else globalThis.history.pushState(st, "", url);
  return sync();
}
export const back = (): void => globalThis.history.back();

/** Close the modal route: back in history when the modal was pushed, else go to the page behind it. */
export function closeModal(): void {
  const st = globalThis.history?.state as { hmModal?: boolean; hmBg?: string } | null;
  if (st?.hmModal) globalThis.history.back(); else if (st?.hmBg) void navigate(st.hmBg as Href, { replace: true });
}
/** Show a path in a named outlet (it becomes part of the URL: ?~name=/path). null closes it. */
export function openOutlet(name: string, to: string | null, { replace = false }: { replace?: boolean } = {}): Promise<void> {
  return setQuery({ [`~${name}`]: to }, { replace });
}
/** What a named outlet shows (reactive): its target, or null. */
export const outletRoute = (name: string): RouteTarget | null => slot(name)()?.to ?? null;

/** Merge values into the query string (null/undefined/"" removes a key). Replaces history by default. */
export function setQuery(values: Record<string, unknown>, { replace = true }: { replace?: boolean } = {}): Promise<void> {
  const sp = new URLSearchParams(untrack(() => S.search()));
  for (const [k, v] of Object.entries(values)) {
    sp.delete(k);
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    for (const x of ([] as unknown[]).concat(v)) sp.append(k, String(x));
  }
  const qs = sp.toString();
  return navigate(`${untrack(() => S.path())}${qs ? `?${qs}` : ""}` as Href, { replace, force: true });
}

// ------------------------------------------------------------------ components
type Renderable = unknown;
const call = (c: unknown): unknown => (typeof c === "function" ? (c as () => unknown)() : c);

interface OutletCtx { depth: number; take?: (() => Element) | undefined; wrap?: ((page: () => unknown, to: RouteTarget) => unknown) | undefined; notFound?: Renderable | undefined; forbidden?: Renderable | undefined }
const OutletContext = context<OutletCtx | null>(null);

/** One level of the tree: rebuilt only when its key changes; its own error boundary and busy state. */
function level(r: RouterState, ctx: OutletCtx, loading?: Renderable): Element {
  const { depth } = ctx;
  const key = computed(() => r.view()?.levels[depth]?.key ?? null);
  return h("div", {
    class: "hm-outlet", "data-depth": String(depth), "aria-busy": () => (S.pendingDepth() === depth && S.pending() ? "true" : null),
  }, () => {
    const k = key();
    if (k == null) return depth === 0 && !r.view() && loading !== undefined ? read(loading) : null;
    return untrack(() => {
      const lv = r.view.peek()?.levels[depth];
      if (!lv) return null;
      return h(Try, { fallback: (e: unknown, reset: () => unknown) => routeError(e, () => { reset(); void sync({ initial: true }); }) }, () => {
        // the next level is created once, where the layout first asks for it (<Outlet /> or props.children)
        let next: Element | null = null;
        const take = (): Element => (next ??= level(r, { ...ctx, depth: depth + 1, take: undefined }));
        provide(OutletContext, { ...ctx, depth: depth + 1, take });
        const to = lv.to;
        const props: Record<string, unknown> = { params: to?.params ?? {}, query: to?.query ?? {}, meta: to?.meta ?? {} };
        if (lv.page) {
          const C = lv.key === "notfound" && ctx.notFound !== undefined ? (() => call(ctx.notFound)) as Component : lv.key === "forbidden" && ctx.forbidden !== undefined ? (() => call(ctx.forbidden)) as Component : lv.comp;
          const node = (): unknown => h(C, props);
          return ctx.wrap && to ? ctx.wrap(node, to) : node();
        }
        // a layout: props.children is the next level (same as <Outlet />), kept for layouts written before Outlet
        return h(lv.comp, props, lazyChildren(take));
      });
    });
  });
}

/**
 * Renders the outlet tree: the layouts of the current route (kept alive across navigations) and the page.
 * Props: `loading` (first load), `skeleton` (a page that is not here 100 ms after a click; a route's own `skeleton`
 * wins), `notFound`, `forbidden`, `wrap(page, to)` — a wrapper around every page.
 */
export function Router(props: { loading?: Renderable; skeleton?: Renderable; fallback?: unknown; notFound?: Renderable; forbidden?: Renderable; wrap?: (page: () => unknown, to: RouteTarget) => unknown }): unknown {
  const r = S.router;
  if (!r) throw new Error(NO_ROUTER);
  r.loading = props.loading;
  r.skeleton = props.skeleton;
  // the thin progress bar of a navigation slower than 150 ms (router.css)
  return [h("div", { class: "hm-nav-bar", "aria-hidden": "true", hidden: () => !S.slow() }),
    level(r, { depth: 0, wrap: props.wrap, notFound: props.notFound, forbidden: props.forbidden }, props.loading)];
}

/**
 * Where the next level goes inside a layout: `<Outlet />`. With a name it shows a named outlet (`outlets` option,
 * URL ?~name=/path) or the modal route (`name="modal"`); `children` can wrap it: `{(page, close) => <Dialog …>{page()}</Dialog>}`.
 * `empty` renders when a named outlet shows nothing.
 */
export function Outlet(props: { name?: string; empty?: Renderable; children?: unknown }): unknown {
  const r = S.router;
  if (!r) throw new Error(NO_ROUTER);
  if (!props.name) {
    const ctx = useContext(OutletContext);
    if (!ctx) throw new Error("March: <Outlet/> outside a layout");
    return ctx.take ? ctx.take() : level(r, ctx);
  }
  // named outlets and the modal outlet: their own (small, lazy) module, loaded where one is used
  return h(NamedOutlet, props);
}
const NamedOutlet = lazy(() => import("./outlets.ts"), { pick: "NamedOutlet", placeholder: "none" });

/** Internals for the outlets module (not public API). */
export const _router = { S, slot, matchRoute, loadRoute, pageKey, notFoundComp, forbiddenComp, routeError };

/** Mark the outlet whose content changes, so a View Transition animates only that part (the shell stays put). */
export function transitionOutlet(): Element | null {
  return globalThis.document?.querySelector(`.hm-outlet[data-depth="${vtDepth}"]`) ?? null;
}

/** `<Link href="/users" exact prefetch="hover">Users</Link>` — client-side navigation, aria-current, preloading. */
export function Link(props: { href: Href | (() => Href); exact?: boolean; replace?: boolean; modal?: boolean; outlet?: string; preload?: "hover" | "visible" | "idle" | "none"; prefetch?: "hover" | "visible" | "idle" | "none"; target?: string; children?: unknown; [k: string]: unknown }): unknown {
  const href = (): string => String(read(props.href));
  const active = (): boolean => {
    const p = S.path(), to = href().split("?")[0] ?? "";
    return props.exact ? p === to : p === to || (to !== "/" && p.startsWith(`${to}/`));
  };
  const rest: Record<string, unknown> = { ...props };
  for (const k of ["href", "exact", "activeClass", "children", "replace", "preload", "prefetch", "modal", "outlet"]) delete rest[k];
  // prefetch (download only, via the manifest) on hover/focus by default; "visible" when it scrolls into view; "idle"
  // when the browser is idle after it renders. All of them are skipped with Save-Data / 2G (prefetch() checks).
  const mode = props.prefetch ?? props.preload ?? "hover";
  const pre = (): void => prefetch(href());
  const a = h("a", {
    ...rest,
    href: () => (S.router?.mode === "hash" ? `#${href()}` : `${S.router?.base ?? ""}${href()}`),
    "aria-current": () => (active() ? "page" : null),
    // the link being opened shows a spinner while the navigation is slow (router.css)
    "aria-busy": () => (S.slow() && S.path() === href().split("?")[0] ? "true" : null),
    "class:active": active,
    ...(mode === "hover" ? { onPointerenter: pre, onFocus: pre } : {}),
    onClick: (e: MouseEvent) => {
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || props.target === "_blank") return;
      e.preventDefault();
      if (props.outlet) void openOutlet(props.outlet, href(), { replace: !!props.replace });
      else void navigate(href() as Href, { replace: !!props.replace, modal: !!props.modal });
    },
  }, () => props.children) as Element;
  if (mode === "idle") { const cancel = whenIdle(pre, 3000); if (getOwner()) onCleanup(cancel); }
  if (mode === "visible" && typeof globalThis.IntersectionObserver === "function") {
    const io = new IntersectionObserver((es) => { if (es.some((x) => x.isIntersecting)) { pre(); io.disconnect(); } });
    io.observe(a);
    if (getOwner()) onCleanup(() => io.disconnect());
  }
  return a;
}
provideLink(Link as (props: Record<string, unknown>) => unknown);

/** Run `fn` whenever the route changes (cleanup with the owner). */
export function onRouteChange(fn: (m: Match | null) => void): void {
  let first = true;
  effect(() => { const m = S.match(); if (first) { first = false; return; } untrack(() => fn(m)); });
}

/** Reset router state (tests). */
export function _resetRouter(): void {
  S.router?.dispose();
  S.router = null;
  leaveGuards.clear();
  moduleCache.clear();
  batch(() => { S.path.set("/"); S.search.set(""); S.match.set(null); S.slow.set(false); });
}
