// HADI March — fine-grained reactive core.
// Push-pull graph (dirty / check marking, lazy pull), glitch free, synchronous by default; `batch` defers effects.
// Ownership tree: every computation created while another one runs is owned by it and disposed when the owner re-runs or
// is disposed, together with its `onCleanup` callbacks. That is how listeners, timers and requests clean up automatically.

const CLEAN = 0, CHECK = 1, DIRTY = 2;

/** @type {Computation|null} */ let Listener = null;
/** @type {Owner|null} */ let Owner = null;
let batchDepth = 0;
/** @type {Computation[]} */ let queue = [];
let flushing = false;
export const DEV = { warn: (...a) => console.warn("[march]", ...a), enabled: true };

class Owner_ {
  constructor(parent) {
    this.parent = parent;
    this.owned = null;
    this.cleanups = null;
    this.context = null;
    this.disposed = false;
  }
}
/** @typedef {Owner_} Owner */

class Computation extends Owner_ {
  constructor(fn, value, effect, parent) {
    super(parent);
    this.fn = fn;
    this.value = value;
    this.effect = effect;
    this.state = DIRTY;
    this.sources = null; // Set<Signal|Computation>
    this.observers = null; // Set<Computation>
    this.equals = Object.is;
  }
}

class SignalNode {
  constructor(value, equals) {
    this.value = value;
    this.observers = null;
    this.equals = equals === false ? () => false : equals ?? Object.is;
  }
}

function track(node) {
  if (!Listener) return;
  (Listener.sources ??= new Set()).add(node);
  (node.observers ??= new Set()).add(Listener);
}

function markObservers(node, state) {
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

function cleanNode(c) {
  if (c.sources) {
    for (const s of c.sources) s.observers?.delete(c);
    c.sources = null;
  }
  disposeChildren(c);
}

function disposeChildren(o) {
  if (o.owned) {
    for (let i = o.owned.length - 1; i >= 0; i--) disposeOwner(o.owned[i]);
    o.owned = null;
  }
  if (o.cleanups) {
    const cs = o.cleanups;
    o.cleanups = null;
    for (let i = cs.length - 1; i >= 0; i--) {
      try { cs[i](); } catch (e) { handleError(e, o.parent); }
    }
  }
}

function disposeOwner(o) {
  if (o.disposed) return;
  o.disposed = true;
  if (o instanceof Computation) {
    cleanNode(o);
    o.state = CLEAN;
    if (o.observers) for (const x of o.observers) x.sources?.delete(o);
    o.observers = null;
  } else disposeChildren(o);
}

function adopt(o) {
  if (Owner) (Owner.owned ??= []).push(o);
}

/** Bring a computation up to date (pull). */
function update(c) {
  if (c.disposed) return;
  if (c.state === CHECK) {
    for (const s of c.sources ?? []) {
      if (s instanceof Computation) {
        update(s);
        if (c.state === DIRTY) break;
      }
    }
  }
  if (c.state === DIRTY) {
    c.state = CLEAN; // a write during run() marks it dirty again and re-queues it
    run(c);
  } else c.state = CLEAN;
}

function run(c) {
  cleanNode(c);
  const prevL = Listener, prevO = Owner;
  Listener = c; Owner = c;
  let next;
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
    if (c.observers) for (const o of c.observers) o.state = DIRTY, o.effect && queueOnce(o), !o.effect && markObservers(o, CHECK);
  } else c.value = next;
}

function queueOnce(o) { if (!queue.includes(o)) queue.push(o); }

function flush() {
  if (flushing || batchDepth) return;
  flushing = true;
  try {
    for (let i = 0; i < queue.length; i++) {
      const e = queue[i];
      if (e.state !== CLEAN && !e.disposed) update(e);
      if (i > 100_000) throw new Error("March: effect loop did not settle (an effect keeps writing a signal it reads).");
    }
  } finally {
    queue = [];
    flushing = false;
  }
}

/** Mark as reactive accessor so `h()` and component props treat it as live. */
const REACTIVE = Symbol.for("hm.reactive");
export const isReactive = (v) => typeof v === "function" && v[REACTIVE] === true;
/** Tag a function as a reactive accessor (compiler output and h() users). */
export function reactive(fn) {
  fn[REACTIVE] = true;
  return fn;
}

/**
 * Create a signal. Read: `count()`. Write: `count.set(v)`, `count.update(fn)`. Read without tracking: `count.peek()`.
 * @template T @param {T} value @param {{equals?: false|((a:T,b:T)=>boolean), name?: string}} [opts]
 */
export function signal(value, opts) {
  const node = new SignalNode(value, opts?.equals);
  const read = () => { track(node); return node.value; };
  read.peek = () => node.value;
  read.set = (v) => {
    if (Listener && Listener.fn && !Listener.effect && DEV.enabled) DEV.warn(`writing signal${opts?.name ? ` "${opts.name}"` : ""} inside computed() is not allowed; use an effect.`);
    if (node.equals(node.value, v)) return v;
    node.value = v;
    markObservers(node, DIRTY);
    flush();
    return v;
  };
  read.update = (fn) => read.set(fn(node.value));
  read[REACTIVE] = true;
  read.signal = true;
  if (opts?.name) read.displayName = opts.name;
  return read;
}

/** Derived value, cached; recomputed lazily when a dependency changes. */
export function computed(fn, opts) {
  const c = new Computation(fn, undefined, false, Owner);
  if (opts?.equals === false) c.equals = () => false;
  else if (opts?.equals) c.equals = opts.equals;
  adopt(c);
  const read = () => {
    if (c.state !== CLEAN) update(c);
    track(c);
    return c.value;
  };
  read.peek = () => { if (c.state !== CLEAN) update(c); return c.value; };
  read[REACTIVE] = true;
  return read;
}

/** Run `fn` now and again whenever a signal it read changes. Returns a disposer. */
export function effect(fn) {
  const c = new Computation(fn, undefined, true, Owner);
  adopt(c);
  if (batchDepth) queue.push(c);
  else { c.state = CLEAN; run(c); flush(); }
  return () => disposeOwner(c);
}

/** Group writes; effects run once at the end. Returns `fn()`'s value. */
export function batch(fn) {
  batchDepth++;
  try { return fn(); } finally { if (--batchDepth === 0) flush(); }
}

/** Read signals without subscribing. */
export function untrack(fn) {
  const prev = Listener;
  Listener = null;
  try { return fn(); } finally { Listener = prev; }
}

/** Register a callback that runs when the current owner (component, effect, root) is disposed or re-runs. */
export function onCleanup(fn) {
  if (Owner) (Owner.cleanups ??= []).push(fn);
  else if (DEV.enabled) DEV.warn("onCleanup() called outside a component or effect; it will never run.");
  return fn;
}

/** Create an independent ownership root. `fn(dispose)`. */
export function createRoot(fn, parent = Owner) {
  const root = new Owner_(parent);
  const prevO = Owner, prevL = Listener;
  Owner = root; Listener = null;
  try { return batch(() => fn(() => disposeOwner(root))); } finally { Owner = prevO; Listener = prevL; }
}

export const getOwner = () => Owner;

// Async components: the compiler rewrites `await x` to `_enter(owner, await _leave(x))` so code after an await runs with the
// component's owner again (cleanups, context, error boundaries keep working). The owner is reset when the continuation ends.
export function _leave(value) { Owner = null; Listener = null; return value; }
export function _enter(owner, value) {
  Owner = owner; Listener = null;
  queueMicrotask(() => { if (Owner === owner) Owner = null; });
  return value;
}
/** Run `fn` with a previously captured owner (for async continuations). */
export function runWithOwner(owner, fn) {
  const prevO = Owner, prevL = Listener;
  Owner = owner; Listener = null;
  try { return fn(); } finally { Owner = prevO; Listener = prevL; }
}

// ------------------------------------------------------------------ errors
const ERROR = Symbol("hm.error");
function handleError(err, owner) {
  for (let o = owner; o; o = o.parent) {
    const h = o.context?.get(ERROR);
    if (h) { h(err); return; }
  }
  queueMicrotask(() => { throw err; });
}
/** Catch errors thrown by computations created inside `fn`. */
export function catchError(fn, handler) {
  const o = new Owner_(Owner);
  adopt(o);
  (o.context = new Map()).set(ERROR, handler);
  return runWithOwnerTracked(o, fn);
}
function runWithOwnerTracked(o, fn) {
  const prevO = Owner;
  Owner = o;
  try { return fn(); } catch (e) { handleError(e, o); return undefined; } finally { Owner = prevO; }
}
export { handleError as reportError };

// ------------------------------------------------------------------ context
/** @template T @param {T} [defaultValue] */
export function context(defaultValue) {
  const id = Symbol("hm.context");
  const ctx = { id, defaultValue };
  /** Provider component: `<Ctx.Provider value={v}>…</Ctx.Provider>`. */
  ctx.Provider = (props) => {
    provide(ctx, props.value);
    const c = props.children;
    return typeof c === "function" && !c.length ? c() : c;
  };
  return ctx;
}
/** Provide a context value for everything created after this call in the current owner. */
export function provide(ctx, value) {
  if (!Owner) throw new Error("March: provide() must run inside a component or root.");
  (Owner.context ??= new Map()).set(ctx.id, value);
}
/** Read the nearest provided value (or the default). */
export function useContext(ctx) {
  for (let o = Owner; o; o = o.parent) if (o.context?.has(ctx.id)) return o.context.get(ctx.id);
  return ctx.defaultValue;
}

/** Read a value that may be a reactive accessor. */
export const read = (v) => (typeof v === "function" && v[REACTIVE] ? v() : v);

export const _internal = { Computation, disposeOwner };
