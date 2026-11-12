// Mock provider: answer requests in the browser (or node tests) without a server.
//
//   import "hadi-march/net/mock";
//   const m = net.mock({
//     ...crud("/users", (f) => f.list(20, (i) => ({ id: String(i + 1), name: f.name(), email: f.email() }))),
//     "GET /me": { id: "1", name: "Ada" },
//     "POST /login": (r) => (r.body.password ? { token: "t" } : reply(401, { message: "Wrong password" })),
//   }, { delay: [80, 250], errorRate: 0.05, seed: 7 });
//   m.ws("/users/events", (client) => client.send({ type: "hello" }));    m.publish("/users/events", "users", {…})
//   m.set({ delay: 2000 })  (slow network)          net.mock(false)  (back to the real transport)
//   net.mock(openapiDocument)                        (examples, or data generated from the schemas)
import { signal } from "../core/reactive.ts";
import { Net, sleep, type Ctx, type NetResponse, type Transport } from "./core.ts";
import { setSocketFactory, type SocketLike } from "./ws.ts";

// ---------------------------------------------------------------- seeded data
/** Deterministic random numbers (mulberry32). */
export function rng(seed = 1): () => number {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const FIRST = ["Ada", "Alan", "Grace", "Linus", "Margaret", "Dennis", "Barbara", "Ken", "Frances", "Tim", "Radia", "Edsger", "Hedy", "John", "Katherine", "Niklaus"];
const LAST = ["Lovelace", "Turing", "Hopper", "Torvalds", "Hamilton", "Ritchie", "Liskov", "Thompson", "Allen", "Berners-Lee", "Perlman", "Dijkstra", "Lamarr", "Backus", "Johnson", "Wirth"];
const WORDS = ["alpha", "bravo", "cedar", "delta", "ember", "falcon", "garnet", "harbor", "indigo", "juniper", "kestrel", "lumen", "meadow", "nova", "orbit", "prism"];

/** Seeded fake data helpers. */
export interface Fake {
  rand(): number;
  int(min: number, max: number): number;
  pick<T>(list: readonly T[]): T;
  bool(p?: number): boolean;
  name(): string;
  email(name?: string): string;
  words(n?: number): string;
  date(daysBack?: number): string;
  id(): string;
  list<T>(n: number, make: (i: number) => T): T[];
}
export function fake(seed = 1): Fake {
  const r = rng(seed);
  let n = 0;
  const f: Fake = {
    rand: r,
    int: (min, max) => min + Math.floor(r() * (max - min + 1)),
    pick: (l) => l[Math.floor(r() * l.length)] as (typeof l)[number],
    bool: (p = 0.5) => r() < p,
    name: () => `${f.pick(FIRST)} ${f.pick(LAST)}`,
    email: (name) => `${(name ?? f.name()).toLowerCase().replace(/[^a-z]+/g, ".")}@example.com`,
    words: (k = 3) => Array.from({ length: k }, () => f.pick(WORDS)).join(" "),
    date: (back = 365) => new Date(Date.UTC(2026, 0, 1) - f.int(0, back) * 864e5).toISOString().slice(0, 10),
    id: () => (++n).toString(36) + Math.floor(r() * 1e6).toString(36),
    list: (k, make) => Array.from({ length: k }, (_, i) => make(i)),
  };
  return f;
}

// ---------------------------------------------------------------- handlers
export interface MockRequest {
  method: string;
  path: string;
  params: Record<string, string>;
  query: Record<string, string>;
  body: any;
  headers: Record<string, string>;
  fake: Fake;
}
/** A handler returns data (200), `reply(status, body)` or throws. Static values are returned as they are. */
export type MockHandler = (req: MockRequest) => unknown;
export type MockHandlers = Record<string, MockHandler | unknown>;

export class MockReply {
  readonly status: number; readonly body: unknown; readonly headers: Record<string, string>;
  constructor(status: number, body?: unknown, headers: Record<string, string> = {}) { this.status = status; this.body = body; this.headers = headers; }
}
/** A response with a status: `reply(404, { message: "No such user" })`. */
export const reply = (status: number, body?: unknown, headers?: Record<string, string>): MockReply => new MockReply(status, body, headers);

/** Stateful CRUD under a path: list (?q= search, ?limit= / ?offset=), get, create, update (PUT / PATCH), delete. */
export function crud<T extends Record<string, unknown>>(path: string, seed: T[] | ((f: Fake) => T[]), o: { id?: string; seed?: number } = {}): MockHandlers & { rows(): T[] } {
  const idKey = o.id ?? "id";
  let rows: T[] | null = null;
  const all = (f: Fake): T[] => (rows ??= (typeof seed === "function" ? seed(o.seed ? fakeFor(o.seed) : f) : [...seed]));
  const find = (r: MockRequest): number => all(r.fake).findIndex((x) => String(x[idKey]) === r.params["id"]);
  const p = path.replace(/\/$/, "");
  const handlers: MockHandlers = {
    [`GET ${p}`]: (r: MockRequest) => {
      const q = (r.query["q"] ?? "").toLowerCase();
      let list = all(r.fake);
      if (q) list = list.filter((x) => Object.values(x).some((v) => typeof v === "string" && v.toLowerCase().includes(q)));
      const off = Number(r.query["offset"] ?? 0), lim = Number(r.query["limit"] ?? list.length);
      return list.slice(off, off + lim);
    },
    [`GET ${p}/:id`]: (r: MockRequest) => { const i = find(r); return i < 0 ? reply(404, { message: "Not found" }) : all(r.fake)[i]; },
    [`POST ${p}`]: (r: MockRequest) => { const row = { [idKey]: r.fake.id(), ...(r.body as object) } as T; all(r.fake).push(row); return reply(201, row); },
    [`PUT ${p}/:id`]: (r: MockRequest) => { const i = find(r); if (i < 0) return reply(404, { message: "Not found" }); const l = all(r.fake); l[i] = { ...(r.body as object), [idKey]: l[i]?.[idKey] } as T; return l[i]; },
    [`PATCH ${p}/:id`]: (r: MockRequest) => { const i = find(r); if (i < 0) return reply(404, { message: "Not found" }); const l = all(r.fake); l[i] = { ...l[i], ...(r.body as object), [idKey]: l[i]?.[idKey] } as T; return l[i]; },
    [`DELETE ${p}/:id`]: (r: MockRequest) => { const i = find(r); if (i < 0) return reply(404, { message: "Not found" }); all(r.fake).splice(i, 1); return reply(204); },
  };
  return Object.assign(handlers, { rows: () => all(fakeFor(o.seed ?? 1)) }) as MockHandlers & { rows(): T[] };
}
const fakeFor = (seed: number): Fake => fake(seed);

// ---------------------------------------------------------------- OpenAPI
type Schema = { $ref?: string; type?: string; format?: string; enum?: unknown[]; items?: Schema; properties?: Record<string, Schema>; example?: unknown; default?: unknown; minimum?: number; maximum?: number };
type OpenApi = { openapi?: string; servers?: Array<{ url: string }>; paths?: Record<string, Record<string, { responses?: Record<string, { content?: Record<string, { example?: unknown; schema?: Schema }> }> }>>; components?: { schemas?: Record<string, Schema> } };

/** Example data for a JSON schema (seeded; follows $ref, enum, format, example). */
export function sample(s: Schema | undefined, doc: OpenApi, f: Fake, key = "", depth = 0): unknown {
  if (!s || depth > 6) return null;
  if (s.$ref) return sample(doc.components?.schemas?.[s.$ref.split("/").pop() as string], doc, f, key, depth + 1);
  if (s.example !== undefined) return s.example;
  if (s.enum) return f.pick(s.enum);
  if (s.default !== undefined) return s.default;
  switch (s.type) {
    case "array": return f.list(f.int(3, 6), () => sample(s.items, doc, f, key, depth + 1));
    case "object": return Object.fromEntries(Object.entries(s.properties ?? {}).map(([k, p]) => [k, sample(p, doc, f, k, depth + 1)]));
    case "integer": return f.int(s.minimum ?? 1, s.maximum ?? 1000);
    case "number": return Math.round(f.int(s.minimum ?? 0, s.maximum ?? 1000) * 100 + f.int(0, 99)) / 100;
    case "boolean": return f.bool();
    default:
      if (s.format === "email" || /email/i.test(key)) return f.email();
      if (s.format === "date") return f.date();
      if (s.format === "date-time") return `${f.date()}T12:00:00Z`;
      if (s.format === "uuid" || key === "id") return f.id();
      if (/name/i.test(key)) return f.name();
      return f.words(2);
  }
}

/** Handlers for every operation of an OpenAPI 3 document (its examples, else data generated from the schemas). */
export function fromOpenApi(doc: OpenApi): MockHandlers {
  const out: MockHandlers = {};
  const base = (doc.servers?.[0]?.url ?? "").replace(/^[a-z]+:\/\/[^/]+/i, "").replace(/\/$/, "");
  for (const [path, ops] of Object.entries(doc.paths ?? {})) for (const [method, op] of Object.entries(ops)) {
    const [code, res] = Object.entries(op.responses ?? {}).find(([c]) => /^2/.test(c)) ?? ["200", undefined];
    const media = res?.content?.["application/json"];
    out[`${method.toUpperCase()} ${base}${path.replace(/\{(\w+)\}/g, ":$1")}`] = (r: MockRequest) => reply(Number(code) || 200, media?.example ?? sample(media?.schema, doc, r.fake));
  }
  return out;
}
const isOpenApi = (x: unknown): x is OpenApi => !!x && typeof x === "object" && "paths" in x && ("openapi" in x || "swagger" in x);

// ---------------------------------------------------------------- transport
export interface MockOptions {
  /** Latency in ms, or [min, max]. */
  delay?: number | [number, number];
  /** 0..1: share of requests that fail with 503. */
  errorRate?: number;
  /** Seed for data and failures (same seed, same run). */
  seed?: number;
  /** Unknown routes: 404 (default) or pass to the real transport. */
  passthrough?: boolean;
}

interface Route { method: string; re: RegExp; keys: string[]; handler: MockHandler | unknown }
const compile = (spec: string, handler: unknown): Route => {
  const [method, path = "/"] = spec.includes(" ") ? spec.split(/\s+/, 2) as [string, string] : ["GET", spec];
  const keys: string[] = [];
  const re = new RegExp("^" + path.replace(/\/$/, "").replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/:(\w+)/g, (_, k: string) => { keys.push(k); return "([^/]+)"; }).replace(/\*/g, ".*") + "/?$");
  return { method: method.toUpperCase(), re, keys, handler };
};

export class MockTransport implements Transport {
  readonly name = "mock";
  readonly options = signal<Required<Omit<MockOptions, "seed">>>({ delay: [40, 160], errorRate: 0, passthrough: false });
  /** Requests answered so far. */
  readonly hits = signal(0);
  private routes: Route[] = [];
  private f: Fake;
  private r: () => number;
  private fallback: Transport | null;
  constructor(handlers: MockHandlers = {}, o: MockOptions = {}, fallback: Transport | null = null) {
    this.fallback = fallback;
    this.f = fake(o.seed ?? 1);
    this.r = rng((o.seed ?? 1) + 101);
    this.set(o);
    this.add(handlers);
  }
  /** Change latency / error rate / passthrough at run time (the demo sliders). */
  set(o: MockOptions): void { const { seed: _s, ...rest } = o; this.options.update((x) => ({ ...x, ...rest })); }
  /** Add handlers (later ones win). */
  add(h: MockHandlers): void { for (const [k, v] of Object.entries(h)) if (k !== "rows") this.routes.unshift(compile(k, v)); }

  async send(ctx: Ctx): Promise<NetResponse> {
    const o = this.options.peek();
    const u = new URL(ctx.req.url, "http://mock.local/");
    for (const [k, v] of Object.entries(ctx.req.query)) if (v != null) u.searchParams.set(k, String(v));
    const route = this.routes.map((r) => ({ r, m: r.method === ctx.req.method ? r.re.exec(u.pathname) : null })).find((x) => x.m);
    if (!route && o.passthrough && this.fallback) return this.fallback.send(ctx);
    const [lo, hi] = Array.isArray(o.delay) ? o.delay : [o.delay, o.delay];
    const wait = lo + this.r() * (hi - lo);
    // progress in 4 steps so the inspector shows a moving bar on slow settings
    for (let i = 1; i <= 4; i++) { await sleep(wait / 4, ctx.signal); ctx.progress(i, 4); }
    this.hits.update((n) => n + 1);
    if (o.errorRate && this.r() < o.errorRate) return { status: 503, ok: false, headers: {}, data: { message: "Mock: simulated failure" }, from: "mock" };
    if (!route) return { status: 404, ok: false, headers: {}, data: { message: `Mock: no handler for ${ctx.req.method} ${u.pathname}` }, from: "mock" };
    const params = Object.fromEntries(route.r.keys.map((k, i) => [k, decodeURIComponent(route.m?.[i + 1] ?? "")]));
    const req: MockRequest = { method: ctx.req.method, path: u.pathname, params, query: Object.fromEntries(u.searchParams), body: structuredCopy(ctx.req.body), headers: ctx.req.headers, fake: this.f };
    let out: unknown;
    try { out = typeof route.r.handler === "function" ? await (route.r.handler as MockHandler)(req) : route.r.handler; }
    catch (e) { return { status: 500, ok: false, headers: {}, data: { message: (e as Error).message }, from: "mock" }; }
    const res = out instanceof MockReply ? out : new MockReply(200, out);
    return { status: res.status, ok: res.status < 400, headers: { "content-type": "application/json", ...res.headers }, data: structuredCopy(res.body ?? null), from: "mock" };
  }
}
const structuredCopy = <T>(v: T): T => (v === undefined || v === null || typeof v !== "object" || (typeof FormData !== "undefined" && v instanceof FormData) ? v : JSON.parse(JSON.stringify(v)) as T);

// ---------------------------------------------------------------- WebSocket
/** The server side of one mocked WebSocket connection. */
export interface MockClient {
  readonly path: string;
  readonly topics: Set<string>;
  send(msg: unknown): void;
  close(code?: number): void;
  onMessage(fn: (msg: any) => void): void;
}
type WsServer = { onConnect?: ((c: MockClient) => void) | undefined; onMessage?: ((msg: any, c: MockClient) => unknown) | undefined; clients: Set<MockClient & { sock: MockSocket }> };

class MockSocket implements SocketLike {
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: ((e: { code?: number; reason?: string }) => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onerror: (() => void) | null = null;
  private server: WsServer;
  constructor(server: WsServer, path: string, delay: number) {
    this.server = server;
    const handlers = new Set<(m: any) => void>();
    const client = {
      sock: this, path, topics: new Set<string>(),
      send: (msg: unknown) => { if (this.readyState === 1) setTimeout(() => this.onmessage?.({ data: JSON.stringify(msg) }), 0); },
      close: (code = 1000) => this.end(code),
      onMessage: (fn: (m: any) => void) => { handlers.add(fn); },
      handlers,
    };
    this.client = client;
    setTimeout(() => {
      if (this.readyState !== 0) return;
      this.readyState = 1;
      server.clients.add(client);
      this.onopen?.();
      server.onConnect?.(client);
    }, delay);
  }
  private client: MockClient & { sock: MockSocket; handlers: Set<(m: any) => void> };
  send(data: string): void {
    if (this.readyState !== 1) return;
    const msg = JSON.parse(data) as { type?: string; topic?: string; id?: string };
    const c = this.client;
    setTimeout(() => {
      if (msg.type === "ping") return c.send({ type: "pong" });
      if (msg.type === "sub" && msg.topic) { c.topics.add(msg.topic); return; }
      if (msg.type === "unsub" && msg.topic) { c.topics.delete(msg.topic); return; }
      for (const fn of c.handlers) fn(msg);
      const r = this.server.onMessage?.(msg, c);
      if (msg.id && r !== undefined) void Promise.resolve(r).then((data) => c.send({ re: msg.id, data }), (e: Error) => c.send({ re: msg.id, error: { message: e.message } }));
    }, 0);
  }
  close(code = 1000): void { this.end(code); }
  private end(code: number): void {
    if (this.readyState >= 2) return;
    this.readyState = 3;
    this.server.clients.delete(this.client);
    setTimeout(() => this.onclose?.({ code }), 0);
  }
}

// ---------------------------------------------------------------- net.mock()
/** In-memory WebSocket servers by path. `factory` creates client sockets for ManagedSocket ({ factory }). */
export interface MockSocketServer {
  readonly factory: (url: string) => SocketLike;
  /** Mock a WebSocket path: `onConnect` per connection; `onMessage` answers requests (its return value is the reply). */
  ws(path: string, onConnect?: (c: MockClient) => void, onMessage?: (msg: any, c: MockClient) => unknown): void;
  /** Send to every client on a path (only those subscribed to `topic` when given, as `{ topic, data }`). */
  publish(path: string, topicOrMsg: string | unknown, data?: unknown): number;
  /** Close every connection on a path (they reconnect). */
  drop(path: string): void;
  /** Connected mock clients on a path. */
  clients(path: string): number;
}
export interface MockController extends MockSocketServer {
  readonly transport: MockTransport;
  /** Change latency / error rate at run time. */
  set(o: MockOptions): void;
  /** Add handlers. */
  add(h: MockHandlers): void;
  /** Back to the real transport. */
  restore(): void;
}

const pathOf = (url: string): string => { try { return new URL(url).pathname; } catch { return url.replace(/^(wss?|sse):/, ""); } };

/** WebSocket servers in memory, independent of net.mock() (pass `factory` to a ManagedSocket). */
export function mockSocketServer(delay: () => number = () => 20): MockSocketServer {
  const servers = new Map<string, WsServer>();
  return {
    factory: (url) => {
      const s = servers.get(pathOf(url));
      if (!s) throw new Error(`Mock: no WebSocket at ${pathOf(url)}`);
      return new MockSocket(s, pathOf(url), delay());
    },
    ws: (path, onConnect, onMessage) => { servers.set(path, { onConnect, onMessage, clients: servers.get(path)?.clients ?? new Set() }); },
    publish: (path, topicOrMsg, data) => {
      let n = 0;
      for (const c of servers.get(path)?.clients ?? []) {
        if (data === undefined) { c.send(topicOrMsg); n++; }
        else if (c.topics.has(topicOrMsg as string)) { c.send({ topic: topicOrMsg, data }); n++; }
      }
      return n;
    },
    drop: (path) => { for (const c of [...(servers.get(path)?.clients ?? [])]) c.close(4001); },
    clients: (path) => servers.get(path)?.clients.size ?? 0,
  };
}

/** Install the mock provider on a Net instance (replaces its `http` transport until restore()). */
export function mock(net: Net, handlers: MockHandlers | OpenApi = {}, o: MockOptions = {}): MockController {
  const real = net.transports.get("http") ?? null;
  const prev = net.store.get("mock:real") as Transport | undefined;
  const t = new MockTransport(isOpenApi(handlers) ? fromOpenApi(handlers) : handlers, o, prev ?? real);
  if (!prev && real) net.store.set("mock:real", real);
  net.transport(t, "http");
  const server = mockSocketServer(() => { const d = t.options.peek().delay; return Array.isArray(d) ? d[0] : d; });
  setSocketFactory(server.factory);
  const ctl: MockController = {
    ...server,
    transport: t,
    set: (x) => t.set(x),
    add: (h) => t.add(h),
    restore: () => { const r = net.store.get("mock:real") as Transport | undefined; if (r) net.transport(r, "http"); net.store.delete("mock:real"); setSocketFactory(null); },
  };
  net.store.set("mock:ctl", ctl);
  return ctl;
}

/** True under `march dev --mock` (the build defines globalThis.MARCH_MOCK) or with `?mock` in the page url. */
export const mockRequested = (): boolean => !!(globalThis as { MARCH_MOCK?: unknown }).MARCH_MOCK
  || /[?&]mock(=1|=true)?(&|$)/.test((globalThis as { location?: { search: string } }).location?.search ?? "");

declare module "./core.ts" {
  interface Net {
    /** Answer requests from handlers or an OpenAPI document (`false` = back to the real transport). */
    mock(handlers: MockHandlers | OpenApi | false, o?: MockOptions): MockController;
  }
}
Net.prototype.mock = function (this: Net, h: MockHandlers | OpenApi | false, o?: MockOptions): MockController {
  const cur = this.store.get("mock:ctl") as MockController | undefined;
  if (h === false) { cur?.restore(); this.store.delete("mock:ctl"); return cur as MockController; }
  return mock(this, h, o);
};
