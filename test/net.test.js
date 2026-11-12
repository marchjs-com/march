import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";
installDom({ url: "http://localhost/" });
const N = await import("../src/net/index.ts");
const M = await import("../src/net/mock.ts");
const { createRoot } = await import("../src/core/reactive.ts");
const { runLoad, setLoadRunner } = await import("../src/dom/preload.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
/** A Net whose http transport is a function (status, data) with a call log. */
function fakeNet(answer, cfg = {}) {
  const n = new N.Net({ retry: { delay: 1, max: 5 }, ...cfg });
  const calls = [];
  n.transport({ name: "http", async send(ctx) {
    calls.push(ctx.req);
    const r = await answer(ctx, calls.length);
    return { status: r?.status ?? 200, ok: (r?.status ?? 200) < 400, headers: r?.headers ?? {}, data: r && "data" in r ? r.data : r, from: "network" };
  } });
  return { n, calls };
}
const later = (ms, v) => (ctx) => new Promise((res, rej) => { const t = setTimeout(() => res({ data: v }), ms); ctx.signal.addEventListener("abort", () => { clearTimeout(t); rej(Object.assign(new Error("Aborted"), { name: "AbortError" })); }); });

test("net: dedupe shares one request; one caller's abort does not cancel the others", async () => {
  const { n, calls } = fakeNet(later(10, [1, 2]));
  const ctl = new AbortController();
  const a = n.get("/users"), b = n.get("/users"), c = n.get("/users", { signal: ctl.signal });
  ctl.abort();
  await assert.rejects(c, (e) => e.name === "AbortError");
  assert.deepEqual(await Promise.all([a, b]), [[1, 2], [1, 2]]);
  assert.equal(calls.length, 1, "three callers, one request");
  await n.get("/users");
  assert.equal(calls.length, 2, "a finished request is not shared");
});

test("net: latest aborts the older request of the category; queue runs one after another", async () => {
  const { n, calls } = fakeNet((ctx) => later(15, ctx.req.query.q)(ctx));
  const aborted = [];
  n.on("net:abort", (e) => aborted.push(e.ctx.req.query.q));
  const s1 = n.get("/search", { query: { q: "a" }, category: "search", policy: "latest" });
  const s2 = n.get("/search", { query: { q: "ab" }, category: "search", policy: "latest" });
  await assert.rejects(s1, (e) => e.name === "AbortError" && e.type === "abort");
  assert.equal(await s2, "ab");
  assert.deepEqual(aborted, ["a"]);
  const order = [];
  const { n: q } = fakeNet(async (ctx) => { order.push("start " + ctx.req.body); await tick(5); order.push("end " + ctx.req.body); return { data: ctx.req.body }; });
  await Promise.all([1, 2, 3].map((i) => q.post("/save", i, { category: "save", policy: "queue" })));
  assert.deepEqual(order, ["start 1", "end 1", "start 2", "end 2", "start 3", "end 3"]);
  assert.equal(calls.length, 2);
});

test("net: priority (route > data > prefetch), concurrency, prefetch waits while a route loads", async () => {
  const order = [];
  const { n } = fakeNet(async (ctx) => { order.push(ctx.req.url); await tick(5); return { data: 1 }; }, { maxConcurrent: 1 });
  const p = [n.get("/a"), n.get("/pre", { priority: "prefetch" }), n.get("/data"), n.get("/route", { priority: "route" })];
  await Promise.all(p);
  assert.deepEqual(order, ["/a", "/route", "/data", "/pre"]);
  order.length = 0;
  const { n: n2 } = fakeNet(async (ctx) => { order.push(ctx.req.url); await tick(ctx.req.url === "/route" ? 20 : 1); return { data: 1 }; });
  const r = n2.get("/route", { priority: "route" });
  const pre = n2.get("/pre", { priority: "prefetch" });
  const d = n2.get("/data");
  await d;
  assert.deepEqual(order, ["/route", "/data"], "prefetch held back while the route loads");
  await Promise.all([r, pre]);
  assert.deepEqual(order, ["/route", "/data", "/pre"]);
  n2.pausePrefetch(true);
  let done = false;
  const p3 = n2.get("/pre2", { priority: "prefetch" }).then(() => (done = true));
  await tick(10);
  assert.equal(done, false);
  n2.pausePrefetch(false);
  await p3;
});

test("net: retry with backoff only for idempotent requests; timeout; error normalization", async () => {
  const { n, calls } = fakeNet((_, i) => (i < 3 ? { status: 503, data: { message: "busy" } } : { data: "ok" }));
  const retries = [];
  n.on("net:retry", (e) => retries.push(e.error.status));
  assert.equal(await n.get("/x"), "ok");
  assert.equal(calls.length, 3);
  assert.deepEqual(retries, [503, 503]);
  const { n: w, calls: wc } = fakeNet(() => ({ status: 503 }));
  await assert.rejects(w.post("/x", {}), (e) => e instanceof N.AppError && e.type === "server" && e.status === 503 && e.retryable);
  assert.equal(wc.length, 1, "a POST is not retried");
  const { n: nf } = fakeNet(() => ({ status: 404, data: { message: "No such user", code: "USER_MISSING" } }));
  await assert.rejects(nf.get("/u/1"), (e) => e.type === "notFound" && e.code === "USER_MISSING" && e.message === "No such user" && e.context.url === "/u/1");
  const { n: slow } = fakeNet(later(50, 1));
  await assert.rejects(slow.get("/slow", { timeout: 10, retry: 0 }), (e) => e.type === "timeout");
});

test("net: events, pending(category), offline queue", async () => {
  const { n } = fakeNet(later(5, "v"));
  const seen = [];
  for (const ev of ["net:start", "net:progress", "net:done", "net:error"]) n.on(ev, (e) => seen.push(ev + " " + e.ctx.req.url));
  let pend = [];
  createRoot(() => { const { effect } = globalThis.__march_effect ?? {}; void effect; });
  const p = n.get("/users", { category: "users" });
  await tick(1);
  pend.push(n.pending("users"), n.pending());
  await p;
  pend.push(n.pending("users"));
  assert.deepEqual(pend, [1, 1, 0]);
  assert.deepEqual(seen, ["net:start /users", "net:done /users"]);
  n.setOnline(false);
  const q = n.post("/save", { a: 1 });
  await tick(5);
  assert.equal(n.offlineQueue(), 1);
  await assert.rejects(n.get("/now", { offline: "fail" }), (e) => e.type === "offline");
  n.setOnline(true);
  assert.equal(await q, "v");
  assert.equal(n.offlineQueue(), 0);
});

test("net: middleware chain (order, timing steps, auth refresh on 401, idempotency key, accept-language)", async () => {
  let token = "old";
  const { n, calls } = fakeNet((ctx) => (ctx.req.headers.authorization === "Bearer old" ? { status: 401 } : { data: ctx.req.headers }));
  let refreshes = 0;
  const trace = [];
  n.use(N.named("outer", async (ctx, next) => { trace.push("in"); await next(); trace.push("out " + ctx.res.status); }));
  n.use(N.auth({ token: () => token, refresh: async () => { refreshes++; await tick(2); token = "new"; } }), N.acceptLanguage(() => "tr"), N.idempotencyKey());
  const [h1, h2] = await Promise.all([n.post("/a", {}), n.post("/b", {})]);
  assert.equal(refreshes, 1, "one refresh for concurrent 401s");
  assert.equal(h1.authorization, "Bearer new");
  assert.equal(h1["accept-language"], "tr");
  assert.ok(h1["idempotency-key"] && h1["idempotency-key"] !== h2["idempotency-key"]);
  assert.deepEqual(trace, ["in", "in", "out 200", "out 200"]);
  assert.equal(calls.length, 4);
  let steps;
  n.on("net:done", (e) => (steps = e.ctx.steps.map((s) => s.name)));
  await n.get("/c");
  assert.deepEqual(steps, ["outer", "auth", "accept-language", "idempotency-key", "retry", "timeout", "transport:http"]);
});

test("net: cache (stale-while-revalidate), record / replay, invalidate", async () => {
  let v = 1;
  const { n, calls } = fakeNet(() => ({ data: v }));
  n.use(N.cache());
  assert.equal(await n.get("/c", { cache: 30, category: "c" }), 1);
  v = 2;
  assert.equal(await n.get("/c", { cache: 30, category: "c" }), 1, "fresh: from cache");
  assert.equal(calls.length, 1);
  await tick(40);
  const revalidated = new Promise((r) => n.on("net:revalidate", r));
  assert.equal(await n.get("/c", { cache: 30, category: "c" }), 1, "stale: served at once");
  await revalidated;
  assert.equal(calls.length, 2);
  assert.equal(await n.get("/c", { cache: 30, category: "c" }), 2, "then the new value");
  n.invalidate("c");
  v = 3;
  assert.equal(await n.get("/c", { cache: 30, category: "c" }), 3);
  const rec = {};
  const { n: r } = fakeNet(() => ({ data: { hello: "world" } }));
  r.use(N.record(rec));
  await r.get("/hello", { query: { a: 1 } });
  assert.deepEqual(Object.keys(rec), ["GET /hello?a=1"]);
  const { n: p, calls: pc } = fakeNet(() => ({ data: "network" }));
  p.use(N.replay(rec));
  assert.deepEqual(await p.get("/hello", { query: { a: 1 } }), { hello: "world" });
  assert.equal(await p.get("/other"), "network");
  assert.equal(pc.length, 1);
});

test("net: router / lazy() chunk loads run through net (route priority, events)", async () => {
  const n = N.createNet();
  N.routeLoads(n);
  const seen = [];
  n.on("net:done", (e) => seen.push(e.ctx.req.category + ":" + e.ctx.req.priority));
  const m = await runLoad(async () => ({ default: "page" }), { kind: "route", key: "pages/x.tsx" });
  assert.equal(m.default, "page");
  await runLoad(async () => ({ default: "part" }), { kind: "part", key: "" });
  assert.deepEqual(seen, ["route:route", "part:data"]);
  N.routeLoads();
  setLoadRunner(null);
});

test("api classes: typed endpoints, params split, schema validation, query / mutation, invalidation", async () => {
  const n = N.createNet();
  const m = n.mock({ ...M.crud("/users", [{ id: "1", name: "Ada" }, { id: "2", name: "Alan" }]) }, { delay: 0 });
  class UsersApi extends N.Api {
    base = "/users";
    list = this.get("/", { category: "users" });
    byId = this.get("/:id", { schema: { validate: (x) => ({ ok: typeof x.name === "string", errors: { name: "required" } }) } });
    update = this.patch("/:id", { invalidates: ["users"] });
  }
  const users = N.api(UsersApi, { net: n });
  assert.equal((await users.list()).length, 2);
  assert.deepEqual(await users.byId({ id: "2" }), { id: "2", name: "Alan" });
  assert.equal(users.byId.url({ id: "7" }), "/users/7");
  assert.deepEqual(users.list.key(), ["users", "/", null]);
  let q;
  createRoot(() => { q = users.list.query(); });
  for (let i = 0; i < 40 && !q(); i++) await tick(5);
  assert.equal(q().length, 2);
  const save = users.update.mutation();
  await save({ id: "1", name: "Ada L." });
  for (let i = 0; i < 40 && q()[0].name !== "Ada L."; i++) await tick(5);
  assert.equal(q()[0].name, "Ada L.", "the list query refetched after the update");
  m.add({ "GET /users/:id": () => ({ id: "9" }) });
  await assert.rejects(users.byId({ id: "9" }), (e) => e.type === "validation" && e.context.fields.name === "required");
  n.mock(false);
});

test("mock: delay, error rate, seeded data, OpenAPI, stateful CRUD", async () => {
  const n = N.createNet({ retry: { count: 0 } });
  const m = n.mock({ ...M.crud("/items", (f) => f.list(5, (i) => ({ id: String(i + 1), name: f.name() }))), "POST /login": (r) => (r.body.password === "x" ? { token: "t" } : M.reply(401, { message: "Wrong password" })) }, { delay: 0, seed: 3 });
  const a = await n.get("/items");
  assert.equal(a.length, 5);
  const again = N.createNet();
  again.mock({ ...M.crud("/items", (f) => f.list(5, (i) => ({ id: String(i + 1), name: f.name() }))) }, { delay: 0, seed: 3 });
  assert.deepEqual(await again.get("/items"), a, "same seed, same data");
  const created = await n.post("/items", { name: "New" });
  assert.equal((await n.get("/items")).length, 6);
  await n.delete(`/items/${created.id}`);
  assert.equal((await n.get("/items", { query: { q: "new" } })).length, 0);
  await assert.rejects(n.post("/login", { password: "no" }), (e) => e.type === "auth" && e.message === "Wrong password");
  m.set({ errorRate: 1 });
  await assert.rejects(n.get("/items"), (e) => e.status === 503);
  m.set({ errorRate: 0, delay: 30 });
  const t0 = Date.now();
  await n.get("/items/1");
  assert.ok(Date.now() - t0 >= 25, "delay applies");
  const doc = { openapi: "3.0.0", paths: { "/pets/{id}": { get: { responses: { 200: { content: { "application/json": { schema: { $ref: "#/components/schemas/Pet" } } } } } } } }, components: { schemas: { Pet: { type: "object", properties: { id: { type: "integer" }, name: { type: "string" }, kind: { enum: ["cat", "dog"] } } } } } };
  const o = N.createNet();
  o.mock(doc, { delay: 0 });
  const pet = await o.get("/pets/1");
  assert.equal(typeof pet.id, "number");
  assert.ok(["cat", "dog"].includes(pet.kind));
  n.mock(false);
  o.mock(false);
});

test("websocket: managed socket with mock server — subscribe, request/reply, offline queue, reconnect", async () => {
  const n = N.createNet();
  const m = n.mock({}, { delay: 1 });
  m.ws("/live", (c) => c.send({ type: "hello" }), (msg) => (msg.type === "add" ? msg.a + msg.b : undefined));
  const s = new N.ManagedSocket("ws:/live", { reconnect: { min: 5, max: 10, jitter: 0 }, heartbeat: false });
  const hello = [], users = [];
  s.on("hello", (x) => hello.push(x));
  s.subscribe("users", (x) => users.push(x.data));
  s.send({ type: "queued" });
  assert.equal(s.queued(), 1, "queued until open");
  await tick(10);
  assert.equal(s.state(), "open");
  assert.equal(s.queued(), 0);
  assert.equal(hello.length, 1);
  assert.equal(await s.request({ type: "add", a: 2, b: 3 }), 5);
  m.publish("/live", "users", { id: 1 });
  await tick(5);
  assert.deepEqual(users, [{ id: 1 }]);
  m.drop("/live");
  await tick(2);
  assert.equal(s.state(), "reconnecting");
  for (let i = 0; i < 50 && s.state() !== "open"; i++) await tick(5);
  assert.equal(s.state(), "open", "reconnected");
  await tick(20);
  m.publish("/live", "users", { id: 2 });
  await tick(5);
  assert.deepEqual(users, [{ id: 1 }, { id: 2 }], "subscription renewed after reconnect");
  s.close();
  assert.equal(s.state(), "closed");
  n.mock(false);
  assert.ok(N.backoff(3, { min: 100, max: 1000, jitter: 0 }) === 800);
});

test("api: stream over ws (mock)", async () => {
  const n = N.createNet();
  const m = n.mock({}, { delay: 1 });
  m.ws("/users/events");
  class UsersApi extends N.Api { live = this.stream("ws:/users/events#users"); }
  const u = N.api(UsersApi, { net: n });
  const got = [];
  const off = u.live.subscribe((e) => got.push(e));
  for (let i = 0; i < 100 && m.publish("/users/events", "users", { kind: "joined" }) === 0; i++) await tick(5);
  for (let i = 0; i < 100 && !got.length; i++) await tick(5);
  assert.deepEqual(got.map((x) => x.data.kind), ["joined"]);
  off();
  N.closeSockets();
  n.mock(false);
});

test("march gen api --classes: Api classes and interfaces from OpenAPI", async () => {
  const { genApiClasses } = await import("../cli/openapi.js");
  const code = genApiClasses({ openapi: "3.0.0", servers: [{ url: "https://x.test/v1" }], paths: {
    "/users": { get: { tags: ["users"], operationId: "listUsers", parameters: [{ name: "q", in: "query", schema: { type: "string" } }], responses: { 200: { content: { "application/json": { schema: { type: "array", items: { $ref: "#/components/schemas/User" } } } } } } } },
    "/users/{id}": { patch: { tags: ["users"], operationId: "updateUser", parameters: [{ name: "id", in: "path", required: true, schema: { type: "string" } }], requestBody: { content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } }, responses: { 200: { content: { "application/json": { schema: { $ref: "#/components/schemas/User" } } } } } } },
  }, components: { schemas: { User: { type: "object", required: ["id"], properties: { id: { type: "string" }, name: { type: "string" } } } } } });
  assert.match(code, /export interface User \{ id: string; name\?: string \}/);
  assert.match(code, /export class UsersApi extends Api \{/);
  assert.match(code, /base = "\/v1";/);
  assert.match(code, /listUsers = this\.get<User\[\], \{ q\?: string \}>\("\/users"\);/);
  assert.match(code, /updateUser = this\.patch<User, \{ id: string \} & User>\("\/users\/:id", \{ category: "users" \}\);/);
});
