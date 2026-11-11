// HADI March router: History API (or hash) routing with lazy pages, guards, live `params`/`query` signals and scroll
// restoration. File based routing: `march` CLI turns `pages/users/[id].jsx` into `{ "/users/:id": () => import(…) }`.
//
//   const router = createRouter({ routes: { "/": () => import("./pages/index.jsx"), "/users/:id": UserPage } })
//   render(() => <Router />, app)
//   navigate("/users/42")   params().id === "42"   query().tab   setQuery({ tab: "x" })
//
// A page module may export: `default` (component), `guard(to)`, `title`, `meta`. Guards return true, false, a redirect
// path, or a promise of those.
import { signal, computed, untrack, onCleanup, batch, effect, read } from "../core/reactive.js";
import { h } from "../dom/h.js";
import { Try } from "../dom/flow.js";

const S = {
  router: null,
  path: signal("/", { name: "router.path" }),
  search: signal("", { name: "router.search" }),
  hash: signal(""),
  match: signal(null, { name: "router.match" }),
  pending: signal(false),
};

/** Current path (reactive). */
export const path = () => S.path();
/** Route params of the current match (reactive). */
export const params = () => S.match()?.params ?? {};
/** Query string as an object (reactive). Repeated keys become arrays. */
export const query = computed(() => {
  const out = {};
  for (const [k, v] of new URLSearchParams(S.search())) out[k] = k in out ? [].concat(out[k], v) : v;
  return out;
});
/** Current match: { route, params, path, meta } (reactive). */
export const route = () => S.match();
/** True while a lazy page or guard is resolving. */
export const navigating = () => S.pending();

/** Compile "/users/:id/*rest" to a matcher. */
export function compilePath(pattern) {
  const keys = [];
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

export function matchRoute(routes, p) {
  for (const r of routes) {
    const m = r.re.exec(p);
    if (!m) continue;
    const params = {};
    r.keys.forEach((k, i) => { if (m[i + 1] !== undefined) params[k] = decodeURIComponent(m[i + 1]); });
    return { route: r, params, path: p };
  }
  return null;
}

/**
 * @param {{ routes: Record<string, any> | Array<{path: string, component?: any, load?: Function, meta?: any}>,
 *           mode?: "history"|"hash", base?: string, guard?: (to: any) => any, notFound?: any, scroll?: boolean,
 *           title?: (route: any) => string|null }} opts
 */
export function createRouter(opts) {
  // Object form: a function value is a LOADER (`() => import("./page.jsx")`); use { component: Page } for a direct component.
  const list = Array.isArray(opts.routes) ? opts.routes : Object.entries(opts.routes).map(([p, v]) => ({ path: p, ...(typeof v === "function" ? { load: v } : v) }));
  const routes = list.map((r) => ({ ...r, ...compilePath(r.path) })).sort((a, b) => b.score - a.score);
  const mode = opts.mode ?? "history";
  const base = (opts.base ?? "").replace(/\/$/, "");
  const r = { routes, mode, base, opts, cache: new Map(), seq: 0, view: signal(null) };
  S.router = r;
  const onPop = () => sync({ pop: true });
  globalThis.addEventListener?.("popstate", onPop);
  if (mode === "hash") globalThis.addEventListener?.("hashchange", onPop);
  r.dispose = () => { globalThis.removeEventListener?.("popstate", onPop); globalThis.removeEventListener?.("hashchange", onPop); };
  if (globalThis.history && "scrollRestoration" in globalThis.history && opts.scroll !== false) globalThis.history.scrollRestoration = "manual";
  sync({ initial: true });
  return { navigate, back, routes, dispose: r.dispose };
}

function currentLocation() {
  const l = globalThis.location;
  const r = S.router;
  if (!l) return { p: "/", search: "", hash: "" };
  if (r?.mode === "hash") {
    const raw = l.hash.slice(1) || "/";
    const u = new URL(raw, "http://x");
    return { p: u.pathname, search: u.search, hash: "" };
  }
  const p = r?.base && l.pathname.startsWith(r.base) ? l.pathname.slice(r.base.length) || "/" : l.pathname;
  return { p, search: l.search, hash: l.hash };
}

async function sync({ pop = false, initial = false } = {}) {
  const r = S.router;
  const { p, search, hash } = currentLocation();
  const m = matchRoute(r.routes, p);
  // Same page, only the query/hash changed: update the signals synchronously and keep the mounted page.
  const cur = S.match.peek();
  const view = r.view.peek();
  if (!initial && m && cur && view?.component && cur.route === m.route && JSON.stringify(cur.params) === JSON.stringify(m.params)) {
    batch(() => { S.path.set(p); S.search.set(search); S.hash.set(hash); });
    return;
  }
  const seq = ++r.seq;
  S.pending.set(true);
  try {
    let page = null, mod = null;
    if (m) {
      mod = await load(m.route);
      if (seq !== r.seq) return;
      const to = { path: p, params: m.params, query: Object.fromEntries(new URLSearchParams(search)), meta: { ...(m.route.meta ?? {}), ...(mod?.meta ?? {}) }, route: m.route };
      for (const g of [r.opts.guard, mod?.guard]) {
        if (typeof g !== "function") continue;
        const res = await g(to);
        if (seq !== r.seq) return;
        if (res === false) { if (!initial && !pop) return; page = { forbidden: true }; break; }
        if (typeof res === "string" && res !== p) { navigate(res, { replace: true }); return; }
      }
      page ??= { component: mod?.default ?? mod?.component ?? m.route.component, to };
      const title = r.opts.title?.(to) ?? mod?.title ?? m.route.title;
      if (title && globalThis.document) globalThis.document.title = typeof title === "function" ? title(to) : title;
    }
    batch(() => {
      S.path.set(p); S.search.set(search); S.hash.set(hash);
      S.match.set(m ? { route: m.route, params: m.params, path: p, meta: { ...(m.route.meta ?? {}), ...(mod?.meta ?? {}) } } : null);
      r.view.set(page ?? { notFound: true });
    });
    if (r.opts.scroll !== false) restoreScroll(pop);
  } catch (e) {
    if (seq === r.seq) r.view.set({ error: e });
  } finally {
    if (seq === r.seq) S.pending.set(false);
  }
}

async function load(rt) {
  if (rt.component) return { default: rt.component };
  if (!rt.load) return null;
  const r = S.router;
  if (!r.cache.has(rt.pattern)) r.cache.set(rt.pattern, Promise.resolve(rt.load()).then((m) => (typeof m === "function" ? { default: m } : m)).catch((e) => { r.cache.delete(rt.pattern); throw e; }));
  return r.cache.get(rt.pattern);
}

const SCROLL_KEY = "hm.scroll";
function scrollStore() { try { return JSON.parse(globalThis.sessionStorage?.getItem(SCROLL_KEY) ?? "{}"); } catch { return {}; } }
function saveScroll() {
  try {
    const k = globalThis.history?.state?.hmKey;
    if (!k) return;
    const s = scrollStore();
    s[k] = [globalThis.scrollX ?? 0, globalThis.scrollY ?? 0];
    globalThis.sessionStorage?.setItem(SCROLL_KEY, JSON.stringify(s));
  } catch { /* storage blocked */ }
}
function restoreScroll(pop) {
  const k = globalThis.history?.state?.hmKey;
  const pos = pop && k ? scrollStore()[k] : null;
  const go = () => globalThis.scrollTo?.(pos?.[0] ?? 0, pos?.[1] ?? 0);
  globalThis.requestAnimationFrame ? globalThis.requestAnimationFrame(go) : go();
}

/** Go to a path (same origin only). `{ replace, state, scroll }` */
export function navigate(to, { replace = false, state = null } = {}) {
  const r = S.router;
  if (!r) throw new Error("March: navigate() before createRouter().");
  const s = String(to);
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) || s.startsWith("//")) throw new Error("March: navigate() only accepts same-origin paths. Use location.assign for external URLs.");
  saveScroll();
  const url = r.mode === "hash" ? `#${s}` : `${r.base}${s}`;
  const st = { ...(state ?? {}), hmKey: Math.random().toString(36).slice(2) };
  replace ? globalThis.history.replaceState(st, "", url) : globalThis.history.pushState(st, "", url);
  return sync();
}
export const back = () => globalThis.history.back();

/** Merge values into the query string (null/undefined/"" removes a key). Replaces history by default. */
export function setQuery(values, { replace = true } = {}) {
  const sp = new URLSearchParams(untrack(() => S.search()));
  for (const [k, v] of Object.entries(values)) {
    sp.delete(k);
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) continue;
    for (const x of [].concat(v)) sp.append(k, String(x));
  }
  const qs = sp.toString();
  return navigate(`${untrack(() => S.path())}${qs ? `?${qs}` : ""}`, { replace });
}

/**
 * Renders the current page. Props: `loading`, `fallback(error)`, `notFound`, `forbidden`,
 * `wrap(page, to)` — render every page inside a common wrapper (layout, permission or sign-in gate based on `to.meta`).
 */
export function Router(props) {
  const r = S.router;
  if (!r) throw new Error("March: <Router/> needs createRouter() first.");
  return h(Try, { loading: props.loading, fallback: props.fallback }, () => {
    const v = r.view();
    if (!v) return props.loading ? read(props.loading) : null;
    if (v.error) throw v.error;
    if (v.notFound) return untrack(() => call(props.notFound ?? r.opts.notFound ?? (() => h("p", { class: "hm-empty" }, "Not found"))));
    if (v.forbidden) return untrack(() => call(props.forbidden ?? (() => h("p", { class: "hm-empty", role: "alert" }, "Not allowed"))));
    const C = v.component;
    if (!C) return null;
    const page = () => h(C, { params: v.to.params, query: v.to.query, meta: v.to.meta });
    return untrack(() => (props.wrap ? props.wrap(page, v.to) : page()));
  });
}
const call = (c) => (typeof c === "function" ? c() : c);

/** `<Link href="/users" exact activeClass="is-active">Users</Link>` — client-side navigation with aria-current. */
export function Link(props) {
  const href = () => read(props.href);
  const active = () => {
    const p = S.path(), to = String(href()).split("?")[0];
    return props.exact ? p === to : p === to || (to !== "/" && p.startsWith(`${to}/`));
  };
  const rest = { ...props };
  for (const k of ["href", "exact", "activeClass", "children", "replace"]) delete rest[k];
  return h("a", {
    ...rest,
    href: () => (S.router?.mode === "hash" ? `#${href()}` : `${S.router?.base ?? ""}${href()}`),
    "aria-current": () => (active() ? "page" : null),
    "class:active": active,
    onClick: (e) => {
      if (e.defaultPrevented || e.button > 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || props.target === "_blank") return;
      e.preventDefault();
      navigate(href(), { replace: !!props.replace });
    },
  }, () => props.children);
}

/** Run `fn` whenever the route changes (cleanup on owner dispose). */
export function onRouteChange(fn) {
  let first = true;
  effect(() => { const m = S.match(); if (first) { first = false; return; } untrack(() => fn(m)); });
}

/** Reset router state (tests). */
export function _resetRouter() { S.router?.dispose?.(); S.router = null; batch(() => { S.path.set("/"); S.search.set(""); S.match.set(null); }); }
void onCleanup;
