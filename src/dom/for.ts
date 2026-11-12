// Keyed list <For> (its own module: a page that only needs If/Try does not pull it into its chunk).
import { getOwner, untrack, onCleanup, effect, runWithOwner, _cell, _setCell, _owner, _dispose, type Accessor, type Cell, type Owner } from "../core/reactive.ts";
import { insert, removeNode, disposeDetached, LEAVE } from "./h.ts";
import { val, call } from "./flow.ts";

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
interface Row<T> { nodes: Node[]; item: Cell<T>; index: Cell<number> | null; o: Owner; /** position in the previous order */ at: number }

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
  let fallback: { o: Owner; nodes: Node[] } | null = null;
  const render: unknown = props.children;
  if (typeof render !== "function") throw new TypeError("March: <For> needs a row function.");
  const renderRow = render as ForProps<T>["children"];
  const wantsIndex = renderRow.length !== 1; // `(item) => …` never reads the index: no index signal per row

  const make = (it: T, i: number): Row<T> => {
    const item = _cell(it), index = wantsIndex ? _cell(i) : null;
    const o = _owner(owner);
    return { item, index, o, at: i, nodes: runWithOwner(o, () => collect(() => renderRow(item, index as Accessor<number>))) };
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
            disposeDetached(() => { for (const r of order) _dispose(r.o); });
            (host as Element).textContent = "";
            host.appendChild(start); host.appendChild(end);
          } else for (const r of order) dropRow(r);
        }
        rows = new Map(); order = [];
        if (props.fallback != null && !fallback) {
          const o = _owner(owner);
          fallback = { o, nodes: runWithOwner(o, () => collect(() => call(props.fallback))) };
          for (const x of fallback.nodes) host.insertBefore(x, end);
        }
        return;
      }
      if (fallback) { dropRow(fallback); fallback = null; }
      const next = new Map<unknown, Row<T>>();
      const nextOrder: Row<T>[] = new Array(n);
      // the old position of each row (-1: new)
      const was = new Int32Array(n);
      for (let i = 0; i < n; i++) {
        const it = list[i] as T;
        let k = keyOf(it);
        if (next.has(k)) { if (pk != null) console.warn(`[march] <For> duplicate key "${String(k)}"`); k = { dup: k, i }; }
        let row = rows.get(k);
        if (row) {
          rows.delete(k);
          was[i] = row.at;
          _setCell(row.item, it);
          if (row.index) _setCell(row.index, i);
          row.at = i;
        } else {
          row = make(it, i);
          was[i] = -1;
        }
        next.set(k, row);
        nextOrder[i] = row;
      }
      for (const r of rows.values()) dropRow(r);
      rows = next; order = nextOrder;
      // rows on a longest increasing run of old positions stay; the others (moved or new) are gathered in order and
      // inserted, one fragment at a time, before the next row that stays. Filling an empty list is one insert.
      const place = (): void => {
        const keep = lis(was);
        let ref: Node = end, pending: DocumentFragment | null = null;
        for (let i = n - 1; i >= 0; i--) {
          const ns = (nextOrder[i] as Row<T>).nodes;
          if (keep[i]) {
            if (pending) { host.insertBefore(pending, ref); pending = null; }
            if (ns.length) ref = ns[0] as Node;
          } else {
            pending ??= doc.createDocumentFragment();
            for (let x = ns.length - 1; x >= 0; x--) pending.insertBefore(ns[x] as Node, pending.firstChild);
          }
        }
        if (pending) host.insertBefore(pending, ref);
      };
      if (props.animate && flipHook) flipHook(order.flatMap((r) => r.nodes).filter((x): x is Element => x.nodeType === 1), place, props.animate);
      else place();
    });
  });
  onCleanup(() => { for (const r of order) dropRow(r); if (fallback) dropRow(fallback); });
  return frag;
}

/** A row whose top nodes are plain elements (no leave transition): removing them removes everything the row drew. */
function plain(r: { nodes: Node[] }): boolean {
  for (const n of r.nodes) if (n.nodeType !== 1 || (n as unknown as { [LEAVE]?: unknown })[LEAVE]) return false;
  return true;
}
function dropRow(r: { o: Owner; nodes: Node[] }): void {
  if (plain(r)) disposeDetached(() => _dispose(r.o)); else _dispose(r.o);
  for (const n of r.nodes) removeNode(n);
}

/** Marks (1) the entries of a longest strictly increasing subsequence of the non-negative values in `a` (−1 skipped). */
export function lis(a: ArrayLike<number>): Uint8Array {
  const n = a.length, tails: number[] = [], prev = new Int32Array(n), out = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const v = a[i] as number;
    if (v < 0) continue;
    let lo = 0, hi = tails.length;
    while (lo < hi) { const m = (lo + hi) >> 1; if ((a[tails[m] as number] as number) < v) lo = m + 1; else hi = m; }
    prev[i] = lo ? (tails[lo - 1] as number) : -1;
    tails[lo] = i;
  }
  for (let k = tails.length ? (tails[tails.length - 1] as number) : -1; k >= 0; k = prev[k] as number) out[k] = 1;
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
