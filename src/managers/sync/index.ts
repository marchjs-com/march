// SyncManager: writes made offline (or that failed) wait in a persistent queue and go out through net when the
// connection is back — in order, with backoff retries and an Idempotency-Key per item, so a retried write is not
// applied twice. Reads stay with net (its own offline wait and cache); this is for the user's changes.
//
//   import { sync } from "hadi-march/managers/sync";
//   sync().enqueue({ url: "/api/notes", method: "POST", body: note })   // sent now, or as soon as possible
//   sync().pending()  sync().status()  sync().queue()  sync().lastSync()   // reactive
//   sync().flush()    sync().retry(id)   sync().remove(id)
//
// Events: sync:queued ({ id }), sync:sent ({ id, status }), sync:retry ({ id, tries, wait }), sync:failed ({ id, error }),
// sync:synced ({ count }), sync:status ({ status }).
import { signal, computed, effect, untrack } from "../../core/reactive.ts";
import { defineManager, emit } from "../manager.ts";
import { net as defaultNet, type Net } from "../../net/index.ts";
import { AppError } from "../../errors/app-error.ts";

/** One queued write. */
export interface SyncItem {
  id: string;
  url: string;
  method: string;
  body?: unknown;
  headers?: Record<string, string>;
  category?: string;
  /** Queued at (ms since epoch). */
  at: number;
  tries: number;
  /** Not before this time (backoff). */
  next: number;
  /** Last error message. */
  error?: string;
  /** Gave up (4xx or too many tries); kept until removed or retried. */
  failed?: boolean;
}
export type SyncStatus = "idle" | "syncing" | "offline" | "waiting" | "error";
export interface SyncRequest { url: string; method?: string; body?: unknown; headers?: Record<string, string>; category?: string }

export interface SyncConfig {
  /** The Net instance writes go through. Default: the app's `net`. */
  net: Net | null;
  /** localStorage key of the queue (null = memory only; lost on reload). */
  storageKey: string | null;
  /** Backoff: first wait, growth factor, longest wait (ms), tries before giving up. */
  retry: { delay: number; factor: number; max: number; count: number };
  /** Per-request timeout (ms). Default 15 000. */
  timeout: number;
}

export interface Sync {
  queue(): readonly SyncItem[];
  /** Items still to send (failed ones not counted). */
  pending(): number;
  failed(): number;
  online(): boolean;
  status(): SyncStatus;
  lastSync(): number | null;
  /** Queue a write; it is sent at once when online. */
  enqueue(req: SyncRequest): SyncItem;
  /** Send everything that is due now. */
  flush(): Promise<void>;
  /** Try a failed or waiting item again now (all when no id). */
  retry(id?: string): void;
  remove(id: string): void;
  clear(): void;
  dispose(): void;
}

const DEFAULTS: SyncConfig = { net: null, storageKey: "hm.sync", retry: { delay: 1000, factor: 2, max: 60_000, count: 8 }, timeout: 15_000 };

/** 4xx (but not 408 / 429) means the server refused this write: retrying will not help. */
const permanent = (e: unknown): boolean => { const s = (e as AppError)?.status; return typeof s === "number" && s >= 400 && s < 500 && s !== 408 && s !== 429; };

function create(cfg: SyncConfig): Sync {
  const n = cfg.net ?? defaultNet;
  const ls = ((): Storage | null => { try { return cfg.storageKey ? globalThis.localStorage ?? null : null; } catch { return null; } })();
  const load = (): SyncItem[] => { try { return JSON.parse(ls?.getItem(cfg.storageKey!) ?? "[]") as SyncItem[]; } catch { return []; } };
  const items = signal<SyncItem[]>(load(), { name: "sync.queue" });
  const busy = signal(false, { name: "sync.busy" });
  const last = signal<number | null>(null, { name: "sync.lastSync" });
  let timer: ReturnType<typeof setTimeout> | null = null;
  let alive = true;
  let seq = 0;

  const save = (list: SyncItem[]): void => {
    items.set(list);
    try { ls?.setItem(cfg.storageKey!, JSON.stringify(list)); } catch { /* full or blocked: the queue stays in memory */ }
  };
  const patch = (id: string, p: Partial<SyncItem>): void => save(items.peek().map((x) => (x.id === id ? { ...x, ...p } : x)));
  const pending = computed(() => items().filter((x) => !x.failed).length);
  const failed = computed(() => items().filter((x) => x.failed).length);
  const status = computed<SyncStatus>(() => (busy() ? "syncing" : !n.online() && pending() ? "offline" : pending() ? "waiting" : failed() ? "error" : "idle"));
  const stopStatus = effect(() => { const s = status(); untrack(() => emit("sync", "status", { status: s })); });

  const schedule = (): void => {
    if (timer) clearTimeout(timer);
    timer = null;
    const due = items.peek().filter((x) => !x.failed).map((x) => x.next);
    if (!due.length || !alive || !n.online.peek()) return; // offline: the online effect starts the next run
    timer = setTimeout(() => void flush(), Math.max(0, Math.min(...due) - Date.now()));
  };

  const sendOne = async (x: SyncItem): Promise<boolean> => {
    try {
      await n.request({
        url: x.url, method: x.method, body: x.body, category: x.category ?? "sync", key: `sync:${x.id}`, policy: "parallel",
        headers: { ...(x.headers ?? {}), "Idempotency-Key": x.id }, offline: "fail", retry: false, timeout: cfg.timeout, report: false,
      });
      save(items.peek().filter((y) => y.id !== x.id));
      emit("sync", "sent", { id: x.id });
      return true;
    } catch (e) {
      const err = AppError.from(e);
      const tries = x.tries + 1;
      if (permanent(err) || tries >= cfg.retry.count) {
        patch(x.id, { tries, error: err.message, failed: true });
        emit("sync", "failed", { id: x.id, error: err.message });
        return true; // this one is out of the way: the next may go
      }
      const wait = Math.min(cfg.retry.max, cfg.retry.delay * cfg.retry.factor ** (tries - 1));
      patch(x.id, { tries, error: err.message, next: Date.now() + wait });
      emit("sync", "retry", { id: x.id, tries, wait });
      return false;
    }
  };

  let running: Promise<void> | null = null;
  let again = false;
  const flush = (): Promise<void> => {
    // asked while a run is on its way out (e.g. back online in the same tick): run once more after it
    if (running) { again = true; return running; }
    const p = (async () => {
      if (!n.online.peek()) return;
      busy.set(true);
      let sent = 0;
      try {
        // in order: a waiting item holds the ones behind it (a later edit must not overtake an earlier one)
        for (;;) {
          if (!alive || !n.online.peek()) break;
          const x = items.peek().find((y) => !y.failed);
          if (!x || x.next > Date.now()) break;
          const before = items.peek().length;
          if (!(await sendOne(x))) break;
          if (items.peek().length < before) sent++;
        }
      } finally {
        busy.set(false);
      }
      if (sent) { last.set(Date.now()); if (!pending.peek()) emit("sync", "synced", { count: sent }); }
      schedule();
    })();
    // set after the call: a run with nothing to await finishes before this line
    running = p;
    void p.finally(() => {
      if (running !== p) return;
      running = null;
      if (again && alive) { again = false; void flush(); }
    });
    return p;
  };

  // back online: send what waited
  const stopOnline = effect(() => { if (n.online()) untrack(() => { void flush(); }); });

  return {
    queue: items,
    pending,
    failed,
    online: () => n.online(),
    status,
    lastSync: last,
    enqueue(r) {
      const id = `${Date.now().toString(36)}-${(++seq).toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
      const x: SyncItem = { id, url: r.url, method: (r.method ?? "POST").toUpperCase(), at: Date.now(), tries: 0, next: 0,
        ...(r.body !== undefined ? { body: r.body } : {}), ...(r.headers ? { headers: r.headers } : {}), ...(r.category ? { category: r.category } : {}) };
      save([...items.peek(), x]);
      emit("sync", "queued", { id });
      void flush();
      return x;
    },
    flush,
    retry(id) {
      save(items.peek().map((x) => (id === undefined || x.id === id ? (({ failed: _f, ...rest }) => ({ ...rest, next: 0, tries: x.failed ? 0 : x.tries }))(x) : x)));
      void flush();
    },
    remove(id) { save(items.peek().filter((x) => x.id !== id)); schedule(); },
    clear() { save([]); schedule(); },
    dispose() {
      alive = false;
      if (timer) clearTimeout(timer);
      stopOnline(); stopStatus();
    },
  };
}

const manager = defineManager<Sync, SyncConfig>("sync", create, DEFAULTS);
/** The sync manager (created on first call; sends what an earlier visit left in the queue). */
export const sync = (): Sync => manager.get();
/** Set the sync manager's options (merged into the current config). */
export const configureSync = (config: Partial<SyncConfig>): void => manager.configure(config);
/** Stop the sync manager and remove its listeners; the next call starts it again. */
export const disposeSync = (): void => manager.dispose();
/** The sync manager (get, configure, dispose). */
export const syncManager = manager;
