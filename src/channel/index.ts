// hadi-march/channel — typed messages between components that do not know each other.
//
//   export const ch = defineChannels({                       // channels.ts: every name and payload in one place
//     "cart.changed": of<{ count: number }>({ sticky: true }),
//     "cart.cleared": of<void>(),
//   });
//   ch["cart.changed"].emit({ count: 3 });                   // wrong name or payload = compile error
//   ch["cart.changed"].on((p) => …);                         // removed with the owning component (onCleanup)
//   ch.on("cart.*", (m) => m.name …);                         // wildcard, typed union of the matching messages
//
// A channel carries EVENTS (something happened). State that many parts read belongs in a store or a signal; a sticky
// channel only remembers the last event so a late (lazy) listener can catch up.
//
// Costs: an emit with sync listeners allocates nothing (listener lists are copied on subscribe, not on emit); wildcard
// listeners, async delivery, replay buffers and the dev traffic log allocate only when used.
import { signal, onCleanup, getOwner, useContext, provide, context, reportError, DEV, type Accessor, type Signal, type Owner } from "../core/reactive.ts";

// ------------------------------------------------------------------ types
export interface ChannelOptions {
  /** Keep the last message; a listener that subscribes later gets it at once (same as `replay: 1`). */
  sticky?: boolean;
  /** Keep the last n messages; a late listener gets them at once, oldest first. */
  replay?: number;
  /** Also deliver to the other tabs of this origin (BroadcastChannel; payload must be structured-cloneable). */
  crossTab?: boolean;
  /** Deliver to every listener in a microtask instead of during emit(). */
  async?: boolean;
  /** Resolve to the nearest <ChannelScope> (falls back to the app-wide bus outside a scope). */
  scoped?: boolean;
}
export interface ListenOptions {
  /** Higher runs first (default 0); equal priorities run in subscribe order. */
  priority?: number;
  /** Deliver to this listener in a microtask. */
  async?: boolean;
  /** false: do not receive the sticky / replayed messages on subscribe. */
  replay?: boolean;
}
/** Where a message came from. */
export type Origin = "local" | "tab";
export interface Message<T = unknown, N extends string = string> { name: N; payload: T; from: Origin }
export type Listener<T> = (payload: T, from: Origin) => void;

export interface Channel<T> {
  readonly name: string;
  readonly options: Readonly<ChannelOptions>;
  emit(...payload: [T] extends [void] ? [] | [T] : [T]): void;
  /** Subscribe; inside a component the listener is removed with it. Returns an unsubscribe function. */
  on(fn: Listener<T>, opts?: ListenOptions): () => void;
  /** Next message only (a sticky / replayed one counts). Without a function: a promise of it. */
  once(fn: Listener<T>, opts?: ListenOptions): () => void;
  once(): Promise<T>;
  off(fn: Listener<T>): void;
  /** Last message sent on this channel (undefined before the first). */
  last(): T | undefined;
  /** Kept messages (sticky / replay), oldest first. */
  history(): readonly T[];
  /** The last message as a signal (updates on every emit, even with an equal payload). */
  toSignal(): Accessor<T | undefined>;
  /** Number of listeners right now (devtools, tests). */
  listeners(): number;
}

/** A channel declaration for defineChannels(): `of<Payload>(options)`. */
export interface Spec<T> { readonly options: ChannelOptions; readonly payload?: (x: T) => T }
export function of<T = void>(options: ChannelOptions = {}): Spec<T> { return { options }; }

type PayloadOf<S> = S extends Spec<infer T> ? T : never;
type Prefixes<N extends string> = N extends `${infer A}.${infer B}` ? `${A}.` | `${A}.${Prefixes<B>}` : never;
/** Exact name, "prefix.*" or "*". */
export type ChannelPattern<N extends string> = N | `${Prefixes<N>}*` | "*";
type Matching<N extends string, P extends string> = P extends "*" ? N : P extends `${infer Pre}*` ? Extract<N, `${Pre}${string}`> : Extract<N, P>;
type MessageOf<M, N> = N extends keyof M & string ? Message<PayloadOf<M[N]>, N> : never;
export type Channels<M extends Record<string, Spec<any>>> = { readonly [K in keyof M & string]: Channel<PayloadOf<M[K]>> } & {
  /** Wildcard listener over this group: `on("cart.*", (m) => …)`, `m` is the union of the matching messages. */
  on<P extends ChannelPattern<keyof M & string>>(pattern: P, fn: (m: MessageOf<M, Matching<keyof M & string, P>>) => void, opts?: ListenOptions): () => void;
};

// ------------------------------------------------------------------ buses and hubs
interface Sub { fn: (a: any, b?: any) => void; prio: number; async: boolean; once: boolean; owner: Owner | null; dead: boolean; prefix: string | null; exact: string | null }
const NONE: Sub[] = [];

class Hub {
  subs: Sub[] = NONE;
  has = false;
  last: unknown = undefined;
  buf: unknown[] | null = null; // ring buffer of kept messages
  head = 0;
  size = 0;
  sig: Signal<unknown> | null = null;
  readonly keep: number;
  readonly name: string;
  readonly opts: ChannelOptions;
  readonly bus: Bus;
  constructor(name: string, opts: ChannelOptions, bus: Bus) {
    this.name = name; this.opts = opts; this.bus = bus;
    this.keep = Math.max(opts.replay ?? 0, opts.sticky ? 1 : 0);
    if (this.keep) this.buf = new Array(this.keep);
  }
  kept(): unknown[] {
    const out: unknown[] = [];
    for (let i = 0; i < this.size; i++) out.push((this.buf as unknown[])[(this.head - this.size + i + this.keep) % this.keep]);
    return out;
  }
}

class Bus {
  hubs = new Map<string, Hub>();
  wild: Sub[] = NONE;
  readonly label: string;
  constructor(label: string) { this.label = label; }
  hub(name: string, opts: ChannelOptions): Hub {
    let h = this.hubs.get(name);
    if (!h) {
      this.hubs.set(name, (h = new Hub(name, opts, this)));
      if (opts.crossTab && this === GLOBAL) joinTabs(h);
    } else if (DEV.enabled && h.opts !== opts && !sameOpts(h.opts, opts)) DEV.warn(`channel "${name}" is declared twice with different options; the first wins.`);
    return h;
  }
}
const sameOpts = (a: ChannelOptions, b: ChannelOptions): boolean =>
  !!a.sticky === !!b.sticky && (a.replay ?? 0) === (b.replay ?? 0) && !!a.crossTab === !!b.crossTab && !!a.async === !!b.async && !!a.scoped === !!b.scoped;

const GLOBAL = new Bus("app");
let scopes = 0;
const BUS = context<Bus | null>(null);

/**
 * Start a channel scope in the current component: `scoped` channels used below it (and in it) get their own messages,
 * listeners and sticky values, so two copies of a widget do not hear each other.
 */
export function channelScope(label?: string): void { provide(BUS, new Bus(label ?? `scope ${++scopes}`)); }
/** `<ChannelScope>…</ChannelScope>`: channelScope() for a subtree. */
export function ChannelScope(props: { label?: string; children?: unknown }): unknown {
  channelScope(props.label);
  const c = props.children;
  return typeof c === "function" && !c.length ? (c as () => unknown)() : c;
}

// ------------------------------------------------------------------ delivery
let onError: ((error: unknown, info: { channel: string; scope: string }) => void) | null = null;
/**
 * Where listener errors go. A failing listener never stops the others. Without a handler the error goes to the
 * listener's own error boundary (catchError / <Try>), else it is rethrown in a microtask. The errors module plugs in here.
 */
export function setChannelErrorHandler(fn: typeof onError): void { onError = fn; }

function fail(e: unknown, sub: Sub | null, hub: Hub): void {
  if (onError) { try { onError(e, { channel: hub.name, scope: hub.bus.label }); return; } catch (e2) { e = e2; } }
  reportError(e, sub?.owner ?? null);
}

function call(sub: Sub, hub: Hub, a: unknown, b: unknown): void {
  if (sub.dead) return;
  if (sub.once) remove(hub, sub);
  try { sub.fn(a, b); } catch (e) { fail(e, sub, hub); }
}
function deliver(sub: Sub, hub: Hub, a: unknown, b: unknown, async: boolean): void {
  if (async || sub.async) queueMicrotask(() => call(sub, hub, a, b));
  else call(sub, hub, a, b);
}

let depth = 0;
function send(hub: Hub, payload: unknown, from: Origin): void {
  if (depth > 100) { fail(new Error(`March: channel "${hub.name}" emits in a loop (listeners keep emitting).`), null, hub); return; }
  hub.last = payload; hub.has = true;
  if (hub.buf) { hub.buf[hub.head] = payload; hub.head = (hub.head + 1) % hub.keep; if (hub.size < hub.keep) hub.size++; }
  const list = hub.subs, wild = hub.bus.wild, async = !!hub.opts.async;
  if (traffic) record(hub, payload, from, list.length);
  depth++;
  try {
    for (let i = 0; i < list.length; i++) deliver(list[i] as Sub, hub, payload, from, async);
    if (wild.length) {
      let msg: Message | null = null;
      for (let i = 0; i < wild.length; i++) {
        const s = wild[i] as Sub;
        if (matches(s, hub.name)) deliver(s, hub, (msg ??= { name: hub.name, payload, from }), undefined, async);
      }
    }
    hub.sig?.set(payload);
  } finally { depth--; }
  if (from === "local" && hub.opts.crossTab && hub.bus === GLOBAL) post(hub, { n: hub.name, p: payload });
}

const matches = (s: Sub, name: string): boolean => s.exact !== null ? s.exact === name : s.prefix === "" || name.startsWith(s.prefix as string);

function add(list: Sub[], sub: Sub): Sub[] {
  let i = list.length;
  while (i > 0 && (list[i - 1] as Sub).prio < sub.prio) i--;
  const next = list.slice();
  next.splice(i, 0, sub);
  return next;
}
function remove(hub: Hub, sub: Sub): void {
  if (sub.dead) return;
  sub.dead = true;
  if (sub.exact === null && sub.prefix === null) hub.subs = hub.subs.filter((s) => s !== sub);
  else hub.bus.wild = hub.bus.wild.filter((s) => s !== sub);
}

function subscribe(hub: Hub, fn: Sub["fn"], o: ListenOptions | undefined, once: boolean): () => void {
  const sub: Sub = { fn, prio: o?.priority ?? 0, async: !!o?.async, once, owner: getOwner(), dead: false, prefix: null, exact: null };
  if (hub.size && o?.replay !== false) {
    // a late listener catches up: the kept messages, oldest first (once: only the newest)
    const kept = hub.kept();
    if (once) { deliver(sub, hub, kept[kept.length - 1], "local", !!hub.opts.async); return () => {}; }
    for (const p of kept) deliver(sub, hub, p, "local", !!hub.opts.async);
  }
  hub.subs = add(hub.subs, sub);
  const off = () => remove(hub, sub);
  if (sub.owner) onCleanup(off);
  return off;
}

// ------------------------------------------------------------------ channels
class ChannelImpl<T> implements Channel<T> {
  readonly name: string;
  readonly options: Readonly<ChannelOptions>;
  private readonly bus: Bus | null;
  constructor(name: string, options: Readonly<ChannelOptions>, bus: Bus | null = null) {
    this.name = name; this.options = options; this.bus = bus;
    // a crossTab channel listens to the other tabs from its declaration on (last() stays current, a new tab catches up)
    if (options.crossTab && !options.scoped) GLOBAL.hub(name, options);
  }
  private hub(): Hub {
    const bus = this.bus ?? (this.options.scoped ? useContext(BUS) ?? GLOBAL : GLOBAL);
    return bus.hub(this.name, this.options);
  }
  emit(...payload: [T] extends [void] ? [] | [T] : [T]): void { send(this.hub(), payload[0], "local"); }
  on(fn: Listener<T>, opts?: ListenOptions): () => void { return subscribe(this.hub(), fn, opts, false); }
  once(fn?: Listener<T>, opts?: ListenOptions): any {
    if (fn) return subscribe(this.hub(), fn, opts, true);
    const hub = this.hub();
    return new Promise<T>((resolve) => { subscribe(hub, resolve as Sub["fn"], undefined, true); });
  }
  off(fn: Listener<T>): void { const hub = this.hub(); for (const s of hub.subs) if (s.fn === fn) remove(hub, s); }
  last(): T | undefined { return this.hub().last as T | undefined; }
  history(): readonly T[] { return this.hub().kept() as T[]; }
  toSignal(): Accessor<T | undefined> { const hub = this.hub(); return (hub.sig ??= signal(hub.last, { equals: false, name: this.name })) as Accessor<T | undefined>; }
  listeners(): number { return this.hub().subs.length; }
}

/** One channel: `const cartChanged = channel<{ count: number }>("cart.changed", { sticky: true })`. */
export function channel<T = void>(name: string, options: ChannelOptions = {}): Channel<T> { return new ChannelImpl<T>(name, options); }

/**
 * Bind a scoped channel to the scope of the current component. Call it during setup and use the handle in event
 * handlers and timers (they run without an owner and would otherwise reach the app-wide bus).
 */
export function useChannel<T>(ch: Channel<T>): Channel<T> {
  const bus = ch.options.scoped ? useContext(BUS) ?? GLOBAL : GLOBAL;
  return new ChannelImpl<T>(ch.name, ch.options, bus);
}

/** Wildcard listener on the current bus: "cart.*", "*" or an exact name. Untyped; prefer the group's `on`. */
export function onChannels(pattern: string, fn: (m: Message) => void, opts?: ListenOptions): () => void {
  const bus = useContext(BUS) ?? GLOBAL;
  const star = pattern.endsWith("*");
  const sub: Sub = { fn, prio: opts?.priority ?? 0, async: !!opts?.async, once: false, owner: getOwner(), dead: false, prefix: star ? pattern.slice(0, -1) : null, exact: star ? null : pattern };
  bus.wild = add(bus.wild, sub);
  // a fake hub only to reach remove(): wildcard subs live on the bus
  const off = () => remove({ bus, subs: NONE } as unknown as Hub, sub);
  if (sub.owner) onCleanup(off);
  return off;
}

/** Declare every channel of an app in one place (channels.ts). Names and payloads are checked at compile time. */
export function defineChannels<M extends Record<string, Spec<any>>>(spec: M): Channels<M> {
  const out: Record<string, unknown> = {};
  for (const name of Object.keys(spec)) out[name] = new ChannelImpl(name, (spec[name] as Spec<unknown>).options);
  out["on"] = (pattern: string, fn: (m: Message) => void, opts?: ListenOptions) => onChannels(pattern, fn, opts);
  return out as Channels<M>;
}

// ------------------------------------------------------------------ across tabs
// One BroadcastChannel for the whole app. Wire format: { n: name, p: payload } (a message), { n, q: 1 } (a new tab asks
// for the last value of a sticky channel), { n, p, r: 1 } (an answer; ignored once this tab has a value).
const TAB_NAME = "hadi-march:channels";
let bc: BroadcastChannel | null | undefined;
function tabs(): BroadcastChannel | null {
  if (bc === undefined) {
    const BC = (globalThis as { BroadcastChannel?: typeof BroadcastChannel }).BroadcastChannel;
    bc = BC ? new BC(TAB_NAME) : null;
    if (bc) bc.onmessage = (e: MessageEvent) => fromTab(e.data);
  }
  return bc;
}
function post(hub: Hub, data: object): void {
  const b = tabs();
  if (!b) return;
  try { b.postMessage(data); } catch (e) { fail(e, null, hub); } // DataCloneError: functions, DOM nodes, class instances with private state…
}
function joinTabs(hub: Hub): void {
  if (tabs() && hub.keep) post(hub, { n: hub.name, q: 1 });
}
function fromTab(d: unknown): void {
  if (!d || typeof d !== "object" || typeof (d as { n?: unknown }).n !== "string") return;
  const m = d as { n: string; p?: unknown; q?: 1; r?: 1 };
  const hub = GLOBAL.hubs.get(m.n);
  if (!hub || !hub.opts.crossTab) return;
  if (m.q) { if (hub.has) post(hub, { n: hub.name, p: hub.last, r: 1 }); return; }
  if (m.r && hub.has) return;
  send(hub, m.p, "tab");
}
/** Tests: forget the BroadcastChannel (a new global mock is picked up on next use). */
export function resetChannelTabs(): void { bc?.close(); bc = undefined; }

// ------------------------------------------------------------------ dev traffic log (devtools)
export interface TrafficEntry { seq: number; time: number; name: string; payload: unknown; from: Origin; scope: string; listeners: number }
let traffic = DEV.enabled;
let trafficSize = 200;
let seq = 0;
const log: TrafficEntry[] = [];
const watchers = new Set<(e: TrafficEntry) => void>();
function record(hub: Hub, payload: unknown, from: Origin, listeners: number): void {
  const e: TrafficEntry = { seq: ++seq, time: Date.now(), name: hub.name, payload, from, scope: hub.bus.label, listeners: listeners + hub.bus.wild.length };
  log.push(e);
  if (log.length > trafficSize) log.splice(0, log.length - trafficSize);
  for (const w of watchers) { try { w(e); } catch (err) { reportError(err, null); } }
}

/** Dev tools: recent messages, live watch, channel table. On while DEV.enabled; `configure({ enabled, size })`. */
export const channelDevtools = {
  traffic: (): readonly TrafficEntry[] => log.slice(),
  /** Call `fn` for every message from now on; returns the unsubscribe function (removed with the component). */
  watch(fn: (e: TrafficEntry) => void): () => void {
    watchers.add(fn);
    const off = () => { watchers.delete(fn); };
    if (getOwner()) onCleanup(off);
    return off;
  },
  clear(): void { log.length = 0; },
  configure(o: { enabled?: boolean; size?: number }): void {
    if (o.enabled !== undefined) traffic = o.enabled;
    if (o.size !== undefined) { trafficSize = Math.max(0, o.size); if (log.length > trafficSize) log.splice(0, log.length - trafficSize); }
  },
  /** The app-wide channels: name, options, listener count, last message, kept messages. */
  channels: () => [...GLOBAL.hubs.values()].map((h) => ({ name: h.name, options: h.opts, listeners: h.subs.length, last: h.last, kept: h.kept() })),
  wildcards: (): number => GLOBAL.wild.length,
};
