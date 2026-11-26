// March — components: a component is called once with its props (live props are getters), inside an owner; an async
// component shows the loading content until its promise settles. h() (dom/h.ts) and the compiler's _c create them.
import { untrack, getOwner, runWithOwner, reportError, isReactive, onCleanup, signal, DEV, useContext, createRoot, type Signal } from "../core/reactive.ts";
import { doc } from "./insert.ts";

/** A component: called once with its props. May be async. */
export type Component<P = Record<string, unknown>> = (props: P) => unknown;
type Props = Record<string, unknown>;
interface ErrorWithComponent { marchComponent?: string }
const CHILDREN = Symbol("m.children");

/** Fragment: returns its children as an array. */
export const Fragment = (props: {
  /** The nodes rendered without a wrapper element. @tr Sarmalayıcı öğe olmadan çizilen düğümler. */
  children?: unknown;
}): unknown => props.children;

/** Mark a thunk as lazily evaluated children (compiler output for component children). */
export function lazyChildren<F extends () => unknown>(fn: F): F { (fn as unknown as Record<symbol, boolean>)[CHILDREN] = true; return fn; }

/** The extension pipeline (dom/extend.ts), installed only while something is registered: it may replace the props
 * and the function a component is created with (a wrapper that runs the interceptors around it). */
type ComponentHook = (Comp: Component<Props>, raw: Props) => [Component<Props>, Props];
let hook: ComponentHook | undefined;
/** Not for direct use: extend() / intercept() / withExtensions() install the pipeline with it. */
export const _componentHook = (fn: ComponentHook | undefined): void => { hook = fn; };

export function createComponent(Comp: Component<Props>, raw: Props, children: unknown[]): unknown {
  if (hook) [Comp, raw] = hook(Comp, raw);
  const props: Props = {};
  for (const key of Object.keys(raw)) {
    // a getter prop (`h(C, { get value() { … } })`) stays a getter: the component reads it live
    const d = Object.getOwnPropertyDescriptor(raw, key)!, v = d.value;
    if (d.get) { Object.defineProperty(props, key, d); continue; }
    if (key.startsWith("bind:")) {
      const name = key.slice(5);
      const s = v as Signal<unknown> | undefined;
      if (!s?.signal) throw new TypeError(`March: bind:${name} needs a signal ($variable).`);
      Object.defineProperty(props, name, { get: s, enumerable: true });
      props[`set${name.charAt(0).toUpperCase()}${name.slice(1)}`] = s.set;
    } else if (isReactive(v) && !(v as Partial<Signal<unknown>>).signal && key !== "children" && !/^on[A-Z:]/.test(key)) {
      Object.defineProperty(props, key, { get: v, enumerable: true }); // compiler thunk → live prop
    } else props[key] = v;
  }
  if (children.length) {
    const c = children.length === 1 ? children[0] : children;
    if (typeof c === "function" && (c as unknown as Record<symbol, boolean>)[CHILDREN]) {
      Object.defineProperty(props, "children", { get: () => { const r = (c as () => unknown)(); return Array.isArray(r) && r.length === 1 ? r[0] : r; }, enumerable: true });
    } else props["children"] = c;
  }
  const call = (): unknown => untrack(() => {
    try { return Comp(props); }
    catch (e) {
      if (DEV.enabled && e && typeof e === "object" && !(e as ErrorWithComponent).marchComponent) (e as ErrorWithComponent).marchComponent = Comp.name || "anonymous";
      throw e;
    }
  });
  // A component created outside any owner (e.g. inside an event handler or before render()) gets its own root, so
  // provide(), onCleanup() and queries work. Prefer creating UI inside render()/openDialog() so it is cleaned up.
  const out = getOwner() ? call() : createRoot(call);
  if (out && typeof (out as Promise<unknown>).then === "function") return asyncRegion(out as Promise<unknown>, Comp);
  return out;
}

// ------------------------------------------------------------------ async components
export const LoadingContext: { id: symbol; defaultValue: (() => unknown) | null } = { id: Symbol("m.loading"), defaultValue: null };
/** The spinner shown while an async component (or the first value of an async generator) is on its way. */
export function defaultLoading(): Element {
  const s = doc().createElement("span");
  s.className = "m-loading";
  s.setAttribute("role", "status");
  s.setAttribute("aria-live", "polite");
  s.setAttribute("aria-label", "Loading");
  return s;
}
type AsyncState = { status: "pending" } | { status: "done"; value: unknown };
function asyncRegion(promise: Promise<unknown>, Comp: Component<Props>): () => unknown {
  const owner = getOwner();
  const loading = useContext(LoadingContext);
  const state = signal<AsyncState>({ status: "pending" });
  let alive = true;
  onCleanup(() => { alive = false; });
  promise.then(
    (value) => { if (alive) state.set({ status: "done", value }); },
    (error: unknown) => {
      if (!alive) return;
      if (DEV.enabled && error && typeof error === "object") (error as ErrorWithComponent).marchComponent ??= Comp.name;
      runWithOwner(owner, () => reportError(error, owner));
    },
  );
  return () => {
    const s = state();
    if (s.status === "done") return s.value;
    return typeof loading === "function" ? loading() : defaultLoading();
  };
}

/** Compiler helper (not for direct use): create a component (`<Comp …>`), as h(Comp, props, …children) does. */
// generic like h(Comp, props): `march check` type-checks a component's props through this signature
export function _c<P extends object>(Comp: Component<P>, props: P | null, ...children: unknown[]): unknown { return createComponent(Comp as unknown as Component<Props>, (props ?? {}) as Props, children); }
