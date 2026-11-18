// Flow model: the document (nodes, edges, groups), its readable JSON schema, validation, selection, clipboard
// fragments, undo (the app's UndoManager) and the layered auto layout. No DOM here: the canvas draws this store, the
// palette adds to it and a runner (FlowControls) executes it.
//
// JSON (schema "march.flow/v1"): edges name their ends as "node.port", so a file reads like the drawing:
//   { "schema": "march.flow/v1", "name": "Orders",
//     "nodes": [{ "id": "hook", "type": "webhook", "x": 0, "y": 40, "data": { "path": "/orders" } }, …],
//     "edges": [{ "id": "e1", "from": "hook.out", "to": "check.in" }],
//     "groups": [{ "id": "g1", "label": "Payment", "nodes": ["pay", "mail"] }] }
import { signal, batch, untrack, type Signal, type Accessor } from "../../../core/reactive.ts";
import { t } from "../../../core/i18n.ts";
import type { MaybeFn } from "../../../core/util.ts";
import type { ColorToken } from "../../../theme/colors.ts";
import type { IconProp } from "../../../icons/types.ts";
// the UndoManager loads on the first change: the component barrel stays free of side effects
const undoManager = () => import("../../../managers/undo/index.ts");

/** Schema id written into saved flows (march.flow/v1); validateFlow checks it. */
export const FLOW_SCHEMA = "march.flow/v1";
/** Node width in world units (ports sit on its inline edges). */
export const NODE_W = 232;
/** Header height and port row height: port positions are known without measuring. */
export const NODE_HEAD = 44;
/** Height of one port row on a node, in px. */
export const PORT_ROW = 26;

export interface FlowPort { id: string; label?: MaybeFn<string> }
/** A form control inside the node, drawn with the March form inputs. */
export interface FlowField {
  key: string;
  label: MaybeFn<string>;
  kind: "text" | "number" | "select" | "toggle";
  options?: readonly (string | { value: unknown; label: string })[];
  default?: unknown;
  min?: number;
  max?: number;
}
/** What a node's run() receives. */
export interface FlowRunContext {
  node: Readonly<FlowNode>;
  /** The node's field values. */
  data: Record<string, unknown>;
  /** Values that arrived, by input port (a skipped branch is missing). */
  inputs: Record<string, unknown>;
  /** The first input value (most nodes have one input). */
  input: unknown;
  signal: AbortSignal;
}
export interface FlowNodeType {
  type: string;
  label: MaybeFn<string>;
  description?: MaybeFn<string>;
  icon?: IconProp;
  /** Header accent (theme token). */
  color?: ColorToken;
  /** Palette section. */
  category?: MaybeFn<string>;
  inputs?: readonly FlowPort[];
  outputs?: readonly FlowPort[];
  fields?: readonly FlowField[];
  /** Work of the node. Return a value (sent on every output) or emit({ port: value }) to choose outputs; throw to fail. */
  run?: (ctx: FlowRunContext) => unknown;
}

export interface FlowNode { id: string; type: string; x: number; y: number; label?: string; data?: Record<string, unknown> }
export interface FlowEdge { id: string; /** "node.port" */ from: string; /** "node.port" */ to: string }
export interface FlowGroup { id: string; label: string; nodes: string[]; color?: ColorToken }
export interface FlowDoc {
  schema: typeof FLOW_SCHEMA;
  name?: string;
  nodes: FlowNode[];
  edges: FlowEdge[];
  groups?: FlowGroup[];
  viewport?: { x: number; y: number; zoom: number };
}

const EMIT = Symbol("flow.emit");
/** From run(): send values on chosen output ports only (`emit({ yes: order })`); others are skipped. */
export const emit = (ports: Record<string, unknown>): { [EMIT]: Record<string, unknown> } => ({ [EMIT]: ports });
/** The ports a node run chose with emit(), or null when it returned a plain value. */
export const emitted = (v: unknown): Record<string, unknown> | null => (v && typeof v === "object" && EMIT in v ? (v as { [EMIT]: Record<string, unknown> })[EMIT] : null);

/** "node.port" → [node, port] (the port is after the last dot). */
export function endOf(ref: string): [string, string] {
  const i = ref.lastIndexOf(".");
  return i < 0 ? [ref, ""] : [ref.slice(0, i), ref.slice(i + 1)];
}

/** One node on the canvas: position and data are signals so a drag redraws only that node and its edges. */
export interface NodeState {
  id: string;
  type: string;
  x: Signal<number>;
  y: Signal<number>;
  label: Signal<string | undefined>;
  data: Signal<Record<string, unknown>>;
  /** Measured height (world units); set by the canvas. */
  h: Signal<number>;
}
export type NodeStatus = "idle" | "queued" | "running" | "done" | "error" | "skipped";

export interface FlowView {
  fit(animate?: boolean): void;
  zoomBy(f: number): void;
  center(): { x: number; y: number };
  /** Client point → world point (null when outside the canvas). */
  toWorld(clientX: number, clientY: number): { x: number; y: number } | null;
  focusNode(id: string): void;
  layout(): void;
}

export interface FlowOptions {
  types: readonly FlowNodeType[];
  doc?: FlowDoc;
  /** Record changes in the app's undo history (UndoManager). Default true. */
  undo?: boolean;
}

export interface FlowStore {
  types: readonly FlowNodeType[];
  typeOf(type: string): FlowNodeType | undefined;
  name: Signal<string>;
  nodes: Signal<NodeState[]>;
  edges: Signal<FlowEdge[]>;
  groups: Signal<FlowGroup[]>;
  viewport: Signal<{ x: number; y: number; zoom: number }>;
  /** Selected node, edge and group ids. */
  selection: Signal<ReadonlySet<string>>;
  node(id: string): NodeState | undefined;
  /** Run state (FlowControls writes it, the canvas draws it). */
  status: Signal<ReadonlyMap<string, NodeStatus>>;
  errors: Signal<ReadonlyMap<string, string>>;
  counts: Signal<ReadonlyMap<string, number>>;
  /** Called for every value sent on an edge (the canvas animates a dot). */
  onPulse(fn: (edgeId: string, ms: number) => void): () => void;
  pulse(edgeId: string, ms: number): void;
  resetRun(): void;
  /** The canvas registers its view functions here (palette and controls use them). */
  view: Signal<FlowView | null>;

  toJSON(): FlowDoc;
  load(doc: FlowDoc, label?: string): void;
  /** Run fn as one undoable change. */
  change<R>(label: string, fn: () => R): R;
  addNode(type: string, x: number, y: number, data?: Record<string, unknown>): string;
  remove(ids: Iterable<string>): void;
  connect(from: string, to: string): string | null;
  canConnect(from: string, to: string): boolean;
  moveBy(ids: Iterable<string>, dx: number, dy: number): void;
  group(ids: Iterable<string>, label?: string): string | null;
  ungroup(ids: Iterable<string>): void;
  /** JSON fragment of the selected nodes (and the edges between them). */
  copy(ids?: Iterable<string>): string;
  /** Paste a fragment (offset, new ids); returns the new node ids. */
  paste(text: string, at?: { x: number; y: number }): string[];
  undo: boolean;
}

/** Problems of a document (readable sentences); empty when it is valid. */
export function validateFlow(doc: unknown, types?: readonly FlowNodeType[]): string[] {
  const out: string[] = [];
  const d = doc as Partial<FlowDoc> | null;
  if (!d || typeof d !== "object") return [t`The document must be a JSON object.`];
  if (d.schema !== FLOW_SCHEMA) out.push(t`"schema" must be "${FLOW_SCHEMA}".`);
  if (!Array.isArray(d.nodes)) return [...out, t`"nodes" must be a list.`];
  if (!Array.isArray(d.edges)) out.push(t`"edges" must be a list.`);
  const ids = new Map<string, FlowNode>();
  for (const n of d.nodes) {
    if (!n || typeof n.id !== "string" || !n.id || n.id.includes(".")) { out.push(t`Every node needs an "id" without dots.`); continue; }
    if (ids.has(n.id)) out.push(t`Node id "${n.id}" is used twice.`);
    ids.set(n.id, n);
    if (typeof n.x !== "number" || typeof n.y !== "number") out.push(t`Node "${n.id}" needs numeric "x" and "y".`);
    if (types && !types.some((ty) => ty.type === n.type)) out.push(t`Node "${n.id}" has an unknown type "${String(n.type)}".`);
  }
  const portOk = (ref: unknown, side: "inputs" | "outputs"): boolean => {
    if (typeof ref !== "string") return false;
    const [nid, port] = endOf(ref);
    const n = ids.get(nid);
    if (!n) return false;
    const ty = types?.find((x) => x.type === n.type);
    return !ty || !!ty[side]?.some((p) => p.id === port);
  };
  for (const e of Array.isArray(d.edges) ? d.edges : []) {
    if (!portOk(e?.from, "outputs")) out.push(t`Edge "${String(e?.id)}": "from" must name an output as "node.port".`);
    if (!portOk(e?.to, "inputs")) out.push(t`Edge "${String(e?.id)}": "to" must name an input as "node.port".`);
  }
  for (const g of Array.isArray(d.groups) ? d.groups : []) {
    if (!Array.isArray(g?.nodes) || g.nodes.some((id) => !ids.has(id))) out.push(t`Group "${String(g?.label ?? g?.id)}" names a missing node.`);
  }
  return out;
}

let seq = 0;
const freshId = (prefix: string, taken: (id: string) => boolean): string => {
  let id = "";
  do id = `${prefix}${(++seq).toString(36)}`; while (taken(id));
  return id;
};

/** A flow store: `const flow = createFlow({ types, doc })`, then `<FlowCanvas flow={flow} />`. */
export function createFlow(o: FlowOptions): FlowStore {
  const types = o.types;
  const typeOf = (type: string): FlowNodeType | undefined => types.find((x) => x.type === type);
  const nodes = signal<NodeState[]>([]);
  const edges = signal<FlowEdge[]>([]);
  const groups = signal<FlowGroup[]>([]);
  const name = signal("");
  const viewport = signal({ x: 40, y: 40, zoom: 1 });
  const selection = signal<ReadonlySet<string>>(new Set());
  const status = signal<ReadonlyMap<string, NodeStatus>>(new Map());
  const errors = signal<ReadonlyMap<string, string>>(new Map());
  const counts = signal<ReadonlyMap<string, number>>(new Map());
  const pulses = new Set<(edgeId: string, ms: number) => void>();
  const view = signal<FlowView | null>(null);
  const byId = new Map<string, NodeState>();

  const defaults = (type: string): Record<string, unknown> =>
    Object.fromEntries((typeOf(type)?.fields ?? []).map((f) => [f.key, f.default ?? (f.kind === "number" ? 0 : f.kind === "toggle" ? false : f.kind === "select" ? (typeof f.options?.[0] === "object" ? (f.options[0] as { value: unknown }).value : f.options?.[0]) : "")]));
  const makeNode = (n: FlowNode): NodeState => {
    const s: NodeState = { id: n.id, type: n.type, x: signal(n.x), y: signal(n.y), label: signal(n.label), data: signal({ ...defaults(n.type), ...(n.data ?? {}) }), h: signal(NODE_HEAD + 2 * PORT_ROW + 16) };
    byId.set(n.id, s);
    return s;
  };
  const plain = (s: NodeState): FlowNode => {
    const n: FlowNode = { id: s.id, type: s.type, x: Math.round(s.x.peek()), y: Math.round(s.y.peek()) };
    const l = s.label.peek();
    if (l) n.label = l;
    const data = s.data.peek();
    if (Object.keys(data).length) n.data = { ...data };
    return n;
  };
  const taken = (id: string): boolean => byId.has(id) || edges.peek().some((e) => e.id === id) || groups.peek().some((g) => g.id === id);

  function toJSON(): FlowDoc {
    const doc: FlowDoc = { schema: FLOW_SCHEMA, nodes: nodes.peek().map(plain), edges: edges.peek().map((e) => ({ ...e })) };
    if (name.peek()) doc.name = name.peek();
    if (groups.peek().length) doc.groups = groups.peek().map((g) => ({ ...g, nodes: [...g.nodes] }));
    doc.viewport = { ...viewport.peek() };
    return doc;
  }
  function restore(doc: FlowDoc, keepView = true): void {
    batch(() => {
      // reuse node states by id so the DOM rows stay (undo of a move animates nothing away)
      const next = doc.nodes.map((n) => {
        const s = byId.get(n.id);
        if (s && s.type === n.type) { s.x.set(n.x); s.y.set(n.y); s.label.set(n.label); s.data.set({ ...defaults(n.type), ...(n.data ?? {}) }); return s; }
        return makeNode(n);
      });
      const keep = new Set(next.map((s) => s.id));
      for (const id of [...byId.keys()]) if (!keep.has(id)) byId.delete(id);
      nodes.set(next);
      edges.set(doc.edges.map((e) => ({ ...e })));
      groups.set((doc.groups ?? []).map((g) => ({ ...g, nodes: [...g.nodes] })));
      name.set(doc.name ?? "");
      if (!keepView && doc.viewport) viewport.set({ ...doc.viewport });
      const sel = selection.peek();
      if ([...sel].some((id) => !taken(id))) selection.set(new Set([...sel].filter(taken)));
    });
  }

  let depth = 0;
  const store: FlowStore = {
    types, typeOf, name, nodes, edges, groups, viewport, selection, status, errors, counts, view,
    undo: o.undo !== false,
    node: (id) => byId.get(id),
    onPulse(fn) { pulses.add(fn); return () => { pulses.delete(fn); }; },
    pulse(edgeId, ms) {
      counts.set(new Map(counts.peek()).set(edgeId, (counts.peek().get(edgeId) ?? 0) + 1));
      for (const fn of pulses) fn(edgeId, ms);
    },
    resetRun() { batch(() => { status.set(new Map()); errors.set(new Map()); counts.set(new Map()); }); },
    toJSON,
    load(doc, label) {
      const problems = validateFlow(doc, types);
      if (problems.length) throw new Error(problems.join("\n"));
      if (label) store.change(label, () => restore(doc, false));
      else untrack(() => restore(doc, false));
    },
    change(label, fn) {
      if (!store.undo || depth) { depth++; try { return fn(); } finally { depth--; } }
      const before = toJSON();
      depth++;
      let r: ReturnType<typeof fn>;
      try { r = batch(fn); } finally { depth--; }
      const after = toJSON();
      if (JSON.stringify(before.nodes) !== JSON.stringify(after.nodes) || JSON.stringify(before.edges) !== JSON.stringify(after.edges) || JSON.stringify(before.groups) !== JSON.stringify(after.groups)) {
        void undoManager().then((m) => m.undoStack().push({ label, undo: () => restore(before), redo: () => restore(after) }));
      }
      return r;
    },
    addNode(type, x, y, data) {
      return store.change(t`Add node`, () => {
        const id = freshId(type.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase() || "n", taken);
        nodes.set([...nodes.peek(), makeNode({ id, type, x, y, ...(data ? { data } : {}) })]);
        selection.set(new Set([id]));
        return id;
      });
    },
    remove(ids) {
      const set = new Set(ids);
      if (!set.size) return;
      store.change(t`Delete`, () => {
        // a removed group keeps its nodes; a removed node takes its edges with it
        nodes.set(nodes.peek().filter((n) => !set.has(n.id)));
        for (const id of set) if (!nodes.peek().some((n) => n.id === id)) byId.delete(id);
        edges.set(edges.peek().filter((e) => !set.has(e.id) && !set.has(endOf(e.from)[0]) && !set.has(endOf(e.to)[0])));
        groups.set(groups.peek().filter((g) => !set.has(g.id)).map((g) => ({ ...g, nodes: g.nodes.filter((n) => !set.has(n)) })).filter((g) => g.nodes.length));
        selection.set(new Set());
      });
    },
    canConnect(from, to) {
      const [a, ap] = endOf(from), [b, bp] = endOf(to);
      if (a === b) return false;
      const ta = typeOf(byId.get(a)?.type ?? ""), tb = typeOf(byId.get(b)?.type ?? "");
      if (!ta?.outputs?.some((p) => p.id === ap) || !tb?.inputs?.some((p) => p.id === bp)) return false;
      if (edges.peek().some((e) => e.from === from && e.to === to)) return false;
      // no cycles: b must not reach a
      const seen = new Set<string>(), stack = [b];
      while (stack.length) {
        const cur = stack.pop()!;
        if (cur === a) return false;
        if (seen.has(cur)) continue;
        seen.add(cur);
        for (const e of edges.peek()) if (endOf(e.from)[0] === cur) stack.push(endOf(e.to)[0]);
      }
      return true;
    },
    connect(from, to) {
      if (!store.canConnect(from, to)) return null;
      return store.change(t`Connect`, () => {
        const id = freshId("e", taken);
        edges.set([...edges.peek(), { id, from, to }]);
        return id;
      });
    },
    moveBy(ids, dx, dy) {
      const list = [...ids];
      store.change(t`Move`, () => { for (const id of list) { const n = byId.get(id); if (n) { n.x.set(n.x.peek() + dx); n.y.set(n.y.peek() + dy); } } });
    },
    group(ids, label) {
      const members = [...ids].filter((id) => byId.has(id));
      if (members.length < 1) return null;
      return store.change(t`Group`, () => {
        const id = freshId("g", taken);
        groups.set([...groups.peek().map((g) => ({ ...g, nodes: g.nodes.filter((n) => !members.includes(n)) })).filter((g) => g.nodes.length), { id, label: label ?? t`Group`, nodes: members }]);
        selection.set(new Set([id]));
        return id;
      });
    },
    ungroup(ids) {
      const set = new Set(ids);
      const hit = groups.peek().filter((g) => set.has(g.id) || g.nodes.some((n) => set.has(n)));
      if (!hit.length) return;
      store.change(t`Ungroup`, () => { groups.set(groups.peek().filter((g) => !hit.includes(g))); });
    },
    copy(ids) {
      const set = new Set(ids ?? selection.peek());
      for (const g of groups.peek()) if (set.has(g.id)) for (const n of g.nodes) set.add(n);
      const doc = toJSON();
      const frag: FlowDoc = { schema: FLOW_SCHEMA, nodes: doc.nodes.filter((n) => set.has(n.id)), edges: doc.edges.filter((e) => set.has(endOf(e.from)[0]) && set.has(endOf(e.to)[0])) };
      const gs = (doc.groups ?? []).filter((g) => g.nodes.every((n) => set.has(n)) && (set.has(g.id) || g.nodes.length));
      if (gs.length) frag.groups = gs;
      return JSON.stringify(frag, null, 2);
    },
    paste(text, at) {
      let frag: FlowDoc;
      try { frag = JSON.parse(text) as FlowDoc; } catch { return []; }
      if (validateFlow(frag, types).length || !frag.nodes.length) return [];
      const minX = Math.min(...frag.nodes.map((n) => n.x)), minY = Math.min(...frag.nodes.map((n) => n.y));
      const dx = at ? at.x - minX : 32, dy = at ? at.y - minY : 32;
      return store.change(t`Paste`, () => {
        const map = new Map<string, string>();
        const added = frag.nodes.map((n) => { const id = freshId(n.type.replace(/[^a-z0-9]/gi, "").slice(0, 8).toLowerCase() || "n", taken); map.set(n.id, id); return makeNode({ ...n, id, x: n.x + dx, y: n.y + dy }); });
        nodes.set([...nodes.peek(), ...added]);
        const re = (ref: string): string => { const [n, p] = endOf(ref); return `${map.get(n)}.${p}`; };
        edges.set([...edges.peek(), ...frag.edges.map((e) => ({ id: freshId("e", taken), from: re(e.from), to: re(e.to) }))]);
        if (frag.groups?.length) groups.set([...groups.peek(), ...frag.groups.map((g) => ({ ...g, id: freshId("g", taken), nodes: g.nodes.map((n) => map.get(n)!) }))]);
        const ids = added.map((n) => n.id);
        selection.set(new Set(ids));
        return ids;
      });
    },
  };
  if (o.doc) store.load(o.doc);
  return store;
}

/** Inputs and outputs of a node type (empty lists when missing). */
export const portsOf = (ty: FlowNodeType | undefined): { inputs: readonly FlowPort[]; outputs: readonly FlowPort[] } => ({ inputs: ty?.inputs ?? [], outputs: ty?.outputs ?? [] });
/** Port centre in world units (logical x: grows toward the inline end). */
export function portPoint(store: FlowStore, ref: string, side: "in" | "out"): { x: number; y: number } | null {
  const [id, port] = endOf(ref);
  const n = store.node(id);
  if (!n) return null;
  const ty = store.typeOf(n.type);
  const list = side === "in" ? ty?.inputs ?? [] : ty?.outputs ?? [];
  const i = Math.max(0, list.findIndex((p) => p.id === port));
  return { x: n.x() + (side === "out" ? NODE_W : 0), y: n.y() + NODE_HEAD + i * PORT_ROW + PORT_ROW / 2 };
}
/** Cubic bezier between two port points; the handles stretch with the distance (and bend back for a loop-around). */
export function edgePath(a: { x: number; y: number }, b: { x: number; y: number }): string {
  const dx = Math.max(48, Math.abs(b.x - a.x) * 0.5, b.x < a.x ? Math.min(160, (a.x - b.x) * 0.5 + 60) : 0);
  return `M${a.x} ${a.y}C${a.x + dx} ${a.y} ${b.x - dx} ${b.y} ${b.x} ${b.y}`;
}

/**
 * Layered layout: rank = longest path from a source, order inside a rank by the mean order of its parents (two sweeps,
 * fewer crossings), ranks spaced by the node width, rows by the measured heights. Returns positions; does not move.
 */
export function layeredLayout(store: FlowStore, o: { gapX?: number; gapY?: number; origin?: { x: number; y: number } } = {}): Map<string, { x: number; y: number }> {
  const gapX = o.gapX ?? 96, gapY = o.gapY ?? 32;
  const list = untrack(store.nodes), es = untrack(store.edges);
  const parents = new Map<string, string[]>(list.map((n) => [n.id, []]));
  for (const e of es) parents.get(endOf(e.to)[0])?.push(endOf(e.from)[0]);
  const rank = new Map<string, number>();
  const rankOf = (id: string, seen = new Set<string>()): number => {
    if (rank.has(id)) return rank.get(id)!;
    if (seen.has(id)) return 0;
    seen.add(id);
    const r = Math.max(-1, ...(parents.get(id) ?? []).map((p) => rankOf(p, seen))) + 1;
    rank.set(id, r);
    return r;
  };
  for (const n of list) rankOf(n.id);
  const layers: string[][] = [];
  for (const n of list) (layers[rank.get(n.id)!] ??= []).push(n.id);
  // keep the current vertical order as the start, then barycenter sweeps
  for (const l of layers) l?.sort((a, b) => store.node(a)!.y.peek() - store.node(b)!.y.peek());
  for (let sweep = 0; sweep < 2; sweep++) {
    for (let r = 1; r < layers.length; r++) {
      const prev = layers[r - 1] ?? [];
      const bc = (id: string): number => { const ps = parents.get(id)!.map((p) => prev.indexOf(p)).filter((i) => i >= 0); return ps.length ? ps.reduce((s, i) => s + i, 0) / ps.length : Infinity; };
      layers[r]?.sort((a, b) => bc(a) - bc(b));
    }
  }
  const out = new Map<string, { x: number; y: number }>();
  const ox = o.origin?.x ?? 0, oy = o.origin?.y ?? 0;
  const heights = layers.map((l) => (l ?? []).reduce((s, id) => s + store.node(id)!.h.peek() + gapY, -gapY));
  const tallest = Math.max(0, ...heights);
  layers.forEach((l, r) => {
    let y = oy + (tallest - heights[r]!) / 2;
    for (const id of l ?? []) { out.set(id, { x: ox + r * (NODE_W + gapX), y }); y += store.node(id)!.h.peek() + gapY; }
  });
  return out;
}

/** Bounds of nodes in world units. */
export function boundsOf(store: FlowStore, ids?: Iterable<string>): { x: number; y: number; w: number; h: number } | null {
  const set = ids ? new Set(ids) : null;
  const list = store.nodes().filter((n) => !set || set.has(n.id));
  if (!list.length) return null;
  const x0 = Math.min(...list.map((n) => n.x())), y0 = Math.min(...list.map((n) => n.y()));
  const x1 = Math.max(...list.map((n) => n.x() + NODE_W)), y1 = Math.max(...list.map((n) => n.y() + n.h()));
  return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
}
export type { Accessor };
