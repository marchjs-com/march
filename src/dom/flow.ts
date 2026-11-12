// Control flow components: If/Else, For, Try (Switch/Match: dom/switch.ts, Await: dom/await.ts, Dynamic: dom/dynamic.ts,
// Portal: dom/portal.ts — each in its own module, so a page that uses one does not put the others into a shared chunk).
// Each returns a live region; only the active branch exists in the DOM and it is disposed (with its listeners) on switch.
import { computed, signal, createRoot, getOwner, untrack, onCleanup, catchError, effect, provide, isReactive, _cell, _setCell, type Accessor, type Cell, type Cleanup } from "../core/reactive.ts";
import { h, insert, removeNode, disposeDetached, LEAVE, LoadingContext } from "./h.ts";

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
interface Row<T> { nodes: Node[]; item: Cell<T>; index: Cell<number> | null; dispose: Cleanup; /** position in the previous order */ at: number }

/**
 * Keyed list. `<For each={items} key="id">{(item, index) => …}</For>`; `item` and `index` are accessors.
 * Rows are reused by key; when an item with the same key changes, only that row's bindings update.
 * Reordering moves the fewest rows (longest increasing subsequence); clearing the whole list, filling an empty one and
 * appending take fast paths. `animate` (with hadi-march/motion loaded): FLIP-animate moves, enter and leave.
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
  let order: Row<T>[] = [];
  let fallback: { d: Cleanup; nodes: Node[] } | null = null;
  const render: unknown = props.children;
  if (typeof render !== "function") throw new TypeError("March: <For> child must be a function (item, index) => …");
  const renderRow = render as ForProps<T>["children"];
  const wantsIndex = renderRow.length !== 1; // `(item) => …` never reads the index: no index signal per row

  const make = (it: T, i: number): Row<T> => {
    const item = _cell(it), index = wantsIndex ? _cell(i) : null;
    return createRoot((dispose): Row<T> => ({ item, index, dispose, at: i, nodes: collect(() => renderRow(item, index as Accessor<number>)) }), owner);
  };

  effect(() => {
    const list = (val(props.each) ?? []) as readonly T[];
    const host = end.parentNode as Node;
    untrack(() => {
      const n = list.length;
      if (!n) {
        if (order.length) {
          // the list owns its parent alone: drop every row at once
          if (host.firstChild === start && host.lastChild === end && host.nodeType === 1 && !props.animate && order.every(plain)) {
            disposeDetached(() => { for (const r of order) r.dispose(); });
            (host as Element).textContent = "";
            host.appendChild(start); host.appendChild(end);
          } else for (const r of order) dropRow(r);
        }
        rows = new Map(); order = [];
        if (props.fallback != null && !fallback) {
          const fb = createRoot((d) => ({ d, nodes: collect(() => call(props.fallback)) }), owner);
          fallback = fb;
          for (const x of fb.nodes) host.insertBefore(x, end);
        }
        return;
      }
      if (fallback) { fallback.d(); fallback.nodes.forEach(removeNode); fallback = null; }
      const next = new Map<unknown, Row<T>>();
      const nextOrder: Row<T>[] = new Array(n);
      if (!order.length) {
        // filling an empty list: every row into one fragment, inserted once
        const f = doc.createDocumentFragment();
        for (let i = 0; i < n; i++) {
          const it = list[i] as T;
          let k = keyOf(it);
          if (next.has(k)) { dupWarn(props.key, k); k = { dup: k, i }; }
          const row = make(it, i);
          next.set(k, row);
          nextOrder[i] = row;
          for (const x of row.nodes) f.appendChild(x);
        }
        rows = next; order = nextOrder;
        if (props.animate && flipHook) flipHook(nodesOf(order), () => { host.insertBefore(f, end); }, props.animate);
        else host.insertBefore(f, end);
        return;
      }
      // the old position of each row (-1: new)
      const was = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        const it = list[i] as T;
        let k = keyOf(it);
        if (next.has(k)) { dupWarn(props.key, k); k = { dup: k, i }; }
        let row = rows.get(k);
        if (row) {
          rows.delete(k);
          was[i] = row.at;
          if (row.item.n.value !== it) _setCell(row.item, it);
          if (row.index && row.index.n.value !== i) _setCell(row.index, i);
        } else {
          row = make(it, i);
          was[i] = -1;
        }
        row.at = i;
        next.set(k, row);
        nextOrder[i] = row;
      }
      for (const r of rows.values()) dropRow(r);
      rows = next; order = nextOrder;
      const place = (): void => {
        // rows on a longest increasing run of old positions stay; every other row moves (or is new)
        const keep = lis(was);
        let ref: Node = end, pending: DocumentFragment | null = null;
        for (let i = n - 1, j = keep.length - 1; i >= 0; i--) {
          const r = nextOrder[i] as Row<T>;
          if (j >= 0 && keep[j] === i) {
            j--;
            if (pending) { host.insertBefore(pending, ref); pending = null; }
            if (r.nodes.length) ref = r.nodes[0] as Node;
          } else {
            // moved or new: gathered (in order) and inserted before the next row that stays
            pending ??= doc.createDocumentFragment();
            for (let x = r.nodes.length - 1; x >= 0; x--) pending.insertBefore(r.nodes[x] as Node, pending.firstChild);
          }
        }
        if (pending) host.insertBefore(pending, ref);
      };
      if (props.animate && flipHook) flipHook(nodesOf(order), place, props.animate);
      else place();
    });
  });
  onCleanup(() => { for (const r of order) dropRow(r); fallback?.d(); });
  return frag;
}

const dupWarn = (key: unknown, k: unknown): void => { if (key != null) console.warn(`[march] <For> duplicate key "${String(k)}"`); };
const nodesOf = (order: { nodes: Node[] }[]): Element[] => order.flatMap((r) => r.nodes).filter((n): n is Element => n.nodeType === 1);
/** A row whose top nodes are plain elements (no leave transition): removing them removes everything the row drew. */
function plain(r: { nodes: Node[] }): boolean {
  for (const n of r.nodes) if (n.nodeType !== 1 || (n as unknown as { [LEAVE]?: unknown })[LEAVE]) return false;
  return true;
}
function dropRow(r: { dispose: Cleanup; nodes: Node[] }): void {
  if (plain(r)) disposeDetached(r.dispose); else r.dispose();
  for (const n of r.nodes) removeNode(n);
}

/** Indexes (ascending) of a longest strictly increasing subsequence of the non-negative values in `a` (−1 skipped). */
export function lis(a: ArrayLike<number>): number[] {
  const tails: number[] = [], prev = new Int32Array(a.length);
  for (let i = 0; i < a.length; i++) {
    const v = a[i] as number;
    if (v < 0) continue;
    let lo = 0, hi = tails.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if ((a[tails[m] as number] as number) < v) lo = m + 1; else hi = m; }
    prev[i] = lo ? (tails[lo - 1] as number) : -1;
    tails[lo] = i;
  }
  const out = new Array<number>(tails.length);
  for (let i = tails.length - 1, k = tails.length ? (tails[tails.length - 1] as number) : -1; i >= 0; i--) { out[i] = k; k = prev[k] as number; }
  return out;
}

/** Render a value into a detached fragment and return its top-level nodes. */
function collect(fn: () => unknown): Node[] {
  const v = fn();
  if (v && typeof v === "object" && (v as Node).nodeType === 1) return [v as Node]; // one element: no fragment
  const frag = globalThis.document.createDocumentFragment();
  insert(frag, v);
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
