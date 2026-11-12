// Transports: how a request leaves the app. All share one interface (send / stream), so the same Api class can talk
// to fetch, a WebSocket, server-sent events or the mock provider.
import { buildUrl, type Ctx, type NetResponse, type Transport } from "./core.ts";
import { AppError } from "../errors/app-error.ts";

const isRaw = (b: unknown): boolean =>
  typeof b === "string" || (typeof FormData !== "undefined" && b instanceof FormData) || (typeof Blob !== "undefined" && b instanceof Blob)
  || (typeof URLSearchParams !== "undefined" && b instanceof URLSearchParams) || b instanceof ArrayBuffer || ArrayBuffer.isView(b);

/** Response headers as a plain lower-case object. */
export function headersOf(h: Headers | null | undefined): Record<string, string> {
  const o: Record<string, string> = {};
  h?.forEach((v, k) => { o[k.toLowerCase()] = v; });
  return o;
}

/** Parse a body by type (JSON that is empty becomes null; JSON that does not parse stays text). */
export function parseBody(text: string, type: string): unknown {
  if (type === "none") return null;
  if (type === "text") return text;
  if (!text) return null;
  try { return JSON.parse(text) as unknown; } catch { return text; }
}

/** fetch(). Streams the body to report download progress when the size is known. */
export class HttpTransport implements Transport {
  readonly name = "http";
  private fetchFn: typeof fetch;
  constructor(fetchFn: typeof fetch = (...a) => globalThis.fetch(...a)) { this.fetchFn = fetchFn; }
  async send(ctx: Ctx): Promise<NetResponse> {
    const { req } = ctx;
    const raw = isRaw(req.body);
    const headers: Record<string, string> = { accept: req.responseType === "json" ? "application/json" : "*/*", ...req.headers };
    if (req.body !== undefined && !raw) headers["content-type"] ??= "application/json";
    const r = await this.fetchFn(buildUrl(req.url, undefined, req.query), {
      method: req.method, headers, signal: ctx.signal,
      body: req.body === undefined ? null : raw ? (req.body as BodyInit) : JSON.stringify(req.body),
    });
    const h = headersOf(r.headers);
    if (req.responseType === "blob") return { status: r.status, ok: r.ok, headers: h, data: await r.blob(), from: "network" };
    const total = Number(h["content-length"]) || 0;
    let text: string;
    if (total && r.body?.getReader) {
      const reader = r.body.getReader(), dec = new TextDecoder();
      let loaded = 0; text = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        loaded += value.byteLength;
        text += dec.decode(value, { stream: true });
        ctx.progress(loaded, total);
      }
      text += dec.decode();
    } else text = await r.text();
    return { status: r.status, ok: r.ok, headers: h, data: parseBody(text, r.ok ? req.responseType : "json"), from: "network" };
  }
}

/** Resolve "ws:/path", "sse:/path" or a relative path against the page (ws → ws(s):, sse → http(s):). */
export function resolveUrl(url: string, scheme: "ws" | "http"): string {
  const rest = url.replace(/^(wss?|sse):/, "");
  const loc = (globalThis as { location?: { href: string } }).location?.href ?? "http://localhost/";
  const u = new URL(rest, loc);
  if (scheme === "ws") u.protocol = u.protocol === "https:" || url.startsWith("wss:") ? "wss:" : "ws:";
  return u.href;
}

type ESLike = { onmessage: ((e: { data: string }) => void) | null; onerror: (() => void) | null; close(): void; addEventListener(t: string, f: (e: { data: string }) => void): void };
type ESCtor = new (url: string, init?: { withCredentials?: boolean }) => ESLike;

/** Server-sent events. `stream()` delivers parsed messages (EventSource reconnects by itself); `send()` resolves with
 *  the first message (one-shot server push). `event` limits to one event name. */
export class SseTransport implements Transport {
  readonly name = "sse";
  private opts: { withCredentials?: boolean; event?: string; EventSource?: ESCtor };
  constructor(opts: { withCredentials?: boolean; event?: string; EventSource?: ESCtor } = {}) { this.opts = opts; }
  stream(url: string, onMessage: (msg: unknown) => void, o: { signal?: AbortSignal | undefined; onError?: ((e: AppError) => void) | undefined } = {}): () => void {
    const ES = this.opts.EventSource ?? (globalThis as { EventSource?: ESCtor }).EventSource;
    if (!ES) throw new AppError("EventSource is not available", { type: "runtime", source: "net" });
    const es = new ES(resolveUrl(url, "http"), { withCredentials: !!this.opts.withCredentials });
    const on = (e: { data: string }): void => onMessage(parseBody(e.data, "json"));
    if (this.opts.event) es.addEventListener(this.opts.event, on); else es.onmessage = on;
    es.onerror = () => o.onError?.(new AppError("Event stream error", { type: "network", source: "net", context: { url } }));
    const stop = (): void => es.close();
    o.signal?.addEventListener("abort", stop, { once: true });
    return stop;
  }
  send(ctx: Ctx): Promise<NetResponse> {
    return new Promise((res, rej) => {
      const stop = this.stream(buildUrl(ctx.req.url, undefined, ctx.req.query), (data) => { stop(); res({ status: 200, ok: true, headers: {}, data, from: "network" }); },
        { signal: ctx.signal, onError: (e) => { stop(); rej(e); } });
      ctx.signal.addEventListener("abort", () => rej(Object.assign(new Error("Aborted"), { name: "AbortError" })), { once: true });
    });
  }
}
