// Control flow components: If/Else, For, Switch/Match, Try, Await, Portal, Dynamic.
// Each returns a live region; only the active branch exists in the DOM and it is disposed (with its listeners) on switch.
import { computed, signal, createRoot, getOwner, runWithOwner, untrack, onCleanup, catchError, effect, read, provide, reportError, isReactive, type Accessor, type Signal, type Cleanup } from "../core/reactive.ts";
import { h, insert, clearBetween, removeNode, LoadingContext, type Component } from "./h.ts";

/** A value, a signal or any function returning the value. */
type MaybeFn<T> = T | (() => T);

// Call user render functions; keep reactive accessors (compiler thunks, signals) as live regions.
// Flow props (when, each, for) accept a value, a signal or any function returning the value.
const val = <T>(v: MaybeFn<T>): T => (typeof v === "function" ? (v as () => T)() : v);
const call = (c: unknown, ...a: unknown[]): unknown => (typeof c === "function" && !isReactive(c) ? (c as (...x: unknown[]) => unknown)(...a) : c);

export interface IfProps<T = unknown> {
  when: MaybeFn<T>;
  else?: unknown;
  fallback?: unknown;
  /** Content, or `(value) => content` receiving the truthy value. */
  children?: unknown;
}
/** `<If when={cond} else={…}>…<Else>…</Else></If>` — children may be `(value) => …` to receive the truthy value. */
export function If<T>(props: IfProps<T>): () => unknown {
  const cond = computed(() => val(props.when));
  const on = computed(() => !!cond());
  return () => (on() ? untrack(() => call(props.children, cond.peek())) : call(props.else ?? props.fallback));
}
/** Marker used by the compiler; at runtime `<Else>` outside `<If>` renders its children. */
export function Else(props: { children?: unknown }): unknown { return props.children; }

/** Installed by hadi-march/motion: (elements, mutate, opts) → void. Measures, runs `mutate`, animates the deltas. */
export type FlipHook = (elements: Element[], mutate: () => void, opts: unknown) => void;
let flipHook: FlipHook | null = null;
export function setFlipHook(fn: FlipHook | null): void { flipHook = fn; }

export interface ForProps<T> {
  /** Array (or signal / function returning one); null/undefined renders as empty. */
  each: unknown;
  /** Property name or key function; default: the item itself. */
  key?: string | ((x: T) => unknown);
  children: (item: Accessor<T>, index: Accessor<number>) => unknown;
  fallback?: unknown;
  /** FLIP-animate moves, enter and leave (needs hadi-march/motion). */
  animate?: unknown;
}
interface Row<T> { nodes: Node[]; item: Signal<T>; index: Signal<number>; dispose: Cleanup }

/**
 * Keyed list. `<For each={items} key="id">{(item, index) => …}</For>`; `item` and `index` are accessors.
 * Rows are reused by key; when an item with the same key changes, only that row's bindings update.
 * `animate` (with hadi-march/motion loaded): FLIP-animate moves, enter and leave.
 */
export function For<T>(props: ForProps<T>): DocumentFragment {
  const doc = globalThis.document;
  const start = doc.createComment("for"), end = doc.createComment("/for");
  const frag = doc.createDocumentFragment();
  frag.append(start, end);
  const owner = getOwner();
  const pk = props.key;
  const keyOf: (x: T) => unknown = typeof pk === "function" ? pk : typeof pk === "string" ? (x) => (x as Record<string, unknown> | null | undefined)?.[pk] : (x) => x;
  let rows = new Map<unknown, Row<T>>();
  let fallback: { d: Cleanup; nodes: Node[] } | null = null;
  const render: unknown = props.children;
  if (typeof render !== "function") throw new TypeError("March: <For> child must be a function (item, index) => …");
  const renderRow = render as ForProps<T>["children"];

  effect(() => {
    const list = (val(props.each) ?? []) as readonly T[];
    const host = end.parentNode as Node;
    untrack(() => {
      if (!list.length) {
        for (const r of rows.values()) dropRow(r);
        rows = new Map();
        if (props.fallback != null && !fallback) {
          const fb = createRoot((d) => ({ d, nodes: collect(() => call(props.fallback)) }), owner);
          fallback = fb;
          for (const n of fb.nodes) host.insertBefore(n, end);
        }
        return;
      }
      if (fallback) { fallback.d(); fallback.nodes.forEach(removeNode); fallback = null; }
      const next = new Map<unknown, Row<T>>();
      const order: Row<T>[] = [];
      for (let i = 0; i < list.length; i++) {
        const it = list[i] as T;
        let k = keyOf(it);
        if (next.has(k)) { if (props.key != null) console.warn(`[march] <For> duplicate key "${String(k)}"`); k = { dup: k, i }; }
        let row = rows.get(k);
        if (row) {
          rows.delete(k);
          if (row.item.peek() !== it) row.item.set(it);
          if (row.index.peek() !== i) row.index.set(i);
        } else {
          const item = signal(it), index = signal(i);
          row = createRoot((dispose): Row<T> => ({ item, index, dispose, nodes: collect(() => renderRow(item, index)) }), owner);
        }
        next.set(k, row);
        order.push(row);
      }
      for (const r of rows.values()) dropRow(r);
      rows = next;
      // place rows in order, moving only what is out of place
      const place = (): void => {
        let ref: Node = end;
        for (let i = order.length - 1; i >= 0; i--) {
          const r = order[i] as Row<T>;
          const last = r.nodes[r.nodes.length - 1];
          if (!last) continue;
          if (last.nextSibling !== ref || last.parentNode !== host) {
            for (const n of r.nodes) host.insertBefore(n, ref);
          }
          ref = r.nodes[0] as Node;
        }
      };
      if (props.animate && flipHook) flipHook(order.flatMap((r) => r.nodes).filter((n): n is Element => n.nodeType === 1), place, props.animate);
      else place();
    });
  });
  onCleanup(() => { for (const r of rows.values()) dropRow(r); fallback?.d(); });
  return frag;
}

function dropRow(r: { dispose: Cleanup; nodes: Node[] }): void { r.dispose(); for (const n of r.nodes) removeNode(n); }

/** Render a value into a detached fragment and return its top-level nodes. */
function collect(fn: () => unknown): Node[] {
  const frag = globalThis.document.createDocumentFragment();
  insert(frag, fn());
  return [...frag.childNodes];
}

/** Descriptor produced by `<Match>`. */
export interface MatchDescriptor { readonly __match: true; readonly when: unknown; readonly children: () => unknown }
export interface SwitchProps { fallback?: unknown; children?: unknown }
/** `<Switch fallback={…}><Match when={a}>…</Match>…</Switch>` — first truthy Match wins. */
export function Switch(props: SwitchProps): () => unknown {
  const matches = computed(() => {
    const kids = ([] as unknown[]).concat(props.children ?? []).flat();
    return kids.filter((m): m is MatchDescriptor => !!m && !!(m as Partial<MatchDescriptor>).__match);
  });
  const active = computed((): { i: number; v: unknown } | null => {
    const ms = matches();
    for (let i = 0; i < ms.length; i++) { const v = val((ms[i] as MatchDescriptor).when); if (v) return { i, v }; }
    return null;
  }, { equals: (a, b) => a?.i === b?.i });
  return () => {
    const a = active();
    if (!a) return call(props.fallback);
    const m = matches.peek()[a.i] as MatchDescriptor;
    return untrack(() => call(m.children, val(m.when)));
  };
}
export interface MatchProps<T = unknown> { when: MaybeFn<T>; children?: unknown }
/** Descriptor used by `<Switch>`; its children stay lazy. */
export function Match<T>(props: MatchProps<T>): MatchDescriptor {
  const d = { __match: true };
  Object.defineProperty(d, "when", { get: () => props.when });
  Object.defineProperty(d, "children", { get: () => () => props.children });
  return d as MatchDescriptor;
}

export interface TryProps {
  /** Rendered on error: content or `(error, reset) => content`. */
  fallback?: unknown;
  /** Rendered while async children are pending. */
  loading?: unknown;
  /** `false` disables console.error logging. */
  log?: boolean;
  children?: unknown;
}
/**
 * Error and async boundary. `fallback(error, reset)` renders on error; `loading` renders while async children are pending.
 * Also catches errors thrown by async components and by effects inside.
 */
export function Try(props: TryProps): () => unknown {
  const err = signal<unknown>(null);
  const reset = (): unknown => err.set(null);
  return () => {
    const e = err();
    if (e) return untrack(() => (typeof props.fallback === "function" ? (props.fallback as (e: unknown, reset: () => unknown) => unknown)(e, reset) : props.fallback ?? defaultError(e, reset)));
    return catchError(() => {
      if (props.loading !== undefined) provide(LoadingContext, () => call(props.loading));
      return props.children;
    }, (x) => { if (props.log !== false) console.error(x); err.set(x); });
  };
}
function defaultError(e: unknown, reset: () => unknown): Element {
  return h("div", { class: "hm-error", role: "alert" },
    h("p", {}, String((e as { message?: unknown } | null)?.message ?? e)),
    h("button", { type: "button", class: "hm-btn", onClick: reset }, "Retry"));
}

export interface AwaitProps<T> {
  for: MaybeFn<T | PromiseLike<T>>;
  loading?: unknown;
  catch?: unknown;
  /** Content, or `(value) => content`. */
  children?: unknown;
}
type AwaitState<T> = { s: "pending" } | { s: "ok"; v: T } | { s: "err"; e: unknown };
/** `<Await for={promise} loading={…} catch={(e) => …}>{(value) => …}</Await>` */
export function Await<T>(props: AwaitProps<T>): () => unknown {
  const state = signal<AwaitState<T>>({ s: "pending" });
  const owner = getOwner();
  effect(() => {
    const p = val(props.for);
    let alive = true;
    onCleanup(() => { alive = false; });
    state.set({ s: "pending" });
    Promise.resolve(p).then((v) => alive && state.set({ s: "ok", v }), (e: unknown) => alive && state.set({ s: "err", e }));
  });
  return () => {
    const st = state();
    if (st.s === "ok") return untrack(() => call(props.children, st.v));
    if (st.s === "err") {
      if (props.catch) return untrack(() => call(props.catch, st.e));
      runWithOwner(owner, () => reportError(st.e, owner));
      return null;
    }
    return call(props.loading ?? null);
  };
}

export interface PortalProps { mount?: Element | DocumentFragment; children?: unknown }
/** Render children into another element (default: document.body). */
export function Portal(props: PortalProps): null {
  const doc = globalThis.document;
  const target = props.mount ?? doc.body;
  const start = doc.createComment("portal"), end = doc.createComment("/portal");
  target.append(start, end);
  insert(target, () => props.children, end);
  onCleanup(() => { clearBetween(start, end); removeNode(start); removeNode(end); });
  return null;
}

export type DynamicProps = { component: MaybeFn<string | Component<never> | null | undefined | false> } & Record<string, unknown>;
/** Render a component chosen at runtime: `<Dynamic component={X} {...props} />`. */
export function Dynamic(props: DynamicProps): () => unknown {
  return () => {
    const C = read(props.component);
    if (!C) return null;
    const rest: Record<string, unknown> = { ...props };
    delete rest["component"];
    return untrack(() => (typeof C === "string" ? h(C, rest) : h(C as Component<Record<string, unknown>>, rest)));
  };
}
