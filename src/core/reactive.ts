// HADI March — fine-grained reactive core (TypeScript).
// Push-pull graph (dirty / check marking, lazy pull), glitch free, synchronous by default; `batch` defers effects.
// Ownership tree: every computation created while another one runs is owned by it and disposed when the owner re-runs or
// is disposed, together with its `onCleanup` callbacks. That is how listeners, timers and requests clean up automatically.

const CLEAN = 0, CHECK = 1, DIRTY = 2;
type State = typeof CLEAN | typeof CHECK | typeof DIRTY;

export type Equals<T> = false | ((a: T, b: T) => boolean);
/** Read-only reactive value. */
export interface Accessor<T> { (): T; peek(): T }
/** Writable signal. */
export interface Signal<T> extends Accessor<T> { set(v: T): T; update(fn: (v: T) => T): T; readonly signal: true; displayName?: string }
export type Cleanup = () => void;

export const DEV: { enabled: boolean; warn: (...a: unknown[]) => void } = { warn: (...a) => console.warn("[march]", ...a), enabled: true };

class OwnerNode {
  owned: OwnerNode[] | null = null;
  cleanups: Cleanup[] | null = null;
  context: Map<symbol, unknown> | null = null;
  disposed = false;
  parent: OwnerNode | null;
  constructor(parent: OwnerNode | null) { this.parent = parent; }
}
/** Opaque owner handle (component branch, effect, root). */
export type Owner = OwnerNode;

interface Source { observers: Set<Computation> | null }

class Computation extends OwnerNode implements Source {
  state: State = DIRTY;
  sources: Set<Source> | null = null;
  observers: Set<Computation> | null = null;
  equals: (a: unknown, b: unknown) => boolean = Object.is;
  fn: (prev: unknown) => unknown;
  value: unknown;
  effect: boolean;
  constructor(fn: (prev: unknown) => unknown, value: unknown, effect: boolean, parent: OwnerNode | null) { super(parent); this.fn = fn; this.value = value; this.effect = effect; }
}

class SignalNode implements Source {
  observers: Set<Computation> | null = null;
  equals: (a: unknown, b: unknown) => boolean;
  value: unknown;
  constructor(value: unknown, equals?: Equals<unknown>) { this.value = value; this.equals = equals === false ? () => false : equals ?? Object.is; }
}

let Listener: Computation | null = null;
let Owner: OwnerNode | null = null;
let batchDepth = 0;
let queue: Computation[] = [];
let flushing = false;
let batchEnd: Array<() => void> = [];

function track(node: Source): void {
  if (!Listener) return;
  (Listener.sources ??= new Set()).add(node);
  (node.observers ??= new Set()).add(Listener);
}

function markObservers(node: Source, state: State): void {
  if (!node.observers) return;
  for (const o of node.observers) {
    if (o.state < state) {
      const was = o.state;
      o.state = state;
      if (o.effect) { if (was === CLEAN) queue.push(o); }
      else markObservers(o, CHECK);
    }
  }
}

function cleanNode(c: Computation): void {
  if (c.sources) {
    for (const s of c.sources) s.observers?.delete(c);
    c.sources = null;
  }
  disposeChildren(c);
}

function disposeChildren(o: OwnerNode): void {
  if (o.owned) {
    for (let i = o.owned.length - 1; i >= 0; i--) disposeOwner(o.owned[i] as OwnerNode);
    o.owned = null;
  }
  if (o.cleanups) {
    const cs = o.cleanups;
    o.cleanups = null;
    for (let i = cs.length - 1; i >= 0; i--) {
      try { (cs[i] as Cleanup)(); } catch (e) { handleError(e, o.parent); }
    }
  }
}

function disposeOwner(o: OwnerNode): void {
  if (o.disposed) return;
  o.disposed = true;
  if (o instanceof Computation) {
    cleanNode(o);
    o.state = CLEAN;
    if (o.observers) for (const x of o.observers) x.sources?.delete(o);
    o.observers = null;
  } else disposeChildren(o);
}

function adopt(o: OwnerNode): void { if (Owner) (Owner.owned ??= []).push(o); }

/** Bring a computation up to date (pull). */
function update(c: Computation): void {
  if (c.disposed) return;
  if (c.state === CHECK) {
    for (const s of c.sources ?? []) {
      if (s instanceof Computation) {
        update(s);
        if ((c.state as State) === DIRTY) break;
      }
    }
  }
  if (c.state === DIRTY) {
    c.state = CLEAN; // a write during run() marks it dirty again and re-queues it
    run(c);
  } else c.state = CLEAN;
}

function run(c: Computation): void {
  cleanNode(c);
  const prevL = Listener, prevO = Owner;
  Listener = c; Owner = c;
  let next: unknown;
  try {
    next = c.fn(c.value);
  } catch (e) {
    Listener = prevL; Owner = prevO;
    c.state = CLEAN;
    handleError(e, c);
    return;
  }
  Listener = prevL; Owner = prevO;
  if (!c.effect && !c.equals(c.value, next)) {
    c.value = next;
    if (c.observers) for (const o of c.observers) {
      o.state = DIRTY;
      if (o.effect) { if (!queue.includes(o)) queue.push(o); } else markObservers(o, CHECK);
    }
  } else c.value = next;
}

function flush(): void {
  if (flushing || batchDepth) return;
  flushing = true;
  try {
    for (let i = 0; i < queue.length; i++) {
      const e = queue[i] as Computation;
      if (e.state !== CLEAN && !e.disposed) update(e);
      if (i > 100_000) throw new Error("March: effect loop did not settle (an effect keeps writing a signal it reads).");
    }
  } finally {
    queue = [];
    flushing = false;
  }
}

const REACTIVE = Symbol.for("hm.reactive");
/** True for signals, computeds and compiler thunks (functions that should be treated as live values). */
export const isReactive = (v: unknown): v is (() => unknown) => typeof v === "function" && (v as unknown as Record<symbol, unknown>)[REACTIVE] === true;
/** Tag a function as a reactive accessor (compiler output and h() users). */
export function reactive<F extends (...a: never[]) => unknown>(fn: F): F {
  (fn as unknown as Record<symbol, unknown>)[REACTIVE] = true;
  return fn;
}

/** Create a signal. Read: `count()`. Write: `count.set(v)`, `count.update(fn)`. Read untracked: `count.peek()`. */
export function signal<T>(value: T, opts?: { equals?: Equals<T>; name?: string }): Signal<T> {
  const node = new SignalNode(value, opts?.equals as Equals<unknown> | undefined);
  const read = (() => { track(node); return node.value as T; }) as Signal<T>;
  const w = read as unknown as Record<string | symbol, unknown>;
  w["peek"] = () => node.value as T;
  w["set"] = (v: T): T => {
    if (Listener && !Listener.effect && DEV.enabled) DEV.warn(`writing signal${opts?.name ? ` "${opts.name}"` : ""} inside computed() is not allowed; use an effect.`);
    if (node.equals(node.value, v)) return v;
    node.value = v;
    markObservers(node, DIRTY);
    flush();
    return v;
  };
  w["update"] = (fn: (v: T) => T): T => read.set(fn(node.value as T));
  w[REACTIVE] = true;
  w["signal"] = true;
  if (opts?.name) w["displayName"] = opts.name;
  return read;
}

/** Derived value, cached; recomputed lazily when a dependency changes. */
export function computed<T>(fn: (prev: T | undefined) => T, opts?: { equals?: Equals<T> }): Accessor<T> {
  const c = new Computation(fn as (prev: unknown) => unknown, undefined, false, Owner);
  if (opts?.equals === false) c.equals = () => false;
  else if (opts?.equals) c.equals = opts.equals as (a: unknown, b: unknown) => boolean;
  adopt(c);
  const read = (() => {
    if (c.state !== CLEAN) update(c);
    track(c);
    return c.value as T;
  }) as Accessor<T>;
  (read as unknown as Record<string | symbol, unknown>)["peek"] = () => { if (c.state !== CLEAN) update(c); return c.value as T; };
  (read as unknown as Record<symbol, unknown>)[REACTIVE] = true;
  return read;
}

/** Run `fn` now and again whenever a signal it read changes. Returns a disposer. */
export function effect(fn: () => void): Cleanup {
  const c = new Computation(fn as (prev: unknown) => unknown, undefined, true, Owner);
  adopt(c);
  if (batchDepth) queue.push(c);
  else { c.state = CLEAN; run(c); flush(); }
  return () => disposeOwner(c);
}

/** Group writes; effects run once at the end. Returns `fn()`'s value. */
export function batch<T>(fn: () => T): T {
  batchDepth++;
  try { return fn(); } finally {
    if (--batchDepth === 0) {
      if (batchEnd.length) { const cbs = batchEnd; batchEnd = []; for (const cb of cbs) cb(); }
      flush();
    }
  }
}
/** True inside batch(). */
export const isBatching = (): boolean => batchDepth > 0;
/** Run `fn` when the outermost batch ends (immediately when not batching). */
export function afterBatch(fn: () => void): void { if (batchDepth > 0) batchEnd.push(fn); else fn(); }

/** Read signals without subscribing. */
export function untrack<T>(fn: () => T): T {
  const prev = Listener;
  Listener = null;
  try { return fn(); } finally { Listener = prev; }
}

/** Register a callback that runs when the current owner is disposed or re-runs. */
export function onCleanup(fn: Cleanup): Cleanup {
  if (Owner) (Owner.cleanups ??= []).push(fn);
  else if (DEV.enabled) DEV.warn("onCleanup() called outside a component or effect; it will never run.");
  return fn;
}

/** Create an independent ownership root. `fn(dispose)`. */
export function createRoot<T>(fn: (dispose: Cleanup) => T, parent: Owner | null = Owner): T {
  const root = new OwnerNode(parent);
  const prevO = Owner, prevL = Listener;
  Owner = root; Listener = null;
  try { return batch(() => fn(() => disposeOwner(root))); } finally { Owner = prevO; Listener = prevL; }
}

export const getOwner = (): Owner | null => Owner;
/** Run `fn` with a previously captured owner (async continuations). */
export function runWithOwner<T>(owner: Owner | null, fn: () => T): T {
  const prevO = Owner, prevL = Listener;
  Owner = owner; Listener = null;
  try { return fn(); } finally { Owner = prevO; Listener = prevL; }
}

// Async components: the compiler rewrites `await x` to `_enter(owner, await _leave(x))` so code after an await runs with
// the component's owner again. The owner is reset when the continuation ends.
// _leave does not touch the owner: when an async function is called without being awaited, the caller keeps running
// synchronously after the inner `await` and must keep its own owner. The continuation restores its owner via _enter.
export function _leave<T>(value: T): T { return value; }
export function _enter<T>(owner: Owner | null, value: T): T {
  Owner = owner; Listener = null;
  queueMicrotask(() => { if (Owner === owner) Owner = null; });
  return value;
}

// ------------------------------------------------------------------ errors
const ERROR = Symbol("hm.error");
function handleError(err: unknown, owner: OwnerNode | null): void {
  for (let o = owner; o; o = o.parent) {
    const h = o.context?.get(ERROR) as ((e: unknown) => void) | undefined;
    if (h) { h(err); return; }
  }
  queueMicrotask(() => { throw err; });
}
/** Catch errors thrown by computations created inside `fn`. */
export function catchError<T>(fn: () => T, handler: (e: unknown) => void): T | undefined {
  const o = new OwnerNode(Owner);
  adopt(o);
  (o.context = new Map()).set(ERROR, handler);
  const prevO = Owner;
  Owner = o;
  try { return fn(); } catch (e) { handleError(e, o); return undefined; } finally { Owner = prevO; }
}
export { handleError as reportError };

// ------------------------------------------------------------------ context
export interface Context<T> { id: symbol; defaultValue: T; Provider: (props: { value: T; children?: unknown }) => unknown }
export function context<T>(defaultValue?: T): Context<T> {
  const id = Symbol("hm.context");
  const ctx: Context<T> = {
    id, defaultValue: defaultValue as T,
    Provider: (props) => {
      provide(ctx, props.value);
      const c = props.children;
      return typeof c === "function" && !c.length ? (c as () => unknown)() : c;
    },
  };
  return ctx;
}
/** Provide a context value for everything created after this call in the current owner. */
export function provide<T>(ctx: { id: symbol }, value: T): void {
  if (!Owner) throw new Error("March: provide() must run inside a component or root.");
  (Owner.context ??= new Map()).set(ctx.id, value);
}
/** Read the nearest provided value (or the default). */
export function useContext<T>(ctx: { id: symbol; defaultValue: T }): T {
  for (let o = Owner; o; o = o.parent) if (o.context?.has(ctx.id)) return o.context.get(ctx.id) as T;
  return ctx.defaultValue;
}

/** Read a value that may be a reactive accessor. */
export const read = <T>(v: T | (() => T)): T => (isReactive(v) ? (v as () => T)() : (v as T));

export const _internal = { Computation, disposeOwner };
