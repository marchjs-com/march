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
interface Row<T> { nodes: Node[]; item: Cell<T>; index: Cell<number> | null; o: Owner; /** key */ k: unknown; /** position in the previous order */ at: number }

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
  let order: Row<T>[] = [];
  let fallback: { o: Owner; nodes: Node[] } | null = null;
  const render: unknown = props.children;
  if (typeof render !== "function") throw new TypeError("March: <For> needs a row function.");
  const renderRow = render as ForProps<T>["children"];
  const wantsIndex = renderRow.length !== 1; // `(item) => …` never reads the index: no index signal per row

  const make = (it: T, i: number, k: unknown): Row<T> => {
    const item = _cell(it), index = wantsIndex ? _cell(i) : null;
    const o = _owner(owner);
    return { item, index, o, k, at: i, nodes: runWithOwner(o, () => collect(() => renderRow(item, index as Accessor<number>))) };
  };
  /** Drop rows; when they are every row of a parent the list owns alone, empty the parent at once. */
  const drop = (rs: Map<unknown, Row<T>>, all: boolean, host: Node): void => {
    if (all && host.firstChild === start && host.lastChild === end && host.nodeType === 1 && !props.animate && everyPlain(rs)) {
      disposeDetached(() => { for (const r of rs.values()) _dispose(r.o); });
      (host as Element).textContent = "";
      host.appendChild(start); host.appendChild(end);
    } else for (const r of rs.values()) dropRow(r);
  };

  effect(() => {
    const list = (val(props.each) ?? []) as readonly T[];
    const host = end.parentNode as Node;
    untrack(() => {
      const n = list.length, old = order, m = old.length;
      if (fallback && n) { dropRow(fallback); fallback = null; }
      const next: Row<T>[] = (order = new Array(n));
      // the same key at the same end: the row stays where it is (only its item and index update)
      const same = (i: number, r: Row<T> | undefined): boolean => {
        const it = list[i] as T;
        if (!r || keyOf(it) !== r.k) return false;
        _setCell(r.item, it);
        if (r.index) _setCell(r.index, i);
        r.at = i; next[i] = r;
        return true;
      };
      let s = 0, e1 = m - 1, e2 = n - 1;
      while (s <= e1 && s <= e2 && same(s, old[s])) s++;
      while (s <= e1 && s <= e2 && same(e2, old[e1])) { e1--; e2--; }
      // the middle: old rows s…e1 become new rows s…e2 (reused by key, made, or dropped)
      const byKey = new Map<unknown, Row<T>>();
      for (let i = s; i <= e1; i++) byKey.set((old[i] as Row<T>).k, old[i] as Row<T>);
      const was = new Int32Array(e2 >= s ? e2 - s + 1 : 0); // old position of each middle row (-1: new)
      for (let i = s; i <= e2; i++) {
        const it = list[i] as T, k = keyOf(it), r = byKey.size ? byKey.get(k) : undefined;
        if (r) { byKey.delete(k); was[i - s] = r.at; same(i, r); }
        else { was[i - s] = -1; next[i] = make(it, i, k); }
      }
      if (byKey.size) drop(byKey, byKey.size === m, host);
      if (!n && props.fallback != null && !fallback) {
        const o = _owner(owner);
        fallback = { o, nodes: runWithOwner(o, () => collect(() => call(props.fallback))) };
        for (const x of fallback.nodes) host.insertBefore(x, end);
      }
      if (s > e2) return;
      // rows on a longest increasing run of old positions stay; the others (moved or new) are gathered in order and
      // inserted, one fragment at a time, before the next row that stays. Filling an empty list is one insert.
      const place = (): void => {
        const keep = lis(was);
        let ref: Node = e2 + 1 < n ? ((next[e2 + 1] as Row<T>).nodes[0] ?? end) : end, pending: DocumentFragment | null = null;
        for (let i = e2; i >= s; i--) {
          const ns = (next[i] as Row<T>).nodes;
          if (keep[i - s]) {
            if (pending) { host.insertBefore(pending, ref); pending = null; }
            if (ns.length) ref = ns[0] as Node;
          } else {
            pending ??= doc.createDocumentFragment();
            for (let x = ns.length - 1; x >= 0; x--) pending.insertBefore(ns[x] as Node, pending.firstChild);
          }
        }
        if (pending) host.insertBefore(pending, ref);
      };
      if (props.animate && flipHook) flipHook(next.flatMap((r) => r.nodes).filter((x): x is Element => x.nodeType === 1), place, props.animate);
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
function everyPlain(rs: Map<unknown, { nodes: Node[] }>): boolean {
  for (const r of rs.values()) if (!plain(r)) return false;
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
