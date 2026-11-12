// Named outlets and the modal outlet (a lazy part of the router: only apps that use <Outlet name="…"> download it).
//   <Outlet name="aside" />    routed by the URL: ?~aside=/users/7 against createRouter({ outlets: { aside: {…} } })
//   <Outlet name="modal" />    the page opened with navigate(to, { modal: true }) / <Link modal>, over the current one
import { computed, effect, untrack, createRoot } from "../core/reactive.ts";
import { h } from "../dom/h.ts";
import { Try } from "../dom/flow.ts";
import { _router as I, query, closeModal, openOutlet, type Slot, type RouteTarget, type CompiledRoute, type RouterState } from "./index.ts";

const noRoute = null as unknown as CompiledRoute;
const errorSlot = (e: unknown, to: string): Slot => ({ key: `error:${to}`, comp: () => I.routeError(e, () => undefined), to: { path: to, params: {}, query: {}, meta: {}, route: noRoute } });

/** Resolve a path against a route table: its page module, ready to render (null = nothing to show). */
async function resolve(table: CompiledRoute[], to: string): Promise<Slot | null> {
  if (!to) return null;
  const u = new URL(to, "http://x");
  const m = I.matchRoute(table, u.pathname);
  if (!m) return { key: `notfound:${to}`, comp: I.notFoundComp, to: { path: u.pathname, params: {}, query: {}, meta: {}, route: noRoute } };
  const mod = await I.loadRoute(m.route);
  const target: RouteTarget = { path: u.pathname, params: m.params, query: Object.fromEntries(u.searchParams), meta: { ...(m.route.meta ?? {}), ...(mod?.meta ?? {}) }, route: m.route };
  for (const g of [I.S.router?.opts.guard, mod?.guard]) if (typeof g === "function" && (await g(target)) === false) return { key: `forbidden:${to}`, comp: I.forbiddenComp, to: target };
  return { key: I.pageKey(m.route, m.params), comp: mod?.default ?? mod?.component ?? m.route.component ?? (() => null), to: target };
}

/** Wrap every named / modal outlet swap: `apply` puts the new page in; `from` / `to` are null when the outlet fills / empties. */
export type OutletWrapper = (name: string, apply: () => void, o: { to: RouteTarget | null; from: RouteTarget | null }) => void | Promise<void>;
let wrap: OutletWrapper | null = null;
/** Set by hadi-march/motion pageTransitions() (this module loads only where a named outlet is used). */
export function setOutletWrapper(fn: OutletWrapper | null): void { wrap = fn; }

/** Put a page into a slot, through the outlet transition when one is set. */
function swap(name: string, v: Slot | null): void {
  const sl = I.slot(name), to = v?.to ?? null, from = sl.peek()?.to ?? null;
  const apply = (): void => { sl.set(v); };
  if (!wrap || to?.path === from?.path) { apply(); return; }
  void Promise.resolve(wrap(name, apply, { to, from })).catch(apply);
}

/** Keep every slot in step with the URL (once per router). */
let installed: { r: RouterState; dispose: () => void } | null = null;
function install(): void {
  const r = I.S.router;
  if (!r || installed?.r === r) return;
  installed?.dispose();
  const follow = (name: string, table: CompiledRoute[], target: () => string): void => {
    let seq = 0;
    effect(() => {
      const to = target();
      const my = ++seq;
      untrack(() => { void resolve(table, to).then((v) => { if (my === seq) swap(name, v); }, (e: unknown) => { if (my === seq) I.slot(name).set(errorSlot(e, to)); }); });
    });
  };
  installed = { r, dispose: createRoot((dispose) => {
    follow("modal", r.routes, () => I.S.modalTo() ?? "");
    for (const [name, table] of r.outlets) follow(name, table, () => { const v = query()[`~${name}`]; return (Array.isArray(v) ? v[0] : v) ?? ""; });
    return dispose;
  }) };
}

export function NamedOutlet(props: { name: string; empty?: unknown; children?: unknown }): Element {
  install();
  const name = props.name;
  const cur = I.slot(name);
  const key = computed(() => cur()?.key ?? null);
  const close = (): void => { if (name === "modal") closeModal(); else void openOutlet(name, null); };
  return h("div", { class: "hm-outlet", "data-outlet": name }, () => {
    if (key() == null) return props.empty !== undefined ? untrack(() => (typeof props.empty === "function" ? (props.empty as () => unknown)() : props.empty)) : null;
    return untrack(() => {
      const sl = cur.peek();
      if (!sl) return null;
      // the page sits in its own box so a transition can move it (hm-outlet-page)
      const page = (): unknown => h("div", { class: "hm-outlet-page", "data-outlet-page": name }, () => h(Try, { fallback: (e: unknown) => I.routeError(e, close) }, () => h(sl.comp, { params: sl.to.params, query: sl.to.query, meta: sl.to.meta, close })));
      return typeof props.children === "function" ? (props.children as (page: () => unknown, close: () => void, to: RouteTarget) => unknown)(page, close, sl.to) : page();
    });
  }) as Element;
}
