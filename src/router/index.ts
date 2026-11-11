// HADI March router (TypeScript): History API (or hash) routing with lazy pages, nested layouts, guards, redirects,
// preloading, leave confirmation, title/meta, live `params`/`query` signals and scroll restoration.
// File based: `march gen routes` turns `pages/users/[id].jsx` (+ `_layout.jsx` files) into a route table and a
// `pages.d.ts` that registers the paths so `navigate()` / `<Link href>` reject unknown routes at compile time.
//
//   createRouter({ routes, redirects: { "/old": "/new" } });  render(() => <Router />, app)
//   navigate("/users/42")   params().id   query().tab   setQuery({ tab: "x" })   beforeLeave(() => !dirty() || confirm…)
import { provideLink } from "../dom/link.ts";
import { signal, computed, untrack, batch, effect, onCleanup, read, getOwner } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { Try } from "../dom/flow.ts";

// ------------------------------------------------------------------ types
type Component = (props: Record<string, unknown>) => unknown;
type Loader = () => Promise<unknown>;
export interface PageModule { default?: Component; component?: Component; guard?: Guard; title?: string | ((to: RouteTarget) => string); meta?: Record<string, unknown> }
export interface RouteTarget { path: string; params: Record<string, string>; query: Record<string, string>; meta: Record<string, unknown>; route: CompiledRoute }
export type GuardResult = boolean | string | void | undefined;
export type Guard = (to: RouteTarget) => GuardResult | Promise<GuardResult>;
export interface RouteDef { path: string; component?: Component; load?: Loader; layouts?: Loader[]; meta?: Record<string, unknown>; title?: string; preload?: boolean }
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

interface View { component?: Component; to?: RouteTarget; layouts?: Component[]; notFound?: boolean; forbidden?: boolean; error?: unknown }
interface RouterState { routes: CompiledRoute[]; mode: "history" | "hash"; base: string; opts: RouterOptions; cache: Map<string, Promise<PageModule | null>>; seq: number; view: Sig<View | null>; redirects: CompiledRoute[]; dispose: () => void }

const S = {
  router: null as RouterState | null,
  path: sig("/", "router.path"),
  search: sig("", "router.search"),
  hash: sig(""),
  match: sig<Match | null>(null, "router.match"),
  pending: sig(false),
};
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
  const list: RouteDef[] = Array.isArray(opts.routes) ? opts.routes : Object.entries(opts.routes).map(([p, v]) => (typeof v === "function" ? { path: p, load: v } : { ...v, path: p }));
  const routes = list.map(compile).sort((a, b) => b.score - a.score);
  const redirects = Object.entries(opts.redirects ?? {}).map(([from, to]) => compile({ path: from, meta: { to } }));
  const mode = opts.mode ?? "history";
  const base = (opts.base ?? "").replace(/\/$/, "");
  const r: RouterState = { routes, mode, base, opts, cache: new Map(), seq: 0, view: sig<View | null>(null), redirects, dispose: () => {} };
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
  const { p, search, hash } = currentLocation();
  // leave confirmation on back/forward: restore the URL when a guard says no
  if (pop && leaveGuards.size && !(await allowLeave())) { if (lastUrl) globalThis.history.pushState(globalThis.history.state, "", lastUrl); return; }
  const redirect = matchRoute(r.redirects, p);
  if (redirect) { const to = String(redirect.route.meta?.["to"] ?? "/"); await navigate(fillPath(to, redirect.params) as Href, { replace: true }); return; }
  const m = matchRoute(r.routes, p);
  const cur = S.match.peek();
  const view = r.view.peek();
  if (!initial && m && cur && view?.component && cur.route === m.route && JSON.stringify(cur.params) === JSON.stringify(m.params)) {
    batch(() => { S.path.set(p); S.search.set(search); S.hash.set(hash); });
    lastUrl = globalThis.location?.href ?? "";
    return;
  }
  const seq = ++r.seq;
  S.pending.set(true);
  try {
    let page: View | null = null, mod: PageModule | null = null;
    let meta: Record<string, unknown> = {};
    if (m) {
      mod = await loadRoute(m.route);
      const layouts = await Promise.all((m.route.layouts ?? []).map((l) => loadModule(l)));
      if (seq !== r.seq) return;
      meta = { ...(m.route.meta ?? {}), ...(mod?.meta ?? {}) };
      const to: RouteTarget = { path: p, params: m.params, query: Object.fromEntries(new URLSearchParams(search)), meta, route: m.route };
      for (const g of [r.opts.guard, ...layouts.map((l) => l?.guard), mod?.guard]) {
        if (typeof g !== "function") continue;
        const res = await g(to);
        if (seq !== r.seq) return;
        if (res === false) { if (!initial && !pop) { S.pending.set(false); return; } page = { forbidden: true }; break; }
        if (typeof res === "string" && res !== p) { await navigate(res as Href, { replace: true }); return; }
      }
      const comp = mod?.default ?? mod?.component ?? m.route.component;
      page ??= { ...(comp ? { component: comp } : {}), to, layouts: layouts.map((l) => l?.default).filter((c): c is Component => !!c) };
      const title = r.opts.title?.(to) ?? (typeof mod?.title === "function" ? mod.title(to) : mod?.title) ?? m.route.title;
      setMeta({ ...(title ? { title } : {}), ...(typeof meta["description"] === "string" ? { description: meta["description"] } : {}) });
    }
    const apply = (): void => batch(() => {
      S.path.set(p); S.search.set(search); S.hash.set(hash);
      S.match.set(m ? { route: m.route, params: m.params, path: p, meta } : null);
      r.view.set(page ?? { notFound: true });
    });
    if (navWrapper && !initial) await navWrapper(apply, { pop }); else apply();
    lastUrl = globalThis.location?.href ?? "";
    if (r.opts.scroll !== false) restoreScroll(pop);
  } catch (e) {
    if (seq === r.seq) r.view.set({ error: e });
  } finally {
    if (seq === r.seq) S.pending.set(false);
  }
}

const moduleCache = new Map<Loader, Promise<PageModule | null>>();
function loadModule(l: Loader): Promise<PageModule | null> {
  let p = moduleCache.get(l);
  if (!p) {
    p = Promise.resolve(l()).then((m) => (typeof m === "function" ? { default: m as Component } : (m as PageModule)));
    p.catch(() => moduleCache.delete(l));
    moduleCache.set(l, p);
  }
  return p;
}
function loadRoute(rt: CompiledRoute): Promise<PageModule | null> {
  if (rt.component) return Promise.resolve({ default: rt.component });
  return rt.load ? loadModule(rt.load) : Promise.resolve(null);
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
export async function navigate(to: Href, { replace = false, state = null, force = false }: { replace?: boolean; state?: Record<string, unknown> | null; force?: boolean } = {}): Promise<void> {
  const r = S.router;
  if (!r) throw new Error("March: navigate() before createRouter().");
  const s = String(to);
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith("//")) throw new Error("March: navigate() only accepts same-origin paths. Use location.assign for external URLs.");
  const samePage = s.split(/[?#]/)[0] === untrack(() => S.path());
  if (!force && !samePage && leaveGuards.size && !(await allowLeave())) return;
  saveScroll();
  const url = r.mode === "hash" ? `#${s}` : `${r.base}${s}`;
  const st = { ...(state ?? {}), hmKey: Math.random().toString(36).slice(2) };
  if (replace) globalThis.history.replaceState(st, "", url); else globalThis.history.pushState(st, "", url);
  return sync();
}
export const back = (): void => globalThis.history.back();

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

/**
 * Renders the current page inside its layouts. Props: `loading`, `fallback(error)`, `notFound`, `forbidden`,
 * `wrap(page, to)` — a common wrapper for every page (gates driven by `to.meta`).
 */
export function Router(props: { loading?: Renderable; fallback?: unknown; notFound?: Renderable; forbidden?: Renderable; wrap?: (page: () => unknown, to: RouteTarget) => unknown }): unknown {
  const r = S.router;
  if (!r) throw new Error("March: <Router/> needs createRouter() first.");
  return h(Try, { loading: props.loading, fallback: props.fallback }, () => {
    const v = r.view();
    if (!v) return props.loading ? read(props.loading) : null;
    if (v.error) throw v.error;
    if (v.notFound) return untrack(() => call(props.notFound ?? r.opts.notFound ?? (() => h("p", { class: "hm-empty" }, "Not found"))));
    if (v.forbidden) return untrack(() => call(props.forbidden ?? (() => h("p", { class: "hm-empty", role: "alert" }, "Not allowed"))));
    const C = v.component, to = v.to;
    if (!C || !to) return null;
    const page = (): unknown => {
      let node: unknown = h(C, { params: to.params, query: to.query, meta: to.meta });
      for (const L of [...(v.layouts ?? [])].reverse()) { const inner = node; node = h(L, { params: to.params, meta: to.meta, children: inner }); }
      return node;
    };
    return untrack(() => (props.wrap ? props.wrap(page, to) : page()));
  });
}

/** `<Link href="/users" exact preload="hover">Users</Link>` — client-side navigation, aria-current, preloading. */
export function Link(props: { href: Href | (() => Href); exact?: boolean; replace?: boolean; preload?: "hover" | "visible" | "none"; target?: string; children?: unknown; [k: string]: unknown }): unknown {
  const href = (): string => String(read(props.href));
  const active = (): boolean => {
    const p = S.path(), to = href().split("?")[0] ?? "";
    return props.exact ? p === to : p === to || (to !== "/" && p.startsWith(`${to}/`));
  };
  const rest: Record<string, unknown> = { ...props };
  for (const k of ["href", "exact", "activeClass", "children", "replace", "preload"]) delete rest[k];
  const mode = props.preload ?? "hover";
  const pre = (): void => { void preload(href()); };
  const a = h("a", {
    ...rest,
    href: () => (S.router?.mode === "hash" ? `#${href()}` : `${S.router?.base ?? ""}${href()}`),
    "aria-current": () => (active() ? "page" : null),
    "class:active": active,
    ...(mode === "hover" ? { onPointerenter: pre, onFocus: pre } : {}),
    onClick: (e: MouseEvent) => {
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || props.target === "_blank") return;
      e.preventDefault();
      void navigate(href() as Href, { replace: !!props.replace });
    },
  }, () => props.children) as Element;
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
  batch(() => { S.path.set("/"); S.search.set(""); S.match.set(null); });
}
