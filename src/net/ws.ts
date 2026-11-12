// Managed WebSocket: reconnect with jittered backoff, heartbeat, topic subscriptions that are renewed after a
// reconnect, request / response by correlation id, an offline send queue, typed messages and (optionally) one
// connection shared by every tab (Web Locks elect a leader, BroadcastChannel relays).
//
//   const sock = socket<ServerMsg, ClientMsg>("ws:/live", { heartbeat: { interval: 25_000 } });
//   sock.subscribe("users", (m) => …);          sock.on("notice", (m) => …);
//   const reply = await sock.request({ type: "ping" });          sock.state()  // "connecting" | "open" | …
import { signal, type Signal } from "../core/reactive.ts";
import { AppError, emitError } from "../errors/app-error.ts";
import { resolveUrl } from "./transport.ts";
import type { Ctx, NetResponse, Transport } from "./core.ts";

export type SocketState = "idle" | "connecting" | "open" | "reconnecting" | "closed";

/** The minimum of a WebSocket that ManagedSocket needs (the mock provider implements it too). */
export interface SocketLike {
  readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: (() => void) | null;
  onclose: ((e: { code?: number; reason?: string }) => void) | null;
  onmessage: ((e: { data: unknown }) => void) | null;
  onerror: (() => void) | null;
}
export type SocketFactory = (url: string, protocols?: string | string[]) => SocketLike;

/** How messages map to topics and replies. The default speaks JSON:
 *  client → `{ type: "sub" | "unsub", topic }`, `{ …msg, id }` for requests, `{ type: "ping" }` heartbeat;
 *  server → `{ topic, data }` for topic messages, `{ re: id, data | error }` for replies, `{ type }` otherwise. */
export interface SocketProtocol {
  encode(msg: unknown): string;
  decode(raw: unknown): unknown;
  sub(topic: string): unknown;
  unsub(topic: string): unknown;
  ping(): unknown;
  isPong(msg: unknown): boolean;
  topicOf(msg: unknown): string | undefined;
  withId(msg: unknown, id: string): unknown;
  replyTo(msg: unknown): { id: string; data?: unknown; error?: unknown } | undefined;
  typeOf(msg: unknown): string | undefined;
}
type Rec = Record<string, unknown>;
/** WebSocket message protocol: JSON encode/decode (non-JSON frames pass through). */
export const jsonProtocol: SocketProtocol = {
  encode: (m) => JSON.stringify(m),
  decode: (raw) => { try { return JSON.parse(String(raw)) as unknown; } catch { return raw; } },
  sub: (topic) => ({ type: "sub", topic }),
  unsub: (topic) => ({ type: "unsub", topic }),
  ping: () => ({ type: "ping" }),
  isPong: (m) => (m as Rec | null)?.["type"] === "pong",
  topicOf: (m) => { const t = (m as Rec | null)?.["topic"]; return typeof t === "string" ? t : undefined; },
  withId: (m, id) => ({ ...(m as Rec), id }),
  replyTo: (m) => { const re = (m as Rec | null)?.["re"]; return typeof re === "string" ? { id: re, data: (m as Rec)["data"], error: (m as Rec)["error"] } : undefined; },
  typeOf: (m) => { const t = (m as Rec | null)?.["type"]; return typeof t === "string" ? t : undefined; },
};

export interface SocketOptions {
  protocols?: string | string[];
  protocol?: Partial<SocketProtocol>;
  /** Reconnect backoff (ms): min * factor^n, capped at max, ±jitter (0..1). `false` = never reconnect. */
  reconnect?: { min?: number; max?: number; factor?: number; jitter?: number } | false;
  /** Send `ping` every `interval` ms; no message for `timeout` ms closes and reconnects. */
  heartbeat?: { interval?: number; timeout?: number } | false;
  /** Request timeout (ms). */
  requestTimeout?: number;
  /** Messages sent while not connected wait here (max). 0 = throw instead. */
  queue?: number;
  /** One connection for every tab of this origin (Web Locks + BroadcastChannel; falls back to one per tab). */
  shared?: boolean;
  /** Connect at once (default) or on the first send / subscribe. */
  lazy?: boolean;
  factory?: SocketFactory;
}

type Handler<T> = (msg: T) => void;
const OPEN = 1;

/** Jittered exponential backoff. */
export function backoff(n: number, o: { min?: number; max?: number; factor?: number; jitter?: number } = {}): number {
  const base = Math.min(o.max ?? 30_000, (o.min ?? 500) * (o.factor ?? 2) ** n);
  const j = o.jitter ?? 0.3;
  return Math.round(base * (1 - j + Math.random() * 2 * j));
}

let defaultFactory: SocketFactory | null = null;
/** Replace how sockets are created (the mock provider installs itself here). `null` = real WebSocket. */
export function setSocketFactory(f: SocketFactory | null): void { defaultFactory = f; }

let rid = 0;
const newId = (): string => (globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${(++rid).toString(36)}-${Math.random().toString(36).slice(2, 8)}`);

/** A managed WebSocket. `In` = messages from the server, `Out` = messages to it. */
export class ManagedSocket<In = unknown, Out = unknown> {
  readonly state: Signal<SocketState> = signal<SocketState>("idle");
  /** Reconnect attempts since the last successful open. */
  readonly attempts = signal(0);
  /** Messages waiting for a connection. */
  readonly queued = signal(0);
  /** True when this tab owns the shared connection (always true when not shared). */
  readonly leader = signal(true);
  readonly url: string;
  private ws: SocketLike | null = null;
  private p: SocketProtocol;
  private topics = new Map<string, Set<Handler<In>>>();
  private types = new Map<string, Set<Handler<In>>>();
  private all = new Set<Handler<In>>();
  private replies = new Map<string, { res: (v: unknown) => void; rej: (e: unknown) => void; t: ReturnType<typeof setTimeout> }>();
  private outbox: string[] = [];
  private timer: ReturnType<typeof setTimeout> | undefined;
  private beat: ReturnType<typeof setInterval> | undefined;
  private lastSeen = 0;
  private closed = false;
  private bc: BroadcastChannel | null = null;
  private releaseLock: (() => void) | null = null;

  private o: SocketOptions;
  constructor(url: string, o: SocketOptions = {}) {
    this.o = o;
    this.url = /^(wss?|https?):\/\//.test(url) ? url : resolveUrl(url, "ws");
    this.p = { ...jsonProtocol, ...o.protocol };
    if (o.shared && typeof BroadcastChannel !== "undefined") this.share();
    else if (!o.lazy) this.connect();
  }

  /** Open the connection (idempotent). */
  connect(): void {
    if (this.closed || !this.leader.peek() || (this.ws && this.ws.readyState <= OPEN)) return;
    this.state.set(this.attempts.peek() ? "reconnecting" : "connecting");
    this.relayState();
    const f = this.o.factory ?? defaultFactory ?? ((u: string, pr?: string | string[]) => new WebSocket(u, pr) as unknown as SocketLike);
    let ws: SocketLike;
    try { ws = f(this.url, this.o.protocols); } catch (e) { this.fail(e); this.schedule(); return; }
    this.ws = ws;
    ws.onopen = () => {
      this.attempts.set(0);
      this.state.set("open");
      this.relayState();
      this.lastSeen = Date.now();
      for (const t of this.topics.keys()) this.raw(this.p.encode(this.p.sub(t)));
      const out = this.outbox.splice(0);
      this.queued.set(0);
      for (const m of out) ws.send(m);
      this.startBeat();
    };
    ws.onmessage = (e) => { this.lastSeen = Date.now(); this.dispatch(this.p.decode(e.data)); };
    ws.onerror = () => { /* onclose follows */ };
    ws.onclose = (e) => {
      if (this.ws !== ws) return;
      this.ws = null;
      clearInterval(this.beat);
      if (this.closed) { this.state.set("closed"); this.relayState(); return; }
      if (e?.code !== 1000) this.fail(new AppError(`WebSocket closed (${e?.code ?? "?"})`, { type: "network", source: "ws", severity: "warning", context: { url: this.url, code: e?.code } }));
      this.schedule();
    };
  }

  private fail(e: unknown): void { emitError(AppError.from(e, { source: "ws", severity: "warning", context: { url: this.url } })); }

  private schedule(): void {
    if (this.closed || this.o.reconnect === false) { this.state.set("closed"); this.relayState(); return; }
    const n = this.attempts.peek();
    this.attempts.set(n + 1);
    this.state.set("reconnecting");
    this.relayState();
    clearTimeout(this.timer);
    this.timer = setTimeout(() => this.connect(), backoff(n, this.o.reconnect || {}));
  }

  private startBeat(): void {
    const hb = this.o.heartbeat;
    if (hb === false) return;
    const every = hb?.interval ?? 25_000, dead = hb?.timeout ?? every * 2;
    clearInterval(this.beat);
    this.beat = setInterval(() => {
      if (Date.now() - this.lastSeen > dead) { this.ws?.close(4000, "heartbeat timeout"); return; }
      this.raw(this.p.encode(this.p.ping()));
    }, every);
  }

  private dispatch(msg: unknown): void {
    if (this.p.isPong(msg)) return;
    if (this.bc && this.leader.peek()) this.bc.postMessage({ k: "msg", msg });
    const reply = this.p.replyTo(msg);
    if (reply) {
      const r = this.replies.get(reply.id);
      if (r) { this.replies.delete(reply.id); clearTimeout(r.t); if (reply.error != null) r.rej(AppError.from(reply.error, { source: "ws" })); else r.res(reply.data); }
      return;
    }
    const m = msg as In;
    const topic = this.p.topicOf(msg);
    if (topic) for (const fn of this.topics.get(topic) ?? []) fn(m);
    const type = this.p.typeOf(msg);
    if (type) for (const fn of this.types.get(type) ?? []) fn(m);
    for (const fn of this.all) fn(m);
  }

  private raw(data: string): void {
    if (this.bc && !this.leader.peek()) { this.bc.postMessage({ k: "send", data }); return; }
    if (this.ws?.readyState === OPEN) { this.ws.send(data); return; }
    const max = this.o.queue ?? 100;
    if (!max) throw new AppError("WebSocket is not connected", { type: "offline", source: "ws" });
    this.outbox.push(data);
    if (this.outbox.length > max) this.outbox.shift();
    this.queued.set(this.outbox.length);
    if (this.o.lazy) this.connect();
  }

  /** Send a message (queued while disconnected). */
  send(msg: Out): void { this.raw(this.p.encode(msg)); }

  /** Send and wait for the reply with the same correlation id. */
  request<R = In>(msg: Out, { timeout = this.o.requestTimeout ?? 15_000, signal }: { timeout?: number | undefined; signal?: AbortSignal | undefined } = {}): Promise<R> {
    const id = newId();
    return new Promise<R>((res, rej) => {
      const t = setTimeout(() => { this.replies.delete(id); rej(new AppError(`No reply in ${timeout} ms`, { type: "timeout", source: "ws" })); }, timeout);
      this.replies.set(id, { res: res as (v: unknown) => void, rej, t });
      signal?.addEventListener("abort", () => { clearTimeout(t); this.replies.delete(id); rej(Object.assign(new Error("Aborted"), { name: "AbortError" })); }, { once: true });
      this.raw(this.p.encode(this.p.withId(msg, id)));
    });
  }

  /** Subscribe to a topic (renewed after every reconnect). Returns an unsubscribe function. */
  subscribe(topic: string, fn: Handler<In>): () => void {
    let s = this.topics.get(topic);
    if (!s) { this.topics.set(topic, (s = new Set())); if (this.ws?.readyState === OPEN || (this.bc && !this.leader.peek())) this.raw(this.p.encode(this.p.sub(topic))); else if (this.o.lazy) this.connect(); }
    s.add(fn);
    return () => {
      s.delete(fn);
      if (!s.size && this.topics.get(topic) === s) { this.topics.delete(topic); if (this.ws?.readyState === OPEN) this.raw(this.p.encode(this.p.unsub(topic))); }
    };
  }

  /** Listen to messages by `type` (or every message with "*"). */
  on(type: string, fn: Handler<In>): () => void {
    if (type === "*") { this.all.add(fn); return () => this.all.delete(fn); }
    let s = this.types.get(type);
    if (!s) this.types.set(type, (s = new Set()));
    s.add(fn);
    return () => s.delete(fn);
  }

  /** Drop the connection now and reconnect (the demo's "cut the line" button, tests). */
  drop(): void { this.ws?.close(4001, "dropped"); }

  /** Close for good. */
  close(): void {
    this.closed = true;
    clearTimeout(this.timer);
    clearInterval(this.beat);
    for (const r of this.replies.values()) { clearTimeout(r.t); r.rej(Object.assign(new Error("Closed"), { name: "AbortError" })); }
    this.replies.clear();
    this.ws?.close(1000, "closed");
    this.ws = null;
    this.state.set("closed");
    this.releaseLock?.();
    this.bc?.close();
  }

  // ---- one connection for every tab
  private share(): void {
    const bc = (this.bc = new BroadcastChannel(`hm-ws:${this.url}`));
    this.leader.set(false);
    bc.onmessage = (e: MessageEvent<{ k: string; msg?: unknown; data?: string; state?: SocketState }>) => {
      const d = e.data;
      if (this.leader.peek()) { if (d.k === "send" && d.data) this.raw(d.data); else if (d.k === "hello") this.relayState(); return; }
      if (d.k === "msg") this.dispatch(d.msg);
      else if (d.k === "state" && d.state) this.state.set(d.state);
    };
    const locks = (globalThis.navigator as { locks?: { request(n: string, f: () => Promise<void>): Promise<void> } } | undefined)?.locks;
    if (!locks) { this.leader.set(true); if (!this.o.lazy) this.connect(); return; }
    bc.postMessage({ k: "hello" });
    void locks.request(`hm-ws:${this.url}`, () => new Promise<void>((release) => {
      if (this.closed) { release(); return; }
      this.releaseLock = release;
      this.leader.set(true);
      this.connect();
      for (const t of this.topics.keys()) if (this.ws?.readyState === OPEN) this.raw(this.p.encode(this.p.sub(t)));
    }));
  }
  private relayState(): void { if (this.bc && this.leader.peek()) this.bc.postMessage({ k: "state", state: this.state.peek() }); }
}

const sockets = new Map<string, ManagedSocket>();
/** A managed socket per url (shared by every caller). */
export function socket<In = unknown, Out = unknown>(url: string, o?: SocketOptions): ManagedSocket<In, Out> {
  let s = sockets.get(url);
  if (!s || s.state.peek() === "closed") sockets.set(url, (s = new ManagedSocket(url, o)));
  return s as ManagedSocket<In, Out>;
}
/** Close every managed socket (tests, sign-out). */
export function closeSockets(): void { for (const s of sockets.values()) s.close(); sockets.clear(); }

/** Requests over a WebSocket: `net.request({ url: "ws:/rpc", body: { type: "getUser", id } })` sends the body and
 *  resolves with the reply; `stream("ws:/path#topic")` subscribes to a topic. */
export class WsTransport implements Transport {
  readonly name = "ws";
  private o: SocketOptions;
  constructor(o: SocketOptions = {}) { this.o = o; }
  private sock(url: string): ManagedSocket { return socket(url.split("#")[0] as string, this.o); }
  async send(ctx: Ctx): Promise<NetResponse> {
    const data = await this.sock(ctx.req.url).request(ctx.req.body ?? { type: ctx.req.method.toLowerCase(), ...ctx.req.query }, { signal: ctx.signal, timeout: ctx.req.timeout || undefined });
    return { status: 200, ok: true, headers: {}, data, from: "network" };
  }
  stream(url: string, onMessage: (msg: unknown) => void, o: { signal?: AbortSignal | undefined } = {}): () => void {
    const [base, topic] = url.split("#") as [string, string | undefined];
    const s = this.sock(base);
    const off = topic ? s.subscribe(topic, onMessage) : s.on("*", onMessage);
    o.signal?.addEventListener("abort", off, { once: true });
    return off;
  }
}
