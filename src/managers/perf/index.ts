// PerformanceManager: Core Web Vitals (LCP, CLS, INP) plus FCP and TTFB as reactive values with a rating, user
// timing marks and measures, timed functions and long tasks — all from the browser's own PerformanceObserver.
//
//   import { perf } from "hadi-march/managers/perf";
//   const p = perf();
//   p.vital("lcp")            // { value: 1830, rating: "good" } or undefined until measured (reactive)
//   p.mark("search:start");  …;  p.measure("search", "search:start")      // → ms
//   await p.time("load users", () => net.get("/api/users"))                // measured, also on success/error
//   p.measures()  p.longTasks()  p.onReport((m) => log.info(m.name, m))    // send to analytics
import { signal, untrack, getOwner, onCleanup, type Accessor } from "../../core/reactive.ts";
import { defineManager } from "../manager.ts";
import { publisher } from "../publish.ts";

export type VitalName = "lcp" | "cls" | "inp" | "fcp" | "ttfb";
export type Rating = "good" | "needs-improvement" | "poor";
export interface Vital { name: VitalName; value: number; rating: Rating }
export interface Measure { name: string; duration: number; start: number; ok?: boolean }

/** Good / poor limits (web.dev). */
export const THRESHOLDS: Record<VitalName, [number, number]> = {
  lcp: [2500, 4000], cls: [0.1, 0.25], inp: [200, 500], fcp: [1800, 3000], ttfb: [800, 1800],
};
/** Web Vitals rating of a value: "good", "needs-improvement" or "poor" (the published thresholds). */
export const rateVital = (name: VitalName, v: number): Rating => {
  const [good, poor] = THRESHOLDS[name];
  return v <= good ? "good" : v <= poor ? "needs-improvement" : "poor";
};

export interface PerfConfig {
  /** Measures kept in measures(). Default 50. */
  keep: number;
  /** Prefix for marks and measures written to the browser timeline. Default "hm:". */
  prefix: string;
}

export interface Perf {
  vital(name: VitalName): Vital | undefined;
  vitals: Accessor<Partial<Record<VitalName, Vital>>>;
  mark(name: string): void;
  /** Time from mark `from` (default: navigation start) to now or mark `to`. Returns ms. */
  measure(name: string, from?: string, to?: string): number;
  /** Run fn and record how long it took (async too). */
  time<T>(name: string, fn: () => T): T;
  measures: Accessor<readonly Measure[]>;
  /** Long tasks (> 50 ms) seen since start. */
  longTasks: Accessor<number>;
  /** Called for every vital update and measure. Returns off. */
  onReport(fn: (m: Vital | Measure) => void): () => void;
  /** Supported entry types of this browser (what can be measured here). */
  supported(): string[];
  dispose(): void;
}

const pub = publisher("perf");
type PO = typeof PerformanceObserver;

function create(cfg: PerfConfig): Perf {
  const pf = globalThis.performance as Performance | undefined;
  const PO = (globalThis as { PerformanceObserver?: PO }).PerformanceObserver;
  const types: readonly string[] = PO?.supportedEntryTypes ?? [];
  const vitals = signal<Partial<Record<VitalName, Vital>>>({}, { name: "perf.vitals" });
  const measures = signal<readonly Measure[]>([], { name: "perf.measures" });
  const longTasks = signal(0, { name: "perf.longTasks" });
  const reporters = new Set<(m: Vital | Measure) => void>();
  const observers: PerformanceObserver[] = [];

  const report = (m: Vital | Measure): void => { for (const fn of [...reporters]) { try { fn(m); } catch (e) { console.error(e); } } };
  const setVital = (name: VitalName, value: number): void => {
    const cur = untrack(vitals)[name];
    if (cur && cur.value === value) return;
    const v: Vital = { name, value: name === "cls" ? Math.round(value * 1000) / 1000 : Math.round(value), rating: rateVital(name, value) };
    vitals.update((all) => ({ ...all, [name]: v }));
    pub("vital", v);
    report(v);
  };
  const observe = (type: string, fn: (list: PerformanceEntryList) => void, extra: Record<string, unknown> = {}): void => {
    if (!PO || !types.includes(type)) return;
    try {
      const o = new PO((l) => fn(l.getEntries()));
      o.observe({ type, buffered: true, ...extra } as PerformanceObserverInit);
      observers.push(o);
    } catch { /* type not observable here */ }
  };

  // LCP: the last candidate; CLS: the largest session window (1 s gap, 5 s max); INP: the worst interaction
  observe("largest-contentful-paint", (l) => { const e = l[l.length - 1]; if (e) setVital("lcp", e.startTime); });
  observe("paint", (l) => { for (const e of l) if (e.name === "first-contentful-paint") setVital("fcp", e.startTime); });
  let win = 0, winStart = 0, winLast = 0, cls = 0;
  observe("layout-shift", (l) => {
    for (const e of l as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
      if (e.hadRecentInput) continue;
      if (win && e.startTime - winLast < 1000 && e.startTime - winStart < 5000) win += e.value;
      else { win = e.value; winStart = e.startTime; }
      winLast = e.startTime;
      if (win > cls) { cls = win; setVital("cls", cls); }
    }
  });
  let inp = 0;
  observe("event", (l) => {
    for (const e of l as (PerformanceEntry & { interactionId?: number })[]) if (e.interactionId && e.duration > inp) { inp = e.duration; setVital("inp", inp); }
  }, { durationThreshold: 40 });
  observe("longtask", (l) => { longTasks.update((n) => n + l.length); pub("longtask", { count: l.length }); });
  const nav = pf?.getEntriesByType?.("navigation")[0] as PerformanceNavigationTiming | undefined;
  if (nav && nav.responseStart > 0) setVital("ttfb", nav.responseStart);

  const add = (m: Measure): void => {
    measures.update((l) => [m, ...l].slice(0, cfg.keep));
    pub("measure", m);
    report(m);
  };
  const now = (): number => pf?.now() ?? Date.now();
  const P = cfg.prefix;

  return {
    vital: (name) => vitals()[name],
    vitals,
    mark(name) { try { pf?.mark?.(P + name); } catch { /* no user timing */ } },
    measure(name, from, to) {
      let d = 0, start = 0;
      try {
        const m = pf?.measure?.(P + name, from ? P + from : undefined, to ? P + to : undefined) as PerformanceMeasure | undefined;
        if (m) { d = m.duration; start = m.startTime; }
      } catch { d = 0; }
      const out = { name, duration: Math.round(d * 10) / 10, start };
      add(out);
      return out.duration;
    },
    time(name, fn) {
      const t0 = now();
      const done = (ok: boolean): void => add({ name, duration: Math.round((now() - t0) * 10) / 10, start: t0, ok });
      let r: ReturnType<typeof fn>;
      try { r = fn(); } catch (e) { done(false); throw e; }
      if (r && typeof (r as { then?: unknown }).then === "function") {
        (r as unknown as Promise<unknown>).then(() => done(true), () => done(false));
      } else done(true);
      return r;
    },
    measures,
    longTasks,
    onReport(fn) {
      reporters.add(fn);
      for (const v of Object.values(untrack(vitals))) if (v) fn(v); // what is known already
      const off = (): void => { reporters.delete(fn); };
      if (getOwner()) onCleanup(off);
      return off;
    },
    supported: () => [...types],
    dispose() { for (const o of observers.splice(0)) o.disconnect(); reporters.clear(); },
  };
}

const manager = defineManager<Perf, PerfConfig>("perf", create, { keep: 50, prefix: "hm:" });

/** The performance manager (created on first call; observers start then). */
export const perf = (): Perf => manager.get();
/** Set the performance manager's options (merged into the current config). */
export const configurePerf = (config: Partial<PerfConfig>): void => manager.configure(config);
/** Stop the performance manager and remove its listeners; the next call starts it again. */
export const disposePerf = (): void => manager.dispose();
/** The performance manager (get, configure, dispose). */
export const perfManager = manager;
