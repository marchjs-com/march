// Control flow components: If/Else, For, Try (Switch/Match: dom/switch.ts, Await: dom/await.ts, Dynamic: dom/dynamic.ts,
// Portal: dom/portal.ts — each in its own module, so a page that uses one does not put the others into a shared chunk).
// Each returns a live region; only the active branch exists in the DOM and it is disposed (with its listeners) on switch.
import { computed, signal, createRoot, getOwner, untrack, onCleanup, catchError, effect, provide, isReactive, type Accessor, type Signal, type Cleanup } from "../core/reactive.ts";
import { h, insert, removeNode, LoadingContext } from "./h.ts";

/** A value, a signal or any function returning the value. */
export type MaybeFn<T> = T | (() => T);

// Call user render functions; keep reactive accessors (compiler thunks, signals) as live regions.
// Flow props (when, each, for) accept a value, a signal or any function returning the value.
export const val = <T>(v: MaybeFn<T>): T => (typeof v === "function" ? (v as () => T)() : v);
export const call = (c: unknown, ...a: unknown[]): unknown => (typeof c === "function" && !isReactive(c) ? (c as (...x: unknown[]) => unknown)(...a) : c);

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
/** Hook `<For animate>` uses to animate reordering (installFlip() sets the motion FLIP here). */
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
