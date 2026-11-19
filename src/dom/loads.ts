// The global load listener: every network load March makes announces itself here, one "start" and one "end" event per
// load. That covers route and lazy() chunks (runLoad), march/net HTTP requests, fetchJson, march/ai calls and the
// theme files. onLoad() hears all of them; the same event is also dispatched on window as "march:load" (a
// CustomEvent, `detail` is the event) for code outside March.
//
//   onLoad((e) => console.log(e.type, e.kind, e.key, e.active))   // "start" "route" "src/pages/users.tsx" 1
//   trackLoad(fetch("/report.csv"), { kind: "file", key: "report" })   // your own load, announced the same way

/** What is loading: a page (route), a lazy part, a march/net request, fetchJson, march/ai, a file; or your own. */
export type LoadKind = "route" | "part" | "net" | "fetch" | "ai" | "file" | (string & {});

/** One step of a load: its start or its end. */
export interface LoadEvent {
  /** "start" when it begins, "end" when it settles (once, also when it fails or is aborted). */
  type: "start" | "end";
  /** Pairs a start with its end. */
  id: number;
  kind: LoadKind;
  /** What it loads: a URL, a module key, a name ("" when unknown). */
  key: string;
  /** A load the user did not ask for (a version poll, a prefetch): busy indicators may leave it out. */
  background: boolean;
  /** On "end": it succeeded. */
  ok?: boolean;
  /** On "end" of a failed load: the error. */
  error?: unknown;
  /** On "end": how long it took, ms. */
  ms?: number;
  /** Loads still running after this event, background ones not counted. */
  active: number;
}

/** How a load is announced: `trackLoad(p, { kind, key, background })`, `beginLoad({ … })`. */
export interface LoadOptions { kind?: LoadKind; key?: string; background?: boolean }

const subs = new Set<(e: LoadEvent) => void>();
let seq = 0, running = 0;
const now = (): number => globalThis.performance?.now() ?? Date.now();

function emit(e: LoadEvent): void {
  for (const f of [...subs]) {
    // one listener's error does not stop the others (it is reported on its own)
    try { f(e); } catch (x) { queueMicrotask(() => { throw x; }); }
  }
  const g = globalThis as { dispatchEvent?: (ev: Event) => boolean };
  if (typeof g.dispatchEvent === "function" && typeof CustomEvent === "function") g.dispatchEvent(new CustomEvent("march:load", { detail: e }));
}

/** Listen to every load's start and end. Returns the function that stops listening. */
export function onLoad(fn: (e: LoadEvent) => void): () => void {
  subs.add(fn);
  return () => { subs.delete(fn); };
}

/** Loads running now, background ones not counted (read it in a listener; it is not a signal). */
export const loadsActive = (): number => running;

/** Announce a load that starts now. Call the returned function once it settles: `end(true)`, or `end(false, error)`
 *  (later calls do nothing). */
export function beginLoad({ kind = "fetch", key = "", background = false }: LoadOptions = {}): (ok?: boolean, error?: unknown) => void {
  const id = ++seq, t0 = now();
  if (!background) running++;
  emit({ type: "start", id, kind, key, background, active: running });
  let done = false;
  return (ok = true, error) => {
    if (done) return;
    done = true;
    if (!background) running--;
    emit({ type: "end", id, kind, key, background, ok, ...(ok ? {} : { error }), ms: Math.round(now() - t0), active: running });
  };
}

/** Announce a load of your own until its promise settles; returns the same promise. */
export function trackLoad<T>(p: Promise<T>, info?: LoadOptions): Promise<T> {
  const end = beginLoad(info);
  p.then(() => end(true), (e: unknown) => end(false, e));
  return p;
}
