// HADI March net core: every request of an app goes through one Net instance.
//   category + key + policy (latest | dedupe | queue | parallel), priority (route > data > prefetch; prefetch waits
//   while a route loads), timeout, retry with backoff (idempotent requests only), an offline queue, events
//   (net:start / progress / retry / done / error / abort), a global pending(category?) signal and a Koa-style
//   middleware chain (ctx, next) in front of a transport (http, ws, sse, mock — see transport.ts / ws.ts / mock.ts).
import { signal, type Signal } from "../core/reactive.ts";
import { AppError, emitError, isAbort } from "../errors/app-error.ts";

export type Policy = "latest" | "dedupe" | "queue" | "parallel";
export type Priority = "route" | "data" | "prefetch";
export type Method = "GET" | "HEAD" | "OPTIONS" | "POST" | "PUT" | "PATCH" | "DELETE";
export interface RetryOptions { count: number; delay: number; max: number; factor: number }

/** What a caller passes to `net.request()`. Everything is optional except a url (or `run`). */
export interface RequestOptions {
  url?: string;
  method?: Method | (string & {});
  /** `:name` placeholders in the url. */
  params?: Record<string, string | number>;
  query?: Record<string, unknown>;
  body?: unknown;
  headers?: Record<string, string>;
  /** Group of requests: `latest`/`queue` act per category, `pending(category)` counts it, `invalidate(category)` clears it. */
  category?: string;
  /** Identity of the request (dedupe, cache). Default: method + url + query. */
  key?: string;
  /** Default: `dedupe` for GET/HEAD, `parallel` otherwise. */
  policy?: Policy;
  priority?: Priority;
  /** ms per attempt (0 = none). */
  timeout?: number;
  /** Retries for idempotent requests (a number = count). Writes are never retried unless `idempotent: true`. */
  retry?: number | Partial<RetryOptions> | false;
  /** Default: true for GET/HEAD/OPTIONS/PUT/DELETE. */
  idempotent?: boolean;
  /** While offline: `wait` (held in the offline queue until online, default) or `fail` at once. */
  offline?: "wait" | "fail";
  signal?: AbortSignal | null;
  /** Transport name; default from the url scheme (`ws:`, `sse:`) or `http`. */
  transport?: string;
  responseType?: "json" | "text" | "blob" | "none";
  /** Cache freshness for the cache() middleware: ms or "30s" / "5m" / "1h". */
  cache?: number | string;
  /** Categories / key prefixes to invalidate after success. */
  invalidates?: readonly string[];
  /** Middleware for this request only (runs after the global ones). */
  use?: readonly Middleware[];
  /** Free-form data for middleware (log labels, query keys…). */
  meta?: Record<string, unknown>;
  /** Report a final failure to hadi-march/errors (default true). */
  report?: boolean;
  /** Run this function instead of a transport (chunk loads, custom RPC). Its result is the response data. */
  run?: (signal: AbortSignal) => unknown;
}

/** A normalized request (what middleware sees as ctx.req). */
export interface NetRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  query: Record<string, unknown>;
  body: unknown;
  category: string;
  key: string;
  policy: Policy;
  priority: Priority;
  timeout: number;
  retry: RetryOptions;
  idempotent: boolean;
  offline: "wait" | "fail";
  transport: string;
  responseType: "json" | "text" | "blob" | "none";
  cache: number;
  meta: Record<string, unknown>;
}

export interface NetResponse<T = unknown> {
  status: number;
  ok: boolean;
  headers: Record<string, string>;
  data: T;
  /** Where the data came from. */
  from?: "network" | "cache" | "mock" | "replay" | "run";
}

/** One timed middleware / transport step (inclusive of what runs inside it). */
export interface Step { name: string; start: number; ms: number; ok: boolean }

export interface Ctx {
  id: number;
  req: NetRequest;
  res: NetResponse | null;
  error: AppError | null;
  /** The options the caller passed (cache revalidation re-issues them). */
  options: RequestOptions;
  net: Net;
  /** Scratch space for middleware. */
  state: Record<string, unknown>;
  steps: Step[];
  /** 0 for the first try. */
  attempt: number;
  /** performance.now() when the request started (after waiting for a slot). */
  start: number;
  /** Aborts on caller abort, `latest` replacement or timeout. */
  signal: AbortSignal;
  /** Report download / upload progress (fires net:progress). */
  progress(loaded: number, total?: number): void;
}

export type Middleware = ((ctx: Ctx, next: () => Promise<void>) => unknown) & { mwName?: string };

export interface Transport {
  readonly name: string;
  send(ctx: Ctx): Promise<NetResponse>;
  /** Long-lived stream (WebSocket topic, server-sent events). Returns a stop function. */
  stream?(url: string, onMessage: (msg: unknown) => void, opts: { signal?: AbortSignal | undefined; onError?: ((e: AppError) => void) | undefined }): () => void;
}

export type NetEventName = "net:start" | "net:progress" | "net:retry" | "net:done" | "net:error" | "net:abort" | "net:revalidate";
export interface NetEvent { ctx: Ctx; loaded?: number | undefined; total?: number | undefined; error?: AppError | undefined }

export interface NetConfig {
  baseUrl: string;
  timeout: number;
  retry: RetryOptions;
  /** Concurrent requests (route loads are never held back by it). */
  maxConcurrent: number;
  headers: Record<string, string>;
}

const RANK: Record<Priority, number> = { route: 0, data: 1, prefetch: 2 };
const SAFE = new Set(["GET", "HEAD", "OPTIONS"]);
const IDEMPOTENT = new Set(["GET", "HEAD", "OPTIONS", "PUT", "DELETE"]);

/** "500" | "30s" | "5m" | "1h" | "1d" | number → ms. */
export function duration(v: number | string | undefined | null): number {
  if (v == null || v === "") return 0;
  if (typeof v === "number") return v;
  const m = /^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d)?$/.exec(v.trim());
  if (!m) return 0;
  return Number(m[1]) * ({ ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5 }[(m[2] ?? "ms") as "ms"]);
}

const abortError = (why = "Aborted"): AppError => { const e = new AppError(why, { type: "abort", source: "net" }); e.name = "AbortError"; return e; };
const now = (): number => globalThis.performance?.now() ?? Date.now();

/** Fill `:name` placeholders and append the query string. */
export function buildUrl(url: string, params?: Record<string, unknown>, query?: Record<string, unknown>): string {
  let u = params ? url.replace(/:([A-Za-z_]\w*)/g, (m, k: string) => (params[k] != null ? encodeURIComponent(String(params[k])) : m)) : url;
  const qs = query ? Object.entries(query).filter(([, v]) => v != null && v !== "")
    .flatMap(([k, v]) => (Array.isArray(v) ? v : [v]).map((x) => `${encodeURIComponent(k)}=${encodeURIComponent(String(x))}`)).join("&") : "";
  if (qs) u += (u.includes("?") ? "&" : "?") + qs;
  return u;
}

/** Wait `ms` (rejects on abort). */
export const sleep = (ms: number, signal?: AbortSignal): Promise<void> => new Promise((res, rej) => {
  if (signal?.aborted) { rej(abortError()); return; }
  const t = setTimeout(res, ms);
  signal?.addEventListener("abort", () => { clearTimeout(t); rej(abortError()); }, { once: true });
});

/** Run a step and record how long it took (the request inspector draws these). */
async function timed(ctx: Ctx, name: string, fn: () => unknown): Promise<void> {
  const step: Step = { name, start: now() - ctx.start, ms: 0, ok: true };
  ctx.steps.push(step);
  try { await fn(); } catch (e) { step.ok = false; throw e; } finally { step.ms = now() - ctx.start - step.start; }
}

/** Koa-style composition. `next` may be called again (retry re-runs everything below it). */
export function compose(mws: readonly Middleware[], terminal: (ctx: Ctx) => Promise<void>): (ctx: Ctx) => Promise<void> {
  return (ctx) => {
    const dispatch = (i: number): Promise<void> => {
      if (i === mws.length) return timed(ctx, "transport:" + ctx.req.transport, () => terminal(ctx));
      const mw = mws[i] as Middleware;
      return timed(ctx, mw.mwName ?? (mw.name || "middleware"), () => mw(ctx, () => dispatch(i + 1)));
    };
    return dispatch(0);
  };
}

/** Name a middleware for the request inspector and logs. */
export const named = <M extends Middleware>(name: string, mw: M): M => Object.assign(mw, { mwName: name });

// Built-in steps (always last before the transport): retry wraps timeout wraps the transport.
const retryStep = named("retry", async (ctx: Ctx, next: () => Promise<void>) => {
  const r = ctx.req.retry;
  for (let i = 0; ; i++) {
    ctx.attempt = i;
    try { await next(); return; }
    catch (e) {
      const err = AppError.from(e, { source: "net" });
      if (ctx.signal.aborted || isAbort(err) || i >= r.count || !ctx.req.idempotent || !err.retryable) throw err;
      const wait = Math.min(r.max, r.delay * r.factor ** i) * (0.5 + Math.random() * 0.5); // jitter
      ctx.net.emit("net:retry", { ctx, error: err });
      await sleep(Number(err.context["retryAfter"]) * 1000 || wait, ctx.signal);
    }
  }
});
const timeoutStep = named("timeout", async (ctx: Ctx, next: () => Promise<void>) => {
  const ms = ctx.req.timeout;
  if (!ms) return next();
  const outer = ctx.signal, ctl = new AbortController();
  const stop = (): void => ctl.abort();
  outer.addEventListener("abort", stop, { once: true });
  let timedOut = false;
  const t = setTimeout(() => { timedOut = true; ctl.abort(); }, ms);
  ctx.signal = ctl.signal;
  try { await next(); }
  catch (e) { throw timedOut ? new AppError(`Timed out after ${ms} ms`, { type: "timeout", source: "net", cause: e, context: { timeout: ms } }) : e; }
  finally { clearTimeout(t); ctx.signal = outer; outer.removeEventListener("abort", stop); }
});

interface Flight { promise: Promise<NetResponse>; ctl: AbortController; refs: number; ctx: Ctx | null; cat: string }
interface Waiter { rank: number; seq: number; go: () => void; signal: AbortSignal | null }

let ids = 0;

export class Net {
  readonly config: NetConfig = { baseUrl: "", timeout: 30_000, retry: { count: 2, delay: 300, max: 10_000, factor: 2 }, maxConcurrent: 6, headers: {} };
  /** Global middleware, in order. */
  readonly middleware: Middleware[] = [];
  readonly transports = new Map<string, Transport>();
  /** Shared store for middleware (cache entries, recordings). */
  readonly store = new Map<string, unknown>();
  /** True while the browser is online (`setOnline` simulates). */
  readonly online: Signal<boolean>;
  /** Requests held in the offline queue. */
  readonly offlineQueue = signal(0);
  /** Prefetch requests wait while true (also while a route chunk loads). */
  readonly prefetchPaused = signal(false);
  private counts = signal<Record<string, number>>({});
  private listeners = new Map<string, Set<(e: NetEvent) => void>>();
  private flights = new Map<string, Flight>();
  private all = new Set<Flight>();
  private latest = new Map<string, Flight>();
  private queues = new Map<string, Promise<unknown>>();
  private waiting: Waiter[] = [];
  private running = 0;
  private routeLoads = 0;
  private seq = 0;
  private wake = new Set<() => void>();

  constructor(config: Partial<NetConfig> = {}) {
    this.configure(config);
    this.online = signal(globalThis.navigator?.onLine ?? true);
    const g = globalThis as { addEventListener?: (n: string, f: () => void) => void };
    g.addEventListener?.("online", () => this.setOnline(true));
    g.addEventListener?.("offline", () => this.setOnline(false));
  }

  configure(c: Partial<NetConfig>): this {
    Object.assign(this.config, c, c.retry ? { retry: { ...this.config.retry, ...c.retry } } : {});
    return this;
  }
  /** Add global middleware (runs for every request, in the order added). */
  use(...mws: Middleware[]): this { this.middleware.push(...mws); return this; }
  /** Remove global middleware. */
  unuse(mw: Middleware): this { const i = this.middleware.indexOf(mw); if (i >= 0) this.middleware.splice(i, 1); return this; }
  /** Register (or replace) a transport by name: `http`, `ws`, `sse`, `mock`, … */
  transport(t: Transport, name: string = t.name): this { this.transports.set(name, t); return this; }

  /** Subscribe to `net:*` events. Returns an unsubscribe function. */
  on(name: NetEventName, fn: (e: NetEvent) => void): () => void {
    let s = this.listeners.get(name);
    if (!s) this.listeners.set(name, (s = new Set()));
    s.add(fn);
    return () => s.delete(fn);
  }
  emit(name: NetEventName, e: NetEvent): void { for (const fn of this.listeners.get(name) ?? []) { try { fn(e); } catch (err) { queueMicrotask(() => { throw err; }); } } }

  /** Requests in flight (reactive): all of them, or one category. */
  pending(category?: string): number { const c = this.counts(); return category ? c[category] ?? 0 : Object.values(c).reduce((a, b) => a + b, 0); }

  /** Simulate going offline / online (the demo switch, tests). Queued requests resume when online. */
  setOnline(on: boolean): void {
    this.online.set(on);
    if (on) { const w = [...this.wake]; this.wake.clear(); for (const f of w) f(); }
  }

  /** Normalize caller options into a request. */
  normalize(o: RequestOptions): NetRequest {
    const method = (o.method ?? "GET").toUpperCase();
    const raw = o.url ?? (o.run ? "run:" : "");
    const scheme = /^(ws|wss|sse|mock|run):/.exec(raw)?.[1];
    let url = buildUrl(raw, o.params, undefined);
    if (!scheme && this.config.baseUrl && !/^[a-z][a-z0-9+.-]*:|^\/\//i.test(url)) url = this.config.baseUrl.replace(/\/$/, "") + (url.startsWith("/") ? url : "/" + url);
    const query = o.query ?? {};
    const r = this.config.retry;
    const retry: RetryOptions = o.retry === false ? { ...r, count: 0 } : typeof o.retry === "number" ? { ...r, count: o.retry } : { ...r, ...(o.retry ?? {}) };
    return {
      url, method, query, body: o.body,
      headers: { ...this.config.headers, ...(o.headers ?? {}) },
      category: o.category ?? "default",
      key: o.key ?? `${method} ${buildUrl(url, undefined, query)}`,
      policy: o.policy ?? (SAFE.has(method) && !o.run ? "dedupe" : "parallel"),
      priority: o.priority ?? "data",
      timeout: o.timeout ?? (o.run ? 0 : this.config.timeout),
      retry,
      idempotent: o.idempotent ?? IDEMPOTENT.has(method),
      offline: o.offline ?? "wait",
      transport: o.transport ?? (o.run ? "run" : scheme === "wss" ? "ws" : scheme ?? "http"),
      responseType: o.responseType ?? "json",
      cache: duration(o.cache),
      meta: { ...(o.meta ?? {}) },
    };
  }

  /** Send a request; resolves with the response data. */
  request<T = unknown>(o: RequestOptions): Promise<T> { return this.send<T>(o).then((r) => r.data); }
  get<T = unknown>(url: string, o: RequestOptions = {}): Promise<T> { return this.request<T>({ ...o, url, method: "GET" }); }
  post<T = unknown>(url: string, body?: unknown, o: RequestOptions = {}): Promise<T> { return this.request<T>({ ...o, url, body, method: "POST" }); }
  put<T = unknown>(url: string, body?: unknown, o: RequestOptions = {}): Promise<T> { return this.request<T>({ ...o, url, body, method: "PUT" }); }
  patch<T = unknown>(url: string, body?: unknown, o: RequestOptions = {}): Promise<T> { return this.request<T>({ ...o, url, body, method: "PATCH" }); }
  delete<T = unknown>(url: string, o: RequestOptions = {}): Promise<T> { return this.request<T>({ ...o, url, method: "DELETE" }); }

  /** Send a request; resolves with the whole response (status, headers, data). */
  send<T = unknown>(o: RequestOptions): Promise<NetResponse<T>> {
    const req = this.normalize(o);
    if (req.policy === "dedupe") {
      const f = this.flights.get(req.key);
      if (f) return this.join(f, o.signal) as Promise<NetResponse<T>>;
    }
    const ctl = new AbortController();
    const flight: Flight = { promise: null as unknown as Promise<NetResponse>, ctl, refs: 0, ctx: null, cat: req.category };
    if (req.policy === "latest") {
      this.latest.get(req.category)?.ctl.abort();
      this.latest.set(req.category, flight);
    }
    let start = (): Promise<NetResponse> => this.execute(req, o, flight);
    if (req.policy === "queue") {
      const prev = this.queues.get(req.category) ?? Promise.resolve();
      const run = start;
      const p = prev.then(run, run);
      this.queues.set(req.category, p.catch(() => undefined));
      start = () => p;
    }
    flight.promise = start();
    this.all.add(flight);
    const done = (): void => { this.all.delete(flight); };
    flight.promise.then(done, done);
    if (req.policy === "dedupe") {
      this.flights.set(req.key, flight);
      const clear = (): void => { if (this.flights.get(req.key) === flight) this.flights.delete(req.key); };
      flight.promise.then(clear, clear);
    }
    if (req.policy === "latest") {
      const clear = (): void => { if (this.latest.get(req.category) === flight) this.latest.delete(req.category); };
      flight.promise.then(clear, clear);
    }
    return this.join(flight, o.signal) as Promise<NetResponse<T>>;
  }

  /** A caller's view of a (possibly shared) flight: its own abort only aborts the request when nobody else waits. */
  private join(f: Flight, signal?: AbortSignal | null): Promise<NetResponse> {
    f.refs++;
    if (!signal) return f.promise;
    return new Promise((res, rej) => {
      const leave = (): void => { rej(abortError()); if (--f.refs <= 0) f.ctl.abort(); };
      if (signal.aborted) { leave(); return; }
      signal.addEventListener("abort", leave, { once: true });
      f.promise.then((v) => { signal.removeEventListener("abort", leave); res(v); }, (e: unknown) => { signal.removeEventListener("abort", leave); rej(e); });
    });
  }

  /** Wait for a slot: priority order, prefetch waits while a route loads or prefetch is paused. */
  private acquire(prio: Priority, signal: AbortSignal): Promise<void> {
    const can = (): boolean => prio === "route" || (this.running < this.config.maxConcurrent && !(prio === "prefetch" && (this.routeLoads > 0 || this.prefetchPaused.peek())));
    if (!this.waiting.length && can()) { this.take(prio); return Promise.resolve(); }
    return new Promise((res, rej) => {
      const w: Waiter = { rank: RANK[prio], seq: ++this.seq, signal, go: () => { this.take(prio); res(); } };
      (w as Waiter & { can: () => boolean }).can = can;
      this.waiting.push(w);
      this.waiting.sort((a, b) => a.rank - b.rank || a.seq - b.seq);
      signal.addEventListener("abort", () => { const i = this.waiting.indexOf(w); if (i >= 0) { this.waiting.splice(i, 1); rej(abortError()); } }, { once: true });
      this.pump();
    });
  }
  private take(prio: Priority): void { this.running++; if (prio === "route") this.routeLoads++; }
  private release(prio: Priority): void { this.running--; if (prio === "route") this.routeLoads--; this.pump(); }
  /** Start waiting requests that may run now (call after changing prefetchPaused). */
  pump(): void {
    for (let i = 0; i < this.waiting.length;) {
      const w = this.waiting[i] as Waiter & { can: () => boolean };
      if (w.can()) { this.waiting.splice(i, 1); w.go(); } else i++;
    }
  }
  /** Pause / resume prefetch requests. */
  pausePrefetch(on: boolean): void { this.prefetchPaused.set(on); if (!on) this.pump(); }

  private waitOnline(signal: AbortSignal): Promise<void> {
    if (this.online.peek()) return Promise.resolve();
    this.offlineQueue.update((n) => n + 1);
    return new Promise<void>((res, rej) => {
      const go = (): void => { signal.removeEventListener("abort", stop); res(); };
      const stop = (): void => { this.wake.delete(go); rej(abortError()); };
      this.wake.add(go);
      signal.addEventListener("abort", stop, { once: true });
    }).finally(() => this.offlineQueue.update((n) => n - 1));
  }

  private count(cat: string, d: number): void { this.counts.update((c) => ({ ...c, [cat]: Math.max(0, (c[cat] ?? 0) + d) })); }

  private async execute(req: NetRequest, options: RequestOptions, flight: Flight): Promise<NetResponse> {
    const signal = flight.ctl.signal;
    const ctx: Ctx = {
      id: ++ids, req, res: null, error: null, options, net: this, state: {}, steps: [], attempt: 0, start: now(), signal,
      progress: (loaded, total) => this.emit("net:progress", { ctx, loaded, total }),
    };
    flight.ctx = ctx;
    let slot = false;
    this.count(req.category, 1);
    try {
      if (!this.online.peek()) {
        if (req.offline === "fail") throw new AppError("Offline", { type: "offline", source: "net" });
        await this.waitOnline(signal);
      }
      await this.acquire(req.priority, signal);
      slot = true;
      ctx.start = now();
      this.emit("net:start", { ctx });
      await compose([...this.middleware, ...(options.use ?? []), retryStep, timeoutStep], (c) => this.terminal(c, options))(ctx);
      if (!ctx.res) throw new AppError("No response", { source: "net" });
      if (req.policy === "latest" && signal.aborted) throw abortError();
      this.emit("net:done", { ctx });
      if (options.invalidates?.length) for (const k of options.invalidates) this.invalidate(k);
      return ctx.res;
    } catch (e) {
      const err = signal.aborted ? abortError(req.policy === "latest" ? "Replaced by a newer request" : "Aborted") : AppError.from(e, { source: "net" });
      err.context = { url: req.url, method: req.method, category: req.category, ...(req.meta["target"] ? { target: req.meta["target"] } : {}), ...err.context };
      ctx.error = err;
      if (isAbort(err)) this.emit("net:abort", { ctx, error: err });
      else {
        this.emit("net:error", { ctx, error: err });
        if (options.report !== false) emitError(err);
      }
      throw err;
    } finally {
      if (slot) this.release(req.priority);
      this.count(req.category, -1);
    }
  }

  private async terminal(ctx: Ctx, options: RequestOptions): Promise<void> {
    if (options.run) { ctx.res = { status: 200, ok: true, headers: {}, data: await options.run(ctx.signal), from: "run" }; return; }
    const t = this.transports.get(ctx.req.transport);
    if (!t) throw new AppError(`No transport "${ctx.req.transport}"`, { type: "runtime", source: "net" });
    let res: NetResponse;
    try { res = await t.send(ctx); }
    catch (e) { throw ctx.signal.aborted ? abortError() : AppError.from(e, { source: "net", type: e instanceof TypeError ? "network" : undefined }); }
    ctx.res = res;
    if (!res.ok) {
      const b = res.data as { message?: string; error?: { message?: string } | string; title?: string; code?: string } | null;
      const msg = (b && (b.message || (typeof b.error === "string" ? b.error : b.error?.message) || b.title)) || `HTTP ${res.status}`;
      const retryAfter = Number(res.headers["retry-after"]);
      throw new AppError(msg, { status: res.status, code: typeof b?.code === "string" ? b.code : undefined, source: "net", context: { body: b, ...(retryAfter ? { retryAfter } : {}) } });
    }
  }

  /** Forget cached responses of a category / key prefix and refetch the queries that use them. */
  invalidate(prefix: string): void {
    for (const k of [...this.store.keys()]) {
      if (!k.startsWith("cache:")) continue;
      const e = this.store.get(k) as { category?: string } | undefined;
      if (e?.category === prefix || k.slice(6).startsWith(prefix)) this.store.delete(k);
    }
    for (const fn of invalidators) fn(prefix);
  }

  /** Abort the requests of a category that are in flight or waiting. */
  cancel(category: string): void { for (const f of [...this.all]) if (f.ctx?.req.category === category || (!f.ctx && f.cat === category)) f.ctl.abort(); }

  /** Abort every request in flight (sign-out, tests). */
  abortAll(): void {
    for (const f of [...this.all]) f.ctl.abort();
  }
}

const invalidators = new Set<(prefix: string) => void>();
/** Other layers (hadi-march/net api → data queries) hook into net.invalidate(). */
export function onInvalidate(fn: (prefix: string) => void): () => void { invalidators.add(fn); return () => invalidators.delete(fn); }
