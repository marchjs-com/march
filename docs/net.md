# hadi-march/net and hadi-march/errors

One place for all traffic, one collector for all errors. App code never calls `fetch()` / `new WebSocket()` itself.

## Request options (`net.request(o)`, `net.get/post/put/patch/delete`)

| option | default | |
|---|---|---|
| `category` | `"default"` | group for `latest` / `queue`, `pending(category)`, `invalidate(category)`, `cancel(category)` |
| `key` | `METHOD url?query` | identity for `dedupe` and the cache |
| `policy` | GET/HEAD/OPTIONS `dedupe`, else `parallel` | `latest` aborts the older request of the category; `queue` runs one at a time |
| `priority` | `data` | `route` > `data` > `prefetch`; prefetch waits while a route loads or `pausePrefetch(true)` |
| `timeout` | 30 s | per attempt; a timeout is an AppError `type: "timeout"` |
| `retry` | 2 (delay 300 ms ×2, max 10 s, jitter) | only for idempotent requests (GET/HEAD/OPTIONS/PUT/DELETE, or `idempotent: true`) and retryable errors (network, timeout, 408/429/5xx); `Retry-After` is honoured |
| `offline` | `wait` | `wait`: held in the offline queue until online (`net.offlineQueue()`); `fail`: AppError `offline` |
| `cache` | — | freshness for the `cache()` middleware: `"30s"`, `"5m"`, ms |
| `invalidates` | — | categories / key prefixes cleared after success (net cache + hadi-march/data queries) |
| `use` | — | middleware for this request only |
| `meta` | — | free data for middleware; `meta.target` becomes `error.context.target` (inline error slot) |
| `report` | `true` | `false`: a failure is not sent to hadi-march/errors |
| `run` | — | run a function instead of a transport (chunk loads use it) |

Events: `net:start`, `net:progress`, `net:retry`, `net:done`, `net:error`, `net:abort`, `net:revalidate`
(`net.on(name, ({ ctx, error, loaded, total }) => …)`). `ctx.steps` holds every middleware step with its start and
duration (the showcase request inspector draws them).

## Middleware

`(ctx, next) => …` in the order added (`net.use(a, b)`), then the built-in `retry` → `timeout` → transport. `next` may be
called again (retry and the auth refresh do).

`auth({ token, refresh })` · `acceptLanguage()` · `idempotencyKey()` · `retry({ count, delay })` (policy) ·
`cache({ maxEntries, maxAge })` (stale-while-revalidate) · `timing()` (+ Server-Timing) · `log()` · `record(rec)` /
`replay(rec, { strict })` · `normalizeErrors({ map })` (field errors → `context.fields`). Name your own with
`named("name", fn)`.

## Transports

`HttpTransport` (fetch, download progress), `WsTransport` (`ws:` urls: request by correlation id, `#topic` streams),
`SseTransport` (`sse:` urls), `MockTransport` (hadi-march/net/mock). All implement `send(ctx)` and optionally
`stream(url, onMessage, { signal })`. Register your own with `net.transport(t, "name")`.

## Api classes

`this.get/post/put/patch/delete<Result, Vars>(path, opts)` returns an endpoint: call it with the variables (path
`:params` are taken from them; the rest is the query for GET/DELETE and the body otherwise), or use `.query(vars)`,
`.mutation()`, `.key(vars)`, `.url(vars)`. `schema` validates the response (hadi-march/schema, anything with `parse`, or
a function). `this.stream<T>("ws:/path#topic")` → `subscribe(fn)` / `latest()`. `api(Cls)` gives one instance;
`api(Cls, { net })` binds another Net (tests).

`march gen api openapi.json --classes [--out src/api.gen.ts]` writes one class per tag and interfaces for the schemas.

## WebSocket

`socket(url, opts)` / `new ManagedSocket(url, opts)`: `state()` (`idle | connecting | open | reconnecting | closed`),
`attempts()`, `queued()`, `send(msg)` (queued while disconnected), `request(msg, { timeout })`, `subscribe(topic, fn)`
(renewed after reconnect), `on(type | "*", fn)`, `drop()`, `close()`. Options: `reconnect: { min, max, factor, jitter }`,
`heartbeat: { interval, timeout }`, `queue`, `lazy`, `shared` (one connection for all tabs: Web Locks leader +
BroadcastChannel), `protocol` (how topics, ids and pings look on the wire), `factory`.

## Mock

```ts
import "hadi-march/net/mock";
import { crud, reply, fake, mockSocketServer } from "hadi-march/net/mock";
const m = net.mock({ ...crud("/api/users", (f) => f.list(20, (i) => ({ id: String(i + 1), name: f.name() }))),
  "POST /api/login": (r) => (r.body.password ? { token: "t" } : reply(401, { message: "Wrong password" })) },
  { delay: [80, 250], errorRate: 0.05, seed: 7 });
m.set({ delay: 2000 });                      // slow network
m.ws("/api/live", (client) => client.send({ type: "hello" }), (msg) => (msg.type === "ping" ? "pong" : undefined));
m.publish("/api/live", "users", { id: 1 });  m.drop("/api/live");
net.mock(openapiDoc);                         // examples, or data generated from the schemas (seeded)
net.mock(false);                              // back to the server
```
`march dev --mock` (with or without a spec file) sets `globalThis.MARCH_MOCK`; `mockRequested()` is true then (and
with `?mock` in the page url): `if (mockRequested()) net.mock(handlers)`.

## Errors

`errors.install({ window, boundaries, dev })` · `errors.capture(e, init)` · `errors.rule(match, "toast" | "inline" |
"page" | "silent" | fn)` (first match wins; built-in rules after yours: aborts/info silent, WebSocket warnings silent,
errors a boundary already shows silent, targeted validation inline, fatal page, rest toast) · `errors.report(fn)`
(JSON-safe copy, once per de-duplicated error; off by default) · `errors.on("error:captured" | "error:shown" |
"error:reported" | "error:cleared", fn)` · `errors.message(e)` (translated) · `errors.list()`, `errors.page()`,
`errors.inline(target)` signals · `<ErrorPage>`, `<ErrorInline target>` · `errors.dev(true)` developer layer.
Same type / code / status / message / source within 3 s counts up instead of showing again.
