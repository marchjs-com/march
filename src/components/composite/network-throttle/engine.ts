// The network throttle of NetworkThrottle: slows the page's fetch(), XMLHttpRequest and module / chunk loads as a real
// network would — a latency per request, the upload paced by the outgoing bandwidth, the response body streamed at the
// incoming bandwidth — or fails them (offline). A scope (CallScope) limits it to some code: a preview drawn into the
// page is throttled, the page around it is not. The state is one per window (kept on globalThis), so every copy of March
// in the page (the page's and a preview runtime's) shares it.
//   setThrottle({ down: 400, up: 400, latency: 2000 }); installThrottle(); setThrottleScope((stack) => /blob:/.test(stack))
import { inScope, type CallScope } from "../../../ui/call-scope.ts";

/** A network: bandwidths in kbit/s (null: no limit), latency in ms, or offline. */
export interface NetProfile { offline?: boolean; down?: number | null; up?: number | null; latency?: number }
export type NetKind = "fetch" | "xhr" | "module" | "chunk";
/** A request the throttle saw (times in ms of performance.now()). */
export interface NetRequest { id: number; url: string; method: string; kind: NetKind; start: number; sent?: number; first?: number; end?: number; bytes: number; up: number; status?: number | string; error?: boolean }
export interface NetPreset { id: string; label: string; profile: NetProfile }

/** The ready-made networks (as the browsers' developer tools name them). */
export const NET_PRESETS: readonly NetPreset[] = [
  { id: "none", label: "Kısıtsız", profile: {} },
  { id: "wifi", label: "Wi-Fi", profile: { down: 30000, up: 15000, latency: 2 } },
  { id: "4g", label: "4G", profile: { down: 9000, up: 1500, latency: 60 } },
  { id: "fast3g", label: "Hızlı 3G", profile: { down: 1440, up: 675, latency: 563 } },
  { id: "slow3g", label: "Yavaş 3G", profile: { down: 400, up: 400, latency: 2000 } },
  { id: "offline", label: "Çevrimdışı", profile: { offline: true } },
];

interface State {
  profile: NetProfile; scope: CallScope | null; bypass: number; seq: number; requests: NetRequest[];
  listeners: Set<() => void>; installs: number; restore: (() => void) | null; raw: typeof fetch | null;
}
const KEY = Symbol.for("march.netThrottle");
const S: State = ((globalThis as Record<symbol, unknown>)[KEY] ??= { profile: {}, scope: null, bypass: 0, seq: 0, requests: [], listeners: new Set(), installs: 0, restore: null, raw: null }) as State;
const notify = (): void => { for (const f of [...S.listeners]) f(); };

/** Is any limit on? */
export const throttled = (p: NetProfile = S.profile): boolean => !!(p.offline || p.down || p.up || p.latency);
/** The network now. */
export const getThrottle = (): NetProfile => S.profile;
/** Set the network (`{}` or null: no limit). */
export function setThrottle(p: NetProfile | null): void { S.profile = { ...(p ?? {}) }; notify(); }
/** Limit it to the calls in a scope (null: every call of the page). */
export function setThrottleScope(scope: CallScope | null): void { S.scope = scope; }
/** The preset the network matches (or null: your own). */
export const presetOf = (p: NetProfile = S.profile): NetPreset | null =>
  NET_PRESETS.find((x) => !!x.profile.offline === !!p.offline && (x.profile.down ?? null) === (p.down ?? null) && (x.profile.up ?? null) === (p.up ?? null) && (x.profile.latency ?? 0) === (p.latency ?? 0)) ?? null;
/** The requests seen (newest last; at most 60). */
export const throttleRequests = (): readonly NetRequest[] => S.requests;
/** Forget the requests seen. */
export function clearThrottleRequests(): void { S.requests = []; notify(); }
/** Called on every change (the network, a request); returns the unsubscribe. */
export function onThrottle(fn: () => void): () => void { S.listeners.add(fn); return () => { S.listeners.delete(fn); }; }
/** Run `fn` without the throttle (a tool's own loads). */
export function throttleBypass<T>(fn: () => T): T { S.bypass++; try { return fn(); } finally { S.bypass--; } }
/** Does the current call get throttled? */
export const throttles = (): boolean => S.bypass === 0 && throttled() && inScope(S.scope);

const sleep = (ms: number): Promise<void> => (ms > 0 ? new Promise((r) => { setTimeout(r, ms); }) : Promise.resolve());
/** ms that `bytes` take at `kbps` (kbit/s = bits per ms). */
const timeFor = (bytes: number, kbps: number | null | undefined): number => (kbps ? (bytes * 8) / kbps : 0);
const record = (r: Omit<NetRequest, "id" | "bytes" | "up" | "start"> & { up?: number }): NetRequest => {
  const rec: NetRequest = { id: ++S.seq, bytes: 0, up: 0, start: performance.now(), ...r };
  S.requests = [...S.requests.slice(-59), rec];
  notify();
  return rec;
};
const sizeOf = (body: unknown): number => {
  if (body == null) return 0;
  if (typeof body === "string") return new TextEncoder().encode(body).length;
  if (body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer || ArrayBuffer.isView(body)) return body.byteLength;
  if (body instanceof URLSearchParams) return body.toString().length;
  if (typeof FormData !== "undefined" && body instanceof FormData) { let n = 0; for (const [k, v] of body) n += k.length + (typeof v === "string" ? v.length : v.size) + 40; return n; }
  return 0;
};
const offlineError = (): TypeError => new TypeError("Failed to fetch (offline: network throttle)");

/** Wait as the network would before a request is answered: latency and the upload; throws when offline. */
export async function throttleWait(upBytes = 0): Promise<void> {
  const p = S.profile;
  if (p.offline) { await sleep(20); throw offlineError(); }
  await sleep((p.latency ?? 0) + timeFor(upBytes, p.up));
}

/** A response whose body comes at the incoming bandwidth. */
function paced(res: Response, rec: NetRequest): Response {
  if (!res.body) { rec.end = performance.now(); notify(); return res; }
  const reader = res.body.getReader();
  let rest: Uint8Array | null = null;
  const stream = new ReadableStream<Uint8Array>({
    async pull(ctrl) {
      if (!rest) {
        const { done, value } = await reader.read();
        if (done) { rec.end = performance.now(); notify(); ctrl.close(); return; }
        rest = value;
      }
      // pieces of 8 KB, each after its time: progress moves smoothly, as on a slow line
      const piece: Uint8Array = rest.subarray(0, 8192);
      rest = rest.byteLength > 8192 ? rest.subarray(8192) : null;
      await sleep(timeFor(piece.byteLength, S.profile.down));
      rec.bytes += piece.byteLength; notify();
      ctrl.enqueue(piece);
    },
    cancel(why) { void reader.cancel(why); rec.end = performance.now(); notify(); },
  });
  const out = new Response(stream, { status: res.status, statusText: res.statusText, headers: res.headers });
  for (const k of ["url", "redirected", "type"] as const) Object.defineProperty(out, k, { value: res[k] });
  return out;
}

/** fetch() through the throttle (used by the wrapper; call it yourself to throttle one request). */
export async function throttledFetch(raw: typeof fetch, input: RequestInfo | URL, init?: RequestInit, kind: NetKind = "fetch"): Promise<Response> {
  const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  const up = sizeOf(init?.body);
  const rec = record({ url, method, kind, up });
  try { await throttleWait(up); } catch (e) { rec.error = true; rec.status = "offline"; rec.end = performance.now(); notify(); throw e; }
  rec.sent = performance.now();
  let res: Response;
  try { res = await raw(input, init); } catch (e) { rec.error = true; rec.status = "failed"; rec.end = performance.now(); notify(); throw e; }
  rec.first = performance.now(); rec.status = res.status; notify();
  return paced(res, rec);
}

/** Load a module (dynamic import) through the throttle: its file comes at the network's pace first. */
export async function throttledImport(url: string): Promise<unknown> {
  if (throttles() && /^https?:/.test(new URL(url, location.href).protocol)) {
    const raw = rawFetch();
    const r = await throttledFetch(raw, url, undefined, "module");
    await r.arrayBuffer();
  }
  return import(/* @vite-ignore */ url);
}
/** A loader for setLoadRunner (march/lazy): a chunk waits as a request of ~`bytes` would. */
export function throttledLoad<T>(fn: () => Promise<T>, info: { key?: string; kind?: string } = {}, bytes = 24_000): Promise<T> {
  if (S.bypass || !throttled()) return fn();
  const rec = record({ url: info.key ?? "chunk", method: "GET", kind: "chunk" });
  return throttleWait()
    .then(() => { rec.sent = rec.first = performance.now(); return sleep(timeFor(bytes, S.profile.down)); })
    .then(fn)
    .then((v) => { rec.bytes = bytes; rec.status = 200; rec.end = performance.now(); notify(); return v; },
      (e) => { rec.error = true; rec.status = S.profile.offline ? "offline" : "failed"; rec.end = performance.now(); notify(); throw e; });
}

/** The page's own fetch (before the throttle wrapped it). */
export const rawFetch = (): typeof fetch => S.raw ?? globalThis.fetch.bind(globalThis);

/** Wrap fetch and XMLHttpRequest of the page (once; counted: the last uninstall unwraps). Returns the uninstall. */
export function installThrottle(): () => void {
  if (S.installs++ === 0) {
    const g = globalThis as typeof globalThis & { fetch: typeof fetch };
    const f0 = g.fetch;
    S.raw = f0.bind(g);
    const wrapped = function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
      return throttles() ? throttledFetch(S.raw!, input, init) : f0.call(g, input, init);
    };
    g.fetch = wrapped as typeof fetch;
    const X = g.XMLHttpRequest?.prototype;
    const open0 = X?.open, send0 = X?.send;
    if (X && open0 && send0) {
      X.open = function (this: XMLHttpRequest & { __mt?: { method: string; url: string } }, method: string, url: string | URL, ...rest: unknown[]) {
        this.__mt = { method: String(method).toUpperCase(), url: String(url) };
        return (open0 as (...a: unknown[]) => void).call(this, method, url, ...rest);
      } as typeof X.open;
      X.send = function (this: XMLHttpRequest & { __mt?: { method: string; url: string } }, body?: Document | XMLHttpRequestBodyInit | null) {
        if (!throttles()) return send0.call(this, body);
        const m = this.__mt ?? { method: "GET", url: "" }, up = sizeOf(body);
        const rec = record({ url: m.url, method: m.method, kind: "xhr", up });
        this.addEventListener("readystatechange", () => { if (this.readyState === 2) { rec.first = performance.now(); rec.status = this.status; notify(); } });
        this.addEventListener("loadend", () => { rec.end = performance.now(); rec.bytes = Number(this.getResponseHeader?.("content-length")) || (typeof this.response === "string" ? this.response.length : (this.response as Blob | ArrayBuffer | null)?.["byteLength" as never] ?? 0); if (!this.status) { rec.error = true; rec.status = S.profile.offline ? "offline" : "failed"; } notify(); });
        throttleWait(up).then(() => { rec.sent = performance.now(); send0.call(this, body); },
          // offline: the request fails as a network error does (an address that cannot answer)
          () => { (open0 as (...a: unknown[]) => void).call(this, m.method, "http://0.0.0.0:0/"); send0.call(this); });
      };
    }
    S.restore = () => { g.fetch = f0; if (X && open0 && send0) { X.open = open0; X.send = send0; } S.raw = null; };
  }
  let done = false;
  return () => { if (done) return; done = true; if (--S.installs === 0) { S.restore?.(); S.restore = null; } };
}
