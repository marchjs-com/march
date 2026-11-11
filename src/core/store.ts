// HADI March store — plain objects that are reactive and observable, no reducers, no actions.
//   const app = store({ user: { name: "Ada" }, cart: { items: [] as Item[] } })
//   app.user.name = "Ece"; app.cart.items.push(x); delete app.flags.beta      // just write
//   <p>{app.user.name}</p>                                                      // fine-grained: only that path is tracked
//   subscribe(app.cart, (c) => …)   on(app, "cart.items", fn)   on(app, "users.*.name", fn)   // change events
//   batch(() => { … })  → listeners get ONE { op: "batch", changes } event
//   persist(app.prefs, "prefs")  history(app.form)  readonly(app)  snapshot(app)  derive(() => app.cart.items.length)
import { signal, batch, untrack, computed, afterBatch, isBatching, DEV } from "./reactive.ts";

// ------------------------------------------------------------------ types
type Primitive = string | number | boolean | bigint | symbol | null | undefined | Date | RegExp | ((...a: never[]) => unknown);
type Prev = [never, 0, 1, 2, 3, 4, 5, 6];
/** Every dotted path of T (depth ≤ 6), with "*" wildcards for array items and record keys. */
export type Path<T, D extends number = 6> = [D] extends [never] ? never
  : T extends Primitive ? never
  : T extends readonly (infer U)[] ? `${number}` | "*" | `${number}.${Path<U, Prev[D]>}` | `*.${Path<U, Prev[D]>}`
  : { [K in keyof T & string]: K | "*" | `${K}.${Path<T[K], Prev[D]>}` | `*.${Path<T[K], Prev[D]>}` }[keyof T & string];
/** Type at a path (wildcards resolve to the element / value type). */
export type PathValue<T, P extends string> =
  P extends `${infer H}.${infer R}` ? PathValue<Step<T, H>, R> : Step<T, P>;
type Step<T, K extends string> = T extends readonly (infer U)[] ? U : K extends "*" ? T[keyof T] : K extends keyof T ? T[K] : never;

export type ChangeOp = "set" | "delete" | "push" | "pop" | "shift" | "unshift" | "splice" | "sort" | "reverse" | "fill" | "copyWithin";
export interface Change<V = unknown> { path: string; op: ChangeOp; value?: V; old?: V; args?: unknown[] }
export interface BatchChange { path: string; op: "batch"; changes: Change[] }
export type StoreEvent = Change | BatchChange;
export type Listener = (event: StoreEvent) => void;

// ------------------------------------------------------------------ internals
const RAW = Symbol("hm.raw");
const META = Symbol("hm.meta");
interface Root { listeners: Set<{ prefix: string[]; pattern: string[] | null; fn: Listener }>; pending: Change[] | null; log: Change[] | null }
interface Meta { root: Root; path: string[]; signals: Map<PropertyKey, Sig>; version: Sig }
interface Sig { (): unknown; set(v: unknown): unknown; peek(): unknown }
const mkSig = (v: unknown): Sig => signal(v, { equals: false }) as unknown as Sig;

const isPlain = (v: unknown): v is Record<PropertyKey, unknown> => {
  if (v === null || typeof v !== "object") return false;
  if (Array.isArray(v)) return true;
  const p = Object.getPrototypeOf(v);
  return p === Object.prototype || p === null;
};
const metas = new WeakMap<object, Meta>();
const proxies = new WeakMap<object, object>();
const READONLY = new WeakMap<object, object>();
const ARRAY_MUTATORS = new Set<string>(["push", "pop", "shift", "unshift", "splice", "sort", "reverse", "fill", "copyWithin"]);
let inArrayOp = 0;

function metaOf(target: object, root: Root, path: string[]): Meta {
  let m = metas.get(target);
  if (!m) { m = { root, path, signals: new Map(), version: mkSig(0) }; metas.set(target, m); }
  return m;
}
function sigOf(m: Meta, key: PropertyKey, target: Record<PropertyKey, unknown>): Sig {
  let s = m.signals.get(key);
  if (!s) { s = mkSig(target[key]); m.signals.set(key, s); }
  return s;
}
function wrap<T>(v: T, root: Root, path: string[]): T {
  if (!isPlain(v)) return v;
  const existing = proxies.get(v);
  if (existing) return existing as T;
  metaOf(v, root, path);
  const p = new Proxy(v, handler);
  proxies.set(v, p);
  return p as T;
}

function emit(root: Root, c: Change): void {
  root.log?.push(c);
  if (DEV.enabled && root.log && root.log.length > 1000) root.log.splice(0, root.log.length - 1000);
  if (isBatching()) {
    if (!root.pending) { root.pending = []; afterBatch(() => { const cs = root.pending ?? []; root.pending = null; deliver(root, cs); }); }
    root.pending.push(c);
  } else deliver(root, [c]);
}
function deliver(root: Root, cs: Change[]): void {
  if (!cs.length) return;
  for (const l of root.listeners) {
    const mine = cs.filter((c) => matches(l, c.path));
    if (!mine.length) continue;
    const ev: StoreEvent = mine.length === 1 && cs.length === 1 ? (mine[0] as Change) : { path: l.prefix.join("."), op: "batch", changes: mine };
    try { l.fn(ev); } catch (e) { queueMicrotask(() => { throw e; }); }
  }
}
function matches(l: { prefix: string[]; pattern: string[] | null }, path: string): boolean {
  const segs = path ? path.split(".") : [];
  if (l.pattern) return glob(l.pattern, segs);
  // prefix subscription: change at or below the prefix, or a change of an ancestor (the subtree was replaced)
  const n = Math.min(l.prefix.length, segs.length);
  for (let i = 0; i < n; i++) if (l.prefix[i] !== segs[i]) return false;
  return true;
}
/**
 * Pattern vs changed path: they match when one is a prefix of the other under wildcard rules ("*" one segment, "**"
 * any rest). So "cart.items" hears "cart.items.3.qty" (inside) and "cart" being replaced (ancestor).
 */
function glob(p: string[], s: string[]): boolean {
  for (let i = 0; i < p.length && i < s.length; i++) {
    const seg = p[i];
    if (seg === "**") return true;
    if (seg !== "*" && seg !== s[i]) return false;
  }
  return true;
}

const handler: ProxyHandler<Record<PropertyKey, unknown>> = {
  get(target, key, receiver) {
    if (key === RAW) return target;
    if (key === META) return metas.get(target);
    if (typeof key === "symbol") return Reflect.get(target, key, receiver);
    const m = metas.get(target) as Meta;
    if (Array.isArray(target) && typeof key === "string" && ARRAY_MUTATORS.has(key)) {
      return (...args: unknown[]) => arrayOp(target as unknown[], m, key as ChangeOp, args);
    }
    const own = Object.prototype.hasOwnProperty.call(target, key);
    if (Array.isArray(target) && !own && typeof (target as unknown as Record<string, unknown>)[key] === "function") { m.version(); return Reflect.get(target, key, receiver); }
    sigOf(m, key, target)();
    if (Array.isArray(target) && key === "length") m.version();
    return wrap(target[key], m.root, [...m.path, String(key)]);
  },
  has(target, key) { (metas.get(target) as Meta).version(); return key in target; },
  ownKeys(target) { (metas.get(target) as Meta).version(); return Reflect.ownKeys(target); },
  set(target, key, value) {
    const m = metas.get(target) as Meta;
    const v = raw(value);
    const had = Object.prototype.hasOwnProperty.call(target, key);
    const old = target[key];
    if (had && old === v && !Array.isArray(target)) return true;
    target[key] = v;
    batch(() => {
      m.signals.get(key)?.set(v);
      if (!had || Array.isArray(target)) { m.version.set(0); m.signals.get("length")?.set((target as unknown as unknown[]).length); }
    });
    if (!inArrayOp && typeof key === "string") emit(m.root, { path: [...m.path, key].join("."), op: "set", value: v, old });
    return true;
  },
  deleteProperty(target, key) {
    if (!(key in target)) return true;
    const m = metas.get(target) as Meta;
    const old = target[key];
    delete target[key];
    batch(() => { m.signals.get(key)?.set(undefined); m.version.set(0); });
    if (typeof key === "string") emit(m.root, { path: [...m.path, key].join("."), op: "delete", old });
    return true;
  },
};

function arrayOp(arr: unknown[], m: Meta, op: ChangeOp, args: unknown[]): unknown {
  const before = arr.length;
  let result: unknown;
  inArrayOp++;
  try {
    result = batch(() => {
      const r = (Array.prototype[op as "push"] as (...a: unknown[]) => unknown).apply(arr, args.map(raw));
      for (const [k, s] of m.signals) if (k !== "length") s.set(arr[k as number]);
      m.signals.get("length")?.set(arr.length);
      m.version.set(0);
      return r;
    });
  } finally { inArrayOp--; }
  emit(m.root, { path: m.path.join("."), op, args, value: op === "push" || op === "unshift" ? args : result, old: before });
  return result;
}

const raw = <T>(v: T): T => ((v && typeof v === "object" && (v as Record<PropertyKey, unknown>)[RAW]) as T) || v;
const metaOfProxy = (p: object): Meta => {
  const m = (p as Record<PropertyKey, unknown>)[META] as Meta | undefined;
  if (!m) throw new TypeError("March: expected a store (or a nested object of a store).");
  return m;
};

// ------------------------------------------------------------------ public API
/** Create a store from a plain object or array. Nested objects/arrays become reactive lazily. */
export function store<T extends object>(initial: T): T {
  if (!isPlain(initial)) throw new TypeError("March: store() needs a plain object or array.");
  const root: Root = { listeners: new Set(), pending: null, log: DEV.enabled ? [] : null };
  return wrap(initial, root, []);
}

/** Deep-merge `partial` into a store node in one batch. Arrays and non-plain values are replaced. */
export function patch<T extends object>(target: T, partial: Partial<T> | Record<string, unknown>): T {
  batch(() => merge(target as Record<string, unknown>, partial as Record<string, unknown>));
  return target;
}
function merge(t: Record<string, unknown>, p: Record<string, unknown>): void {
  for (const k of Object.keys(p)) {
    const v = p[k];
    const cur = untrack(() => t[k]);
    if (isPlain(v) && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur)) merge(cur as Record<string, unknown>, v as Record<string, unknown>);
    else t[k] = v;
  }
}

/** The underlying plain object (no tracking, no events). */
export function unwrap<T>(s: T): T { return raw(s); }

/** Listen to every change at or below `node` (a store or any nested object/array of it). Returns unsubscribe. */
export function subscribe(node: object, fn: Listener): () => void {
  const m = metaOfProxy(node);
  const l = { prefix: m.path, pattern: null, fn };
  m.root.listeners.add(l);
  return () => m.root.listeners.delete(l);
}

/** Listen to a path (relative to `node`): "cart.items", "users.*.name", "logs.**". Type-checked against the store. */
export function on<T extends object, P extends Path<T>>(node: T, path: P, fn: (event: StoreEvent & { value?: PathValue<T, P> }) => void): () => void {
  const m = metaOfProxy(node);
  const pattern = [...m.path, ...String(path).split(".")];
  const l = { prefix: m.path, pattern, fn: fn as Listener };
  m.root.listeners.add(l);
  return () => m.root.listeners.delete(l);
}

/** A derived value (computed): `const total = derive(() => app.cart.items.reduce(…))`. */
export function derive<T>(fn: () => T): () => T { return computed(fn) as unknown as () => T; }

/** Deeply frozen plain copy of a store node (safe to keep, compare or serialize). */
export function snapshot<T>(node: T): Readonly<T> {
  const copy = structuredClone(untrack(() => raw(node)));
  return deepFreeze(copy) as Readonly<T>;
}
function deepFreeze<T>(v: T): T {
  if (v && typeof v === "object") { Object.freeze(v); for (const k of Object.keys(v)) deepFreeze((v as Record<string, unknown>)[k]); }
  return v;
}

/** Read-only view: reads stay reactive; writes throw. */
export function readonly<T extends object>(node: T): Readonly<T> {
  const r = raw(node);
  const hit = READONLY.get(r);
  if (hit) return hit as Readonly<T>;
  const p = new Proxy(node, {
    get(t, k, rec) { const v = Reflect.get(t, k, rec); return v && typeof v === "object" && (v as Record<PropertyKey, unknown>)[RAW] ? readonly(v as object) : v; },
    set(_t, k) { throw new TypeError(`March: store is read-only here (tried to set "${String(k)}").`); },
    deleteProperty(_t, k) { throw new TypeError(`March: store is read-only here (tried to delete "${String(k)}").`); },
  });
  READONLY.set(r, p);
  return p as Readonly<T>;
}

/** Save a store node to localStorage (debounced) and load it back now. Errors (private mode, quota) are ignored. */
export function persist<T extends object>(node: T, key: string, { storage = globalThis.localStorage, delay = 200 }: { storage?: Storage; delay?: number } = {}): () => void {
  try {
    const saved = storage?.getItem(key);
    if (saved) patch(node, JSON.parse(saved) as Record<string, unknown>);
  } catch { /* unreadable: start from defaults */ }
  let t: ReturnType<typeof setTimeout> | null = null;
  const off = subscribe(node, () => {
    if (t) clearTimeout(t);
    t = setTimeout(() => { try { storage?.setItem(key, JSON.stringify(raw(node))); } catch { /* storage blocked or full */ } }, delay);
  });
  return () => { off(); if (t) clearTimeout(t); };
}

export interface History { undo(): void; redo(): void; canUndo(): boolean; canRedo(): boolean; clear(): void; dispose(): void }
/** Undo/redo for a store node (snapshot per change group). */
export function history<T extends object>(node: T, { limit = 100 }: { limit?: number } = {}): History {
  const past: unknown[] = [structuredClone(raw(node))];
  const future: unknown[] = [];
  const ver = mkSig(0);
  let applying = false;
  const off = subscribe(node, () => {
    if (applying) return;
    past.push(structuredClone(raw(node)));
    if (past.length > limit + 1) past.shift();
    future.length = 0;
    ver.set(0);
  });
  const restore = (state: unknown): void => {
    applying = true;
    try {
      batch(() => {
        const t = node as Record<string, unknown>;
        if (Array.isArray(t) && Array.isArray(state)) { (t as unknown[]).splice(0, (t as unknown[]).length, ...(state as unknown[])); return; }
        for (const k of Object.keys(raw(t))) if (!(k in (state as object))) delete t[k];
        for (const [k, v] of Object.entries(state as object)) t[k] = structuredClone(v);
      });
    } finally { applying = false; }
    ver.set(0);
  };
  return {
    undo() { if (past.length < 2) return; future.push(past.pop()); restore(past[past.length - 1]); },
    redo() { const s = future.pop(); if (s === undefined) return; past.push(s); restore(s); },
    canUndo: () => { ver(); return past.length > 1; },
    canRedo: () => { ver(); return future.length > 0; },
    clear() { past.splice(0, past.length, structuredClone(raw(node))); future.length = 0; ver.set(0); },
    dispose: off,
  };
}

/** Development change log of a store (last 1000 changes; empty in production). */
export function storeLog(node: object): readonly Change[] { return metaOfProxy(node).root.log ?? []; }
