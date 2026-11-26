// Hierarchies for treemap and sunburst: nodes with summed values, squarified rectangles and angular partitions.
import { num } from "./util.ts";

/** One node of a hierarchy. `value` is the sum of its leaves (or its own value). */
export interface HNode<D = unknown> {
  key: string; label: string; value: number; depth: number; datum: D; parent: HNode<D> | null; children: HNode<D>[];
  /** The top-level branch it belongs to (its color slot). */
  branch: number;
}
export interface HierOptions<D> {
  /** Children of a row (default `row.children`). */
  children?: ((d: D) => readonly D[] | null | undefined) | string | undefined;
  /** A leaf's value (default `row.value`). */
  value?: ((d: D) => unknown) | string | undefined;
  /** A row's label (default `row.label ?? row.name`). */
  label?: ((d: D) => unknown) | string | undefined;
  /** A row's key (default its path of labels). */
  key?: ((d: D) => unknown) | string | undefined;
}
const get = <D>(f: ((d: D) => unknown) | string | undefined, d: D, def: (d: D) => unknown): unknown =>
  typeof f === "function" ? f(d) : f != null ? (d as Record<string, unknown> | null)?.[f] : def(d);

/** Build a hierarchy from one root row or a list of top rows (they become children of a synthetic root). */
export function hierarchy<D>(data: D | readonly D[], o: HierOptions<D> = {}): HNode<D> {
  const make = (d: D, depth: number, parent: HNode<D> | null, i: number, branch: number): HNode<D> => {
    const label = String(get(o.label, d, (x) => (x as { label?: unknown; name?: unknown })?.label ?? (x as { name?: unknown })?.name ?? "") ?? "");
    const node: HNode<D> = { key: "", label, value: 0, depth, datum: d, parent, children: [], branch: depth === 1 ? i : branch };
    node.key = String(get(o.key, d, () => (parent && parent.key ? `${parent.key}/${label || i}` : label || String(i))));
    const kids = get(o.children, d, (x) => (x as { children?: unknown })?.children) as readonly D[] | null | undefined;
    if (Array.isArray(kids) && kids.length) {
      node.children = kids.map((k, j) => make(k, depth + 1, node, j, node.branch));
      node.value = node.children.reduce((a, c) => a + c.value, 0);
    } else node.value = Math.max(0, num(get(o.value, d, (x) => (x as { value?: unknown })?.value)) ?? 0);
    return node;
  };
  if (Array.isArray(data)) {
    // a list of top rows: a synthetic root holds them (its children are the rows themselves, whatever `children`
    // reads inside a row)
    const root: HNode<D> = { key: "", label: "", value: 0, depth: 0, datum: { children: data } as D, parent: null, children: [], branch: 0 };
    root.children = (data as readonly D[]).map((d, i) => make(d, 1, root, i, i));
    root.value = root.children.reduce((a, c) => a + c.value, 0);
    return root;
  }
  return make(data as D, 0, null, 0, 0);
}

/** Every node below `root` (pre-order), optionally down to `maxDepth` levels. */
export function descendants<D>(root: HNode<D>, maxDepth = Infinity): HNode<D>[] {
  const out: HNode<D>[] = [];
  const walk = (n: HNode<D>): void => { for (const c of n.children) { if (c.depth - root.depth > maxDepth) continue; out.push(c); walk(c); } };
  walk(root);
  return out;
}

export interface Rect { x: number; y: number; w: number; h: number }

/** Squarified treemap of `nodes` (siblings, sorted by value) inside `r`: their rectangles in the same order. */
export function squarify(values: readonly number[], r: Rect): Rect[] {
  const order = values.map((v, i) => [Math.max(0, v), i] as const).sort((a, b) => b[0] - a[0]);
  const total = order.reduce((a, [v]) => a + v, 0);
  const out: Rect[] = values.map(() => ({ x: r.x, y: r.y, w: 0, h: 0 }));
  if (!total || r.w <= 0 || r.h <= 0) return out;
  const k = (r.w * r.h) / total;
  let { x, y, w, h } = r, i = 0;
  const worst = (row: number[], side: number): number => {
    const s = row.reduce((a, b) => a + b, 0), mx = Math.max(...row), mn = Math.min(...row);
    return Math.max((side * side * mx) / (s * s), (s * s) / (side * side * mn));
  };
  while (i < order.length) {
    const side = Math.min(w, h), row: number[] = [];
    let j = i;
    while (j < order.length) {
      const a = (order[j]![0]) * k;
      if (a <= 0) { j++; continue; }
      if (row.length && worst([...row, a], side) > worst(row, side)) break;
      row.push(a); j++;
    }
    const s = row.reduce((a, b) => a + b, 0) || 0;
    let off = 0;
    for (let n = i; n < j; n++) {
      const [v, idx] = order[n]!, a = v * k;
      if (w >= h) { const cw = s / h, ch = a / (cw || 1); out[idx] = { x, y: y + off, w: cw, h: ch }; off += ch; }
      else { const ch = s / w, cw = a / (ch || 1); out[idx] = { x: x + off, y, w: cw, h: ch }; off += cw; }
    }
    if (w >= h) { const cw = s / h; x += cw; w -= cw; } else { const ch = s / w; y += ch; h -= ch; }
    i = j;
  }
  return out;
}

/** Angular partition (sunburst): each node gets [a0, a1] (radians) inside its parent's span, by value. */
export function partition<D>(root: HNode<D>, a0 = 0, a1 = Math.PI * 2): Map<HNode<D>, [number, number]> {
  const out = new Map<HNode<D>, [number, number]>();
  const walk = (n: HNode<D>, s: number, e: number): void => {
    out.set(n, [s, e]);
    let a = s;
    for (const c of n.children) { const span = n.value ? ((e - s) * c.value) / n.value : 0; walk(c, a, a + span); a += span; }
  };
  walk(root, a0, a1);
  return out;
}
