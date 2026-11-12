// LogManager: leveled logging (debug < info < warn < error) through pluggable transports — the console, an in-memory
// ring buffer (a reactive list for panels) and a batched beacon to a server — with scoped child loggers, context
// fields and redaction of secret-looking keys.
//
//   import { logger, configureLog, consoleTransport, memoryTransport, beaconTransport } from "hadi-march/managers/log";
//   configureLog({ level: "info", transports: [consoleTransport(), beaconTransport("/log", { allow: () => consent.has("analytics") })] });
//   const log = logger().child("checkout", { cart: 3 });
//   log.info("paid", { total: 42, card: "4242…" })        // card is redacted
//   log.error(err)                                        // Error objects keep name, message and stack
import { signal, untrack, type Accessor } from "../../core/reactive.ts";
import { defineManager } from "../manager.ts";
import { publisher } from "../publish.ts";

export type Level = "debug" | "info" | "warn" | "error";
/** Log levels from the most to the least verbose: debug, info, warn, error. */
export const LEVELS: readonly Level[] = ["debug", "info", "warn", "error"];
const rank = (l: Level): number => LEVELS.indexOf(l);

export interface LogEntry { level: Level; scope: string; msg: string; data?: Record<string, unknown>; at: number; seq: number }
export interface Transport { name: string; write(e: LogEntry): void; flush?(): void | Promise<void>; dispose?(): void }

export interface LogConfig {
  /** Lowest level written. Default "info". */
  level: Level;
  transports: Transport[];
  /** Keys whose values are replaced with "[redacted]" (case-insensitive, nested). */
  redact: string[];
  /** Log uncaught errors and unhandled rejections. Default false. */
  captureErrors: boolean;
}

export interface Logger {
  debug(msg: string, data?: Record<string, unknown>): void;
  info(msg: string, data?: Record<string, unknown>): void;
  warn(msg: string, data?: Record<string, unknown>): void;
  error(msg: string | unknown, data?: Record<string, unknown>): void;
  /** A logger whose entries carry this scope (joined with ".") and extra fields. */
  child(scope: string, fields?: Record<string, unknown>): Logger;
}
export interface LogHub extends Logger {
  /** Change the level now (no restart). */
  setLevel(l: Level): void;
  level: Accessor<Level>;
  flush(): Promise<void>;
  dispose(): void;
}

const pub = publisher("log");

/** Writes to the console (console.debug / info / warn / error). */
export function consoleTransport(): Transport {
  return { name: "console", write: (e) => { (console[e.level] ?? console.log)(`[${e.scope || "app"}] ${e.msg}`, ...(e.data ? [e.data] : [])); } };
}

/** Keeps the last `size` entries as a reactive list (`entries()`), newest first. */
export function memoryTransport(size = 100): Transport & { entries: Accessor<readonly LogEntry[]>; clear(): void } {
  const list = signal<readonly LogEntry[]>([], { name: "log.memory" });
  return {
    name: "memory",
    write: (e) => { queueMicrotask(() => list.update((l) => [e, ...l].slice(0, size))); }, // never writes inside a binding
    entries: list,
    clear: () => list.set([]),
  };
}

/**
 * Batches entries and posts them with navigator.sendBeacon (fetch keepalive as fallback): every `interval` ms, when
 * `batch` entries wait, and when the tab is hidden. `allow` gates sending (e.g. analytics consent); while it says no,
 * nothing leaves the device and the queue is dropped.
 */
export function beaconTransport(url: string, o: { batch?: number; interval?: number; minLevel?: Level; allow?: () => boolean; send?: (url: string, body: string) => boolean } = {}): Transport & { queued(): number } {
  let queue: LogEntry[] = [];
  const max = o.batch ?? 20, min = o.minLevel ?? "warn";
  const send = o.send ?? ((u: string, body: string): boolean => {
    const nav = globalThis.navigator as Navigator | undefined;
    if (nav?.sendBeacon) return nav.sendBeacon(u, new Blob([body], { type: "application/json" }));
    void globalThis.fetch?.(u, { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => undefined);
    return true;
  });
  let timer: ReturnType<typeof setInterval> | null = null; // runs only while entries wait
  const flush = (): void => {
    if (timer) { clearInterval(timer); timer = null; }
    if (!queue.length) return;
    const batch = queue; queue = [];
    if (o.allow && !untrack(o.allow)) { pub("drop", { count: batch.length, reason: "not allowed" }); return; }
    const ok = send(url, JSON.stringify(batch));
    pub(ok ? "send" : "drop", { count: batch.length });
  };
  const onHide = (): void => { if (globalThis.document?.visibilityState === "hidden") flush(); };
  globalThis.document?.addEventListener?.("visibilitychange", onHide);
  return {
    name: "beacon",
    write: (e) => {
      if (rank(e.level) < rank(min)) return;
      queue.push(e);
      if (queue.length >= max) flush();
      else timer ??= setInterval(flush, o.interval ?? 10_000);
    },
    flush,
    queued: () => queue.length,
    dispose: () => { flush(); globalThis.document?.removeEventListener?.("visibilitychange", onHide); },
  };
}

function scrub(v: unknown, keys: Set<string>, depth = 0): unknown {
  if (v instanceof Error) return { name: v.name, message: v.message, stack: v.stack };
  if (!v || typeof v !== "object" || depth > 5) return v;
  if (Array.isArray(v)) return v.map((x) => scrub(x, keys, depth + 1));
  const out: Record<string, unknown> = {};
  for (const [k, x] of Object.entries(v)) out[k] = keys.has(k.toLowerCase()) ? "[redacted]" : scrub(x, keys, depth + 1);
  return out;
}

function create(cfg: LogConfig): LogHub {
  const level = signal<Level>(cfg.level, { name: "log.level" });
  const keys = new Set(cfg.redact.map((k) => k.toLowerCase()));
  let seq = 0;

  const write = (lv: Level, scope: string, fields: Record<string, unknown> | undefined, msg: unknown, data?: Record<string, unknown>): void => {
    if (rank(lv) < rank(untrack(level))) return;
    let text: string;
    let extra = data;
    if (msg instanceof Error) { text = msg.message; extra = { ...data, error: msg }; } else text = String(msg);
    const merged = fields || extra ? scrub({ ...fields, ...extra }, keys) as Record<string, unknown> : undefined;
    const e: LogEntry = { level: lv, scope, msg: text, at: Date.now(), seq: ++seq, ...(merged ? { data: merged } : {}) };
    for (const t of cfg.transports) { try { t.write(e); } catch (err) { console.error(err); } }
    pub("entry", { level: lv, scope, msg: text });
  };
  const make = (scope: string, fields?: Record<string, unknown>): Logger => ({
    debug: (m, d) => write("debug", scope, fields, m, d),
    info: (m, d) => write("info", scope, fields, m, d),
    warn: (m, d) => write("warn", scope, fields, m, d),
    error: (m, d) => write("error", scope, fields, m, d),
    child: (s, f) => make(scope ? `${scope}.${s}` : s, { ...fields, ...f }),
  });

  const root = make("");
  const onError = (e: Event): void => {
    const ev = e as ErrorEvent & PromiseRejectionEvent;
    write("error", "window", undefined, ev.error ?? ev.reason ?? ev.message, ev.filename ? { file: ev.filename, line: ev.lineno } : undefined);
  };
  if (cfg.captureErrors) { globalThis.addEventListener?.("error", onError); globalThis.addEventListener?.("unhandledrejection", onError); }

  return {
    ...root,
    setLevel: (l) => { level.set(l); pub("level", { level: l }); },
    level,
    async flush() { for (const t of cfg.transports) await t.flush?.(); },
    dispose() {
      globalThis.removeEventListener?.("error", onError);
      globalThis.removeEventListener?.("unhandledrejection", onError);
      for (const t of cfg.transports) t.dispose?.();
    },
  };
}

const manager = defineManager<LogHub, LogConfig>("log", create, {
  level: "info",
  transports: [consoleTransport()],
  redact: ["password", "token", "secret", "authorization", "card", "cookie"],
  captureErrors: false,
});

/** The app logger (created on first call). */
export const logger = (): LogHub => manager.get();
export const configureLog = (config: Partial<LogConfig>): void => manager.configure(config);
export const disposeLog = (): void => manager.dispose();
export const logManager = manager;
