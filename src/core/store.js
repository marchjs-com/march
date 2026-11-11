// Nested reactive objects. Each property read is tracked separately: changing `state.user.name` only re-runs what read it.
// Write with plain assignment (`state.user.name = "x"`) or `patch(state, { user: { name: "x" } })` (deep merge, batched).
import { signal, batch, untrack } from "./reactive.js";

const RAW = Symbol("hm.raw");
const SIGNALS = Symbol("hm.signals");
const isPlain = (v) => v !== null && typeof v === "object" && (Array.isArray(v) || Object.getPrototypeOf(v) === Object.prototype || Object.getPrototypeOf(v) === null);
const proxies = new WeakMap();

function nodeOf(target, key) {
  const map = (target[SIGNALS] ??= new Map());
  let s = map.get(key);
  if (!s) { s = signal(target[key], { equals: false }); map.set(key, s); }
  return s;
}
function notify(target, key) {
  const s = target[SIGNALS]?.get(key);
  if (s) s.set(target[key]);
}
const VERSION = Symbol("hm.version");

function wrap(v) {
  if (!isPlain(v)) return v;
  let p = proxies.get(v);
  if (p) return p;
  Object.defineProperty(v, SIGNALS, { value: undefined, writable: true, enumerable: false, configurable: true });
  p = new Proxy(v, handler);
  proxies.set(v, p);
  return p;
}

const handler = {
  get(target, key, receiver) {
    if (key === RAW) return target;
    if (typeof key === "symbol") return Reflect.get(target, key, receiver);
    const own = Object.prototype.hasOwnProperty.call(target, key);
    if (Array.isArray(target) && typeof target[key] === "function" && !own) {
      nodeOf(target, VERSION)(); // any array method read depends on the whole array
      return Reflect.get(target, key, receiver);
    }
    nodeOf(target, key)();
    if (Array.isArray(target) && key === "length") nodeOf(target, VERSION)();
    return wrap(target[key]);
  },
  has(target, key) { nodeOf(target, VERSION)(); return key in target; },
  ownKeys(target) { nodeOf(target, VERSION)(); return Reflect.ownKeys(target); },
  set(target, key, value) {
    const v = value && value[RAW] ? value[RAW] : value;
    const had = Object.prototype.hasOwnProperty.call(target, key);
    if (had && target[key] === v && !Array.isArray(target)) return true;
    target[key] = v;
    batch(() => {
      notify(target, key);
      if (!had || Array.isArray(target)) { notify(target, VERSION); notify(target, "length"); }
    });
    return true;
  },
  deleteProperty(target, key) {
    if (!(key in target)) return true;
    delete target[key];
    batch(() => { notify(target, key); notify(target, VERSION); });
    return true;
  },
};

/** Create a reactive store from a plain object or array. */
export function store(initial) {
  if (!isPlain(initial)) throw new TypeError("March: store() needs a plain object or array.");
  return wrap(initial);
}

/** Deep-merge `partial` into a store in one batch. Arrays and non-plain values are replaced. */
export function patch(target, partial) {
  batch(() => merge(target, partial));
  return target;
}
function merge(t, p) {
  for (const k of Object.keys(p)) {
    const v = p[k];
    const cur = untrack(() => t[k]);
    if (isPlain(v) && !Array.isArray(v) && cur && typeof cur === "object" && !Array.isArray(cur)) merge(cur, v);
    else t[k] = v;
  }
}

/** The underlying plain object (no tracking). */
export const unwrap = (s) => (s && s[RAW]) || s;
