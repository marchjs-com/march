// Ready-made middleware: `net.use(auth({ token, refresh }), acceptLanguage(), idempotencyKey(), cache(), timing(), log())`.
// Each is `(ctx, next)`; code before `await next()` sees the request, code after it sees ctx.res (or a thrown AppError).
import { named, duration, type Ctx, type Middleware, type NetResponse, type RetryOptions } from "./core.ts";
import { AppError } from "../errors/app-error.ts";
import { locale } from "../core/i18n.ts";

/** Bearer (or other) auth header; on 401 calls `refresh` once (shared by concurrent requests) and retries. */
export function auth(o: { token: () => string | null | undefined | Promise<string | null | undefined>; refresh?: () => Promise<unknown>; header?: string; scheme?: string; skip?: (ctx: Ctx) => boolean }): Middleware {
  let refreshing: Promise<unknown> | null = null;
  const header = o.header ?? "authorization", scheme = o.scheme ?? "Bearer";
  const set = async (ctx: Ctx): Promise<void> => { const t = await o.token(); if (t) ctx.req.headers[header] = scheme ? `${scheme} ${t}` : t; else delete ctx.req.headers[header]; };
  return named("auth", async (ctx, next) => {
    if (o.skip?.(ctx)) return next();
    await set(ctx);
    try { await next(); }
    catch (e) {
      if ((e as AppError).status !== 401 || !o.refresh || ctx.state["authRetried"]) throw e;
      ctx.state["authRetried"] = true;
      refreshing ??= o.refresh().finally(() => { refreshing = null; });
      await refreshing;
      await set(ctx);
      await next();
    }
  });
}

/** Accept-Language from the March locale (or your own function). */
export const acceptLanguage = (lang: () => string = () => locale()): Middleware =>
  named("accept-language", (ctx, next) => { ctx.req.headers["accept-language"] ??= lang(); return next(); });

/** Idempotency-Key for writes: one key per logical request, the same on every retry. */
export const idempotencyKey = (o: { header?: string; methods?: readonly string[] } = {}): Middleware =>
  named("idempotency-key", (ctx, next) => {
    const h = o.header ?? "idempotency-key";
    if ((o.methods ?? ["POST", "PATCH"]).includes(ctx.req.method)) {
      ctx.req.headers[h] ??= globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      ctx.req.idempotent = true; // the server de-duplicates: safe to retry
    }
    return next();
  });

/** Retry policy for the requests below it (the retry itself is built in and runs right before the transport). */
export const retry = (o: Partial<RetryOptions> & { when?: (ctx: Ctx) => boolean }): Middleware =>
  named("retry-policy", (ctx, next) => { if (!o.when || o.when(ctx)) ctx.req.retry = { ...ctx.req.retry, ...o }; return next(); });

interface CacheEntry { at: number; res: NetResponse; category: string }
/** Stale-while-revalidate cache for GET requests with a `cache` freshness ("5m"). Fresh → served from cache; stale →
 *  served from cache and refreshed in the background (fires net:revalidate); `maxAge` drops very old entries. */
export function cache(o: { maxEntries?: number; maxAge?: number | string } = {}): Middleware {
  const maxAge = duration(o.maxAge ?? "1d"), max = o.maxEntries ?? 200;
  return named("cache", async (ctx, next) => {
    const { req } = ctx;
    if (req.method !== "GET" || !req.cache) return next();
    const ck = typeof req.meta["cacheKey"] === "string" ? req.meta["cacheKey"] : req.key;
    const k = "cache:" + ck;
    const hit = ctx.net.store.get(k) as CacheEntry | undefined;
    const age = hit ? Date.now() - hit.at : Infinity;
    if (hit && !req.meta["revalidate"] && age < maxAge) {
      ctx.res = { ...hit.res, from: "cache" };
      ctx.state["cacheAge"] = age;
      if (age >= req.cache) {
        ctx.state["stale"] = true;
        void ctx.net.send({ ...ctx.options, policy: "dedupe", key: ck + "#revalidate", meta: { ...req.meta, cacheKey: ck, revalidate: true }, report: false })
          .then(() => ctx.net.emit("net:revalidate", { ctx }), () => undefined);
      }
      return;
    }
    await next();
    if (ctx.res?.ok) {
      ctx.net.store.delete(k);
      ctx.net.store.set(k, { at: Date.now(), res: ctx.res, category: req.category } satisfies CacheEntry);
      const keys = [...ctx.net.store.keys()].filter((x) => x.startsWith("cache:"));
      if (keys.length > max) ctx.net.store.delete(keys[0] as string);
    }
  });
}

/** Server-Timing and total time: ctx.state.ms, ctx.state.serverTiming ({ name: ms }). */
export const timing = (): Middleware => named("timing", async (ctx, next) => {
  const t0 = globalThis.performance?.now() ?? Date.now();
  try { await next(); } finally {
    ctx.state["ms"] = Math.round((globalThis.performance?.now() ?? Date.now()) - t0);
    const st = ctx.res?.headers["server-timing"];
    if (st) ctx.state["serverTiming"] = Object.fromEntries(st.split(",").map((p) => { const [n, ...a] = p.trim().split(";"); const d = a.find((x) => x.trim().startsWith("dur=")); return [n, d ? Number(d.split("=")[1]) : 0]; }));
  }
});

/** One line per request (development). */
export const log = (o: { out?: (line: string, ctx: Ctx) => void; filter?: (ctx: Ctx) => boolean } = {}): Middleware => named("log", async (ctx, next) => {
  const out = o.out ?? ((l: string) => console.debug(l));
  const t0 = Date.now();
  try { await next(); if (!o.filter || o.filter(ctx)) out(`${ctx.req.method} ${ctx.req.url} → ${ctx.res?.status} ${ctx.res?.from ?? ""} ${Date.now() - t0}ms`, ctx); }
  catch (e) { if (!o.filter || o.filter(ctx)) out(`${ctx.req.method} ${ctx.req.url} ✖ ${(e as Error).message} ${Date.now() - t0}ms`, ctx); throw e; }
});

/** A recording: request key → response (JSON-safe, so it can be saved to a file and replayed in tests). */
export type Recording = Record<string, { status: number; headers: Record<string, string>; data: unknown }>;
/** Record every response into `into` (keyed by method + url + query). */
export const record = (into: Recording): Middleware => named("record", async (ctx, next) => {
  await next();
  if (ctx.res) into[ctx.req.key] = { status: ctx.res.status, headers: ctx.res.headers, data: ctx.res.data };
});
/** Answer from a recording; unknown requests go on to the network (or fail with `strict`). */
export const replay = (from: Recording, o: { strict?: boolean } = {}): Middleware => named("replay", (ctx, next) => {
  const r = from[ctx.req.key];
  if (r) { ctx.res = { ...r, ok: r.status < 400, from: "replay" }; if (!ctx.res.ok) throw new AppError(`HTTP ${r.status}`, { status: r.status, source: "net", context: { body: r.data } }); return; }
  if (o.strict) throw new AppError(`Not recorded: ${ctx.req.key}`, { type: "notFound", source: "net" });
  return next();
});

/** Error normalization: field errors from common body shapes go to `context.fields`; `map` may change the error. */
export const normalizeErrors = (o: { map?: (e: AppError, ctx: Ctx) => AppError | void } = {}): Middleware => named("errors", async (ctx, next) => {
  try { await next(); }
  catch (e) {
    let err = AppError.from(e, { source: "net" });
    const body = err.context["body"] as { errors?: unknown; fields?: unknown; detail?: unknown } | undefined;
    const fields = body?.fields ?? body?.errors;
    if (fields && typeof fields === "object" && !err.context["fields"]) { err.context["fields"] = fields; if (err.type === "http") err.type = "validation"; }
    err = o.map?.(err, ctx) ?? err;
    throw err;
  }
});
