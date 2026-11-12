// Object-based API classes on top of net:
//
//   class UsersApi extends Api {
//     base = "/users";
//     list = this.get<User[]>("/", { cache: "5m", category: "users" });
//     byId = this.get<User, { id: string }>("/:id");
//     update = this.patch<User, Partial<User> & { id: string }>("/:id", { invalidates: ["users"] });
//     live = this.stream<UserEvent>("ws:/users/events");
//   }
//   const users = api(UsersApi);
//   await users.byId({ id: "7" });                      // typed params, typed result
//   const list = users.list.query();                     // hadi-march/data query, key ["users", "/", null]
//   const save = users.update.mutation();                // invalidates "users" (net cache + data queries)
//   users.live.subscribe((e) => …);
import { invalidate as invalidateQueries, query as dataQuery, mutation as dataMutation, type Query, type QueryOptions, type Mutation, type MutationOptions } from "../data/index.ts";
import { signal, onCleanup, getOwner, type Accessor } from "../core/reactive.ts";
import { AppError } from "../errors/app-error.ts";
import { onInvalidate, type Net, type RequestOptions } from "./core.ts";

/** A validator: hadi-march/schema (`validate` → { ok, errors }), anything with `parse` (zod-like) or a function. */
export type Validator<R> = ((x: unknown) => R) | { parse(x: unknown): unknown } | { validate(x: unknown): unknown };
export type CallOptions = Omit<RequestOptions, "url" | "method" | "params" | "body">;
export interface EndpointOptions<R> extends CallOptions { schema?: Validator<R> }

/** Arguments of an endpoint call: no variables → optional; all-optional variables → optional; else required. */
export type EndpointArgs<P> = [P] extends [void] ? [vars?: undefined, opts?: CallOptions] : {} extends P ? [vars?: P, opts?: CallOptions] : [vars: P, opts?: CallOptions];

export interface Endpoint<P, R> {
  (...args: EndpointArgs<P>): Promise<R>;
  readonly method: string;
  readonly path: string;
  /** The hadi-march/data cache key for these variables: [category, path, vars]. */
  key(vars?: P): unknown[];
  /** The url these variables produce. */
  url(vars?: P): string;
  /** A reactive query (vars may be a function reading signals). Retry is left to net. */
  query(vars?: P | (() => P), opts?: QueryOptions<R>): Query<R>;
  /** A mutation that invalidates what the endpoint declares. */
  mutation(opts?: MutationOptions<P, R>): Mutation<P, R>;
}

export interface Stream<T> {
  readonly url: string;
  /** Receive messages until the returned function is called (or the owner is disposed). */
  subscribe(fn: (msg: T) => void, opts?: { signal?: AbortSignal | undefined }): () => void;
  /** The last message as a signal (subscribes while the calling component lives). */
  latest(): Accessor<T | undefined>;
}

let defaultNet: (() => Net) | null = null;
/** index.ts sets the default Net instance. */
export function setDefaultNet(get: () => Net): void { defaultNet = get; }

function validate<R>(v: Validator<R> | undefined, data: unknown): R {
  if (!v) return data as R;
  const one = (x: unknown): unknown => {
    if (typeof v === "function") return (v as (x: unknown) => R)(x);
    if ("validate" in v) {
      const r = v.validate(x) as { ok?: boolean; errors?: Record<string, string>; values?: unknown } | null;
      if (r && typeof r === "object" && "ok" in r) {
        if (!r.ok) throw new AppError("Invalid response", { type: "validation", source: "net", context: { fields: r.errors } });
        return x;
      }
      return x;
    }
    return v.parse(x);
  };
  return (Array.isArray(data) && !(typeof v === "function") ? data.map(one) : one(data)) as R;
}

const hooked = new WeakSet<Net>();
function hook(net: Net): void {
  if (hooked.has(net)) return;
  hooked.add(net);
  net.on("net:revalidate", ({ ctx }) => { const k = ctx.req.meta["queryKey"]; if (k) invalidateQueries(k); });
}
onInvalidate((prefix) => invalidateQueries(prefix));

/** Base class for a typed API: one method per endpoint, cached queries and invalidation through net. */
export class Api {
  /** Path prefix of every endpoint. */
  base = "";
  /** Default category (else the first segment of `base`). */
  category?: string;
  /** Options for every endpoint of this class. */
  defaults: CallOptions = {};
  /** The Net instance (api() sets it; default: the global net). */
  net?: Net;

  protected get<R, P = void>(path: string, opts: EndpointOptions<R> = {}): Endpoint<P, R> { return this.endpoint<P, R>("GET", path, opts); }
  protected post<R, P = void>(path: string, opts: EndpointOptions<R> = {}): Endpoint<P, R> { return this.endpoint<P, R>("POST", path, opts); }
  protected put<R, P = void>(path: string, opts: EndpointOptions<R> = {}): Endpoint<P, R> { return this.endpoint<P, R>("PUT", path, opts); }
  protected patch<R, P = void>(path: string, opts: EndpointOptions<R> = {}): Endpoint<P, R> { return this.endpoint<P, R>("PATCH", path, opts); }
  protected delete<R = void, P = void>(path: string, opts: EndpointOptions<R> = {}): Endpoint<P, R> { return this.endpoint<P, R>("DELETE", path, opts); }

  private netOf(): Net {
    const n = this.net ?? defaultNet?.();
    if (!n) throw new Error("March: no Net instance (import hadi-march/net)");
    hook(n);
    return n;
  }
  private cat(o: CallOptions): string { return o.category ?? this.defaults.category ?? this.category ?? (this.base.split("/").find(Boolean) || "api"); }
  private join(path: string): string { return /^[a-z]+:/i.test(path) ? path : (this.base.replace(/\/$/, "") + (path === "/" ? "" : path)) || "/"; }

  protected endpoint<P, R>(method: string, path: string, opts: EndpointOptions<R> = {}): Endpoint<P, R> {
    const names = [...path.matchAll(/:([A-Za-z_]\w*)/g)].map((m) => m[1] as string);
    const write = method !== "GET" && method !== "DELETE" && method !== "HEAD";
    const split = (vars: unknown): { params: Record<string, string | number>; rest: unknown } => {
      if (!vars || typeof vars !== "object" || Array.isArray(vars) || (typeof FormData !== "undefined" && vars instanceof FormData)) return { params: {}, rest: vars };
      const params: Record<string, string | number> = {}, rest: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(vars)) if (names.includes(k)) params[k] = v as string | number; else rest[k] = v;
      return { params, rest };
    };
    const key = (vars?: P): unknown[] => [this.cat(opts), path, vars ?? null];
    const call = (async (vars?: P, o: CallOptions = {}): Promise<R> => {
      const { params, rest } = split(vars);
      const merged: RequestOptions = { ...this.defaults, ...opts, ...o, url: this.join(path), method, params, category: this.cat({ ...opts, ...o }) };
      merged.meta = { ...this.defaults.meta, ...opts.meta, ...o.meta, queryKey: key(vars) };
      if (write) merged.body = rest; else if (rest && typeof rest === "object") merged.query = { ...(rest as Record<string, unknown>), ...o.query };
      delete (merged as { schema?: unknown }).schema;
      return validate(opts.schema as Validator<R> | undefined, await this.netOf().request(merged));
    }) as unknown as Endpoint<P, R>;
    Object.assign(call, {
      method, path, key,
      url: (vars?: P) => { const { params, rest } = split(vars); return this.netOf().normalize({ url: this.join(path), params }).url + (write || !rest || typeof rest !== "object" ? "" : ((q) => (q ? "?" + q : ""))(new URLSearchParams(Object.entries(rest as Record<string, unknown>).filter(([, v]) => v != null).map(([k, v]) => [k, String(v)])).toString())); },
      query: (vars?: P | (() => P), qo: QueryOptions<R> = {}) => {
        const get = (): P | undefined => (typeof vars === "function" ? (vars as () => P)() : vars);
        return dataQuery<R>(({ signal: s }) => (call as unknown as (v?: P, o?: CallOptions) => Promise<R>)(get(), { signal: s }), { retry: 0, ...qo, key: () => key(get()) });
      },
      mutation: (mo: MutationOptions<P, R> = {}) => dataMutation<P, R>((v) => (call as unknown as (v?: P) => Promise<R>)(v), mo),
    });
    // `invalidates` on the endpoint: net clears its cache and refetches the data queries after success
    return call;
  }

  protected stream<T>(url: string, opts: { transport?: string } = {}): Stream<T> {
    const full = this.join(url);
    const self = this;
    return {
      url: full,
      subscribe(fn, o = {}) {
        const net = self.netOf();
        const name = opts.transport ?? (/^wss?:/.test(full) ? "ws" : /^sse:/.test(full) ? "sse" : "http");
        const t = net.transports.get(name);
        if (!t?.stream) throw new AppError(`Transport "${name}" cannot stream`, { type: "runtime", source: "net" });
        const off = t.stream(full, (m) => fn(m as T), { signal: o.signal });
        if (getOwner()) onCleanup(off);
        return off;
      },
      latest() {
        const s = signal<T | undefined>(undefined);
        this.subscribe((m) => s.set(m));
        return s;
      },
    };
  }
}

const instances = new WeakMap<object, Api>();
/** One instance of an Api class (per Net). `api(UsersApi)`, `api(UsersApi, { net: testNet })`. */
export function api<A extends Api>(Cls: new () => A, o: { net?: Net } = {}): A {
  if (o.net) { const a = new Cls(); a.net = o.net; return a; }
  let a = instances.get(Cls) as A | undefined;
  if (!a) instances.set(Cls, (a = new Cls()));
  return a;
}
