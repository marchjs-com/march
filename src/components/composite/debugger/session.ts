// The debugger's session (march/ui, Debugger): what the instrumented code reports (instrument.js writes the calls),
// kept as a recording, and the debugger's controls over it. The code runs at its own speed on the page's thread (a
// page cannot freeze itself and stay usable), so pausing is done on the recording: every step is kept with a copy of
// the names in scope at that moment and the call stack; a breakpoint (its condition true), a `debugger;` statement or
// an error makes the debugger stop there — Continue goes to the next stop, Step over / into / out to the next step of
// that kind, Step back goes back in time. When the recording has no such step yet, the session waits for the code to
// get there (a click in the preview) and stops then. Watches, conditions and logpoints are evaluated in the scope of
// the step shown (`evaluate`: the host's evaluator, a module from a blob: URL — no eval).
import { signal, computed, effect, untrack as ownUntrack, batch, type Signal } from "../../../core/reactive.ts";
import { load, save } from "../../../core/util.ts";

/** What the instrumenter tells about a file: its module names, its functions and every step (a statement). */
export interface DebugMeta {
  file: string;
  /** Names of the file's top level (read by every step after the local ones). */
  module: string[];
  /** [name, line] of each function. */
  fns: [string, number][];
  /** [line, column, function index (-1: the module), kind ("" | "debugger"), local names, closure names]. */
  steps: [number, number, number, string, string[], string[]][];
}
/** A breakpoint: a line of a file; with `condition` it stops only when that is true; with `log` it does not stop, it writes the message (`{expr}` parts evaluated). */
export interface Breakpoint { id: number; file: string; line: number; enabled: boolean; condition?: string | undefined; log?: string | undefined }
export interface Watch { id: number; expr: string }
/** A watch's value at the step shown. */
export type WatchValue = { ok: true; value: unknown } | { ok: false; error: string; /** A name read before its declaration ran. */ undeclared?: string } | { pending: true };
export interface StackFrame { fn: string; file: string; line: number; /** The step to show for this frame (its latest one). */ at: number }
export interface ScopeGroup { kind: "local" | "closure" | "module"; values: Record<string, unknown> }
/** One kept step, as the panel shows it. */
export interface StepView {
  n: number; file: string; line: number; col: number; fn: string;
  kind: "" | "debugger" | "exception";
  error?: unknown;
  /** The call stack, innermost first. */
  stack: StackFrame[];
  scopes: ScopeGroup[];
}
export interface OutputLine { at: number; level: "log" | "info" | "warn" | "error" | "debug" | "logpoint"; text: string; file?: string | undefined; line?: number | undefined }
export type DebugState = "idle" | "running" | "paused";
export type PauseReason = "breakpoint" | "debugger" | "exception" | "step" | "entry" | "time";
export interface DebugSessionOptions {
  /** Evaluates an expression with names in scope (watches, conditions, logpoints, the terminal). */
  evaluate?: ((expr: string, scope: Record<string, unknown>) => Promise<unknown>) | undefined;
  /** The untrack of the March that runs the code (another copy of March may run it): reading values never subscribes. */
  untrack?: (<T>(fn: () => T) => T) | undefined;
  /** How many steps are kept (default 20000; older ones are dropped). */
  maxSteps?: number | undefined;
  /** Key in localStorage for the breakpoints, watches and options (none: kept for this visit). */
  persist?: string | undefined;
  /** Name of the global object the instrumented code calls (default "__marchDebug"; instrument.js writes this one). */
  global?: string | undefined;
}

// a kept value: plain data is copied (as it was then), functions, elements and other live things are kept as they are;
// a signal or a computed value becomes an accessor of the value it had then (its set still sets the live one)
const TDZ: unique symbol = Symbol("not yet defined");
const SIGNAL = Symbol.for("march.debug.signal");
const isAccessor = (v: unknown): v is (() => unknown) & { peek(): unknown; set?: (x: unknown) => void } => typeof v === "function" && typeof (v as { peek?: unknown }).peek === "function";
function snap(v: unknown, depth = 0): unknown {
  if (v === null || (typeof v !== "object" && typeof v !== "function")) return v;
  if (typeof v === "function") {
    if (!isAccessor(v)) return v;
    let then: unknown;
    try { then = snap(v.peek(), depth + 1); } catch { then = undefined; }
    const f = Object.assign(() => then, { peek: () => then, [SIGNAL]: typeof v.set === "function" ? "signal" : "computed" }) as unknown as Record<string | symbol, unknown>;
    if (typeof v.set === "function") f["set"] = (x: unknown) => v.set!(x);
    return f;
  }
  if (depth >= 3) return v;
  if (Array.isArray(v)) return v.slice(0, 200).map((x) => snap(x, depth + 1));
  if (v instanceof Date) return new Date(v.getTime());
  if (v instanceof Map) return new Map([...v].slice(0, 100).map(([k, x]) => [k, snap(x, depth + 1)]));
  if (v instanceof Set) return new Set([...v].slice(0, 100).map((x) => snap(x, depth + 1)));
  const proto = Object.getPrototypeOf(v);
  if (proto !== Object.prototype && proto !== null) return v; // a class instance, an element, a promise: live
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(v).slice(0, 100)) { try { out[k] = snap((v as Record<string, unknown>)[k], depth + 1); } catch (e) { out[k] = e; } }
  return out;
}
/** What a kept accessor was ("signal" / "computed"), or null. */
export const accessorKind = (v: unknown): string | null => (typeof v === "function" ? ((v as unknown as Record<symbol, string>)[SIGNAL] ?? null) : null);
/** A value is a name read before its declaration ran. */
export const isUndeclared = (v: unknown): boolean => v === TDZ;

interface Frame { fi: number; fn: number; step: number; /** The module step that called it (the code at the top of a file, in the same task), or -1. */ caller?: number }
interface Rec { n: number; fi: number; si: number; vals: unknown[]; stack: Frame[]; depth: number; kind: "" | "debugger" | "exception"; error?: unknown }

export interface DebugSession {
  state: () => DebugState;
  reason: () => PauseReason | null;
  /** The step shown (its number), or -1. */
  index: () => number;
  /** The first and the last kept step's numbers (the recording's range). */
  range: () => [number, number];
  current: () => StepView | null;
  /** The frame of the stack chosen (0: the step itself). */
  frame: Signal<number>;
  /** The step of the chosen frame (the scopes and the lit line follow it). */
  shown: () => StepView | null;
  breakpoints: () => readonly Breakpoint[];
  toggleBreakpoint(file: string, line: number): void;
  setBreakpoint(file: string, line: number, patch?: Partial<Omit<Breakpoint, "id" | "file" | "line">>): Breakpoint;
  updateBreakpoint(id: number, patch: Partial<Omit<Breakpoint, "id">>): void;
  removeBreakpoint(id: number): void;
  clearBreakpoints(): void;
  watches: () => readonly Watch[];
  addWatch(expr: string): void;
  updateWatch(id: number, expr: string): void;
  removeWatch(id: number): void;
  watchValue(id: number): WatchValue;
  /** Console lines and logpoint messages up to the step shown. */
  output: () => readonly OutputLine[];
  /** Stop when an error is thrown. */
  pauseOnExceptions: Signal<boolean>;
  /** Stop at the first step of a run. */
  stopOnEntry: Signal<boolean>;
  /** Breakpoints on or off together. */
  breakpointsActive: Signal<boolean>;
  /** Start a run: the hooks are in place for code instrumented with these metas; the old recording goes. */
  begin(metas: readonly DebugMeta[]): void;
  /** End: the hooks go, the code (instrumented) keeps running without them. */
  end(): void;
  resume(): void;
  stepOver(): void;
  stepInto(): void;
  stepOut(): void;
  stepBack(): void;
  /** Show a step of the recording (time travel). */
  goTo(n: number): void;
  /** The names in scope at the step shown, with their values then (for an evaluator: the terminal). */
  scope(): Record<string, unknown>;
  /** Evaluate in the scope of the step shown. */
  evaluate(expr: string): Promise<unknown>;
  /** The line lit in a file (the step shown), with its kind. */
  litLine(file: string): { line: number; kind: string } | null;
}

let ids = 0;
/** `const s = createDebugSession({ evaluate })`; instrumented code reports to it once `s.begin(metas)` ran. */
export function createDebugSession(o: DebugSessionOptions = {}): DebugSession {
  const untrack = o.untrack ?? ownUntrack;
  const max = o.maxSteps ?? 20000;
  const name = o.global ?? "__marchDebug";
  const g = globalThis as Record<string, unknown>;
  // ---- kept settings
  interface Saved { breakpoints?: Breakpoint[]; watches?: Watch[]; pauseOnExceptions?: boolean; stopOnEntry?: boolean; active?: boolean }
  const saved: Saved = o.persist ? load<Saved>(o.persist, {}) : {};
  const breakpoints = signal<readonly Breakpoint[]>(saved.breakpoints ?? []);
  const watches = signal<readonly Watch[]>(saved.watches ?? []);
  for (const x of [...breakpoints.peek(), ...watches.peek()]) ids = Math.max(ids, x.id);
  const pauseOnExceptions = signal(saved.pauseOnExceptions ?? false);
  const stopOnEntry = signal(saved.stopOnEntry ?? false);
  const breakpointsActive = signal(saved.active ?? true);
  if (o.persist) {
    effect(() => {
      const v: Saved = { breakpoints: [...breakpoints()], watches: [...watches()], pauseOnExceptions: pauseOnExceptions(), stopOnEntry: stopOnEntry(), active: breakpointsActive() };
      save(o.persist!, v);
    });
  }

  // ---- the recording (plain arrays: the hooks run at the code's speed); `version` tells the panel, once per task
  let metas: readonly DebugMeta[] = [];
  let recs: Rec[] = [], first = 0, count = 0;
  let stack: Frame[] = [];
  let moduleStep = -1, moduleTask = false;
  let logs: OutputLine[] = [];
  const thrown = new WeakSet<object>();
  const version = signal(0);
  // the panel hears of new steps once per frame-ish (a timer: the page gets its turn between two, whatever the code does)
  let bumped: ReturnType<typeof setTimeout> | null = null, notifying = false;
  const bump = (): void => {
    if (bumped) return;
    bumped = setTimeout(() => { bumped = null; notifying = true; try { version.set(version.peek() + 1); } finally { notifying = false; } void scan(); }, 30);
  };
  // dropped steps (the oldest, past maxSteps): what showed them is read again
  const dropped = signal(0);
  // reading values may run the code (a computed value, a getter): what it reports then is not a step of the program
  let inHook = false;
  const state = signal<DebugState>("idle"), reason = signal<PauseReason | null>(null), index = signal(-1), frame = signal(0);
  const rec = (n: number): Rec | undefined => recs[n - first];
  const meta = (r: Rec) => metas[r.fi]?.steps[r.si];

  const record = (r: Omit<Rec, "n">): void => {
    recs.push({ ...r, n: count++ });
    if (recs.length > max) { const drop = Math.ceil(max / 10); recs.splice(0, drop); first += drop; logs = logs.filter((l) => l.at >= first); dropped.set(dropped.peek() + 1); }
    bump();
  };
  const hooks = Object.freeze({
    // a statement is about to run
    s(fi: number, si: number, getters: () => (() => unknown)[]): void {
      const m = metas[fi]?.steps[si];
      if (!m || inHook) return;
      const top = stack[stack.length - 1];
      if (top && top.fi === fi && top.fn === m[2]) top.step = count;
      inHook = true;
      let vals: unknown[];
      try { vals = untrack(() => { let list: (() => unknown)[] = []; try { list = getters(); } catch { /* none */ } return list.map((get) => { try { return snap(get()); } catch { return TDZ; } }); }); }
      finally { inHook = false; }
      // an async function's steps are not on the stack: it is counted as one more level
      const depth = stack.length + (m[2] >= 0 && top?.fn !== m[2] ? 1 : 0);
      // a step of a file's top level: what is called from it in this task is called by the module
      if (m[2] < 0 && !stack.length) { moduleStep = count; if (!moduleTask) { moduleTask = true; queueMicrotask(() => { moduleTask = false; moduleStep = -1; }); } }
      record({ fi, si, vals, stack: stack.map((f) => ({ ...f })), depth, kind: m[3] === "debugger" ? "debugger" : "" });
    },
    e(fi: number, fn: number): number { if (inHook) return -1; stack.push({ fi, fn, step: count, caller: stack.length ? -1 : moduleStep }); if (stack.length > 500) stack.splice(0, 250); return stack.length - 1; },
    x(at: number): void { if (inHook) return; if (at >= 0 && at < stack.length) stack.length = at; },
    // an error leaves a function: kept once (the frame it was thrown in), as a step of its own
    t(err: unknown, at: number): unknown {
      if (inHook) return err;
      const key = typeof err === "object" && err !== null ? err : null;
      if (key && thrown.has(key)) return err;
      if (key) thrown.add(key);
      const last = recs[recs.length - 1];
      const f = at >= 0 ? stack[at] : undefined;
      const from = f ? rec(f.step) ?? last : last;
      if (from) record({ fi: from.fi, si: from.si, vals: from.vals, stack: stack.slice(0, at >= 0 ? at + 1 : stack.length).map((x) => ({ ...x })), depth: from.depth, kind: "exception", error: err });
      return err;
    },
  });
  // the console of the code: kept with the step it came after
  const LEVELS = ["log", "info", "warn", "error", "debug"] as const;
  let restore: (() => void) | null = null;
  const tapConsole = (): void => {
    const c = console as unknown as Record<string, (...a: unknown[]) => void>;
    const orig = LEVELS.map((l) => c[l]!);
    LEVELS.forEach((l, i) => { c[l] = (...a: unknown[]) => { if (!notifying && !inHook) logs.push({ at: count - 1, level: l, text: a.map(text).join(" ") }); bump(); orig[i]!.apply(console, a); }; });
    restore = () => { LEVELS.forEach((l, i) => { c[l] = orig[i]!; }); restore = null; };
  };

  // ---- reading a step
  const view = (r: Rec | undefined): StepView | null => {
    if (!r) return null;
    const m = meta(r), file = metas[r.fi];
    if (!m || !file) return null;
    const group = (kind: ScopeGroup["kind"], list: string[], off: number): ScopeGroup => ({ kind, values: Object.fromEntries(list.map((k, i) => [k, r.vals[off + i]])) });
    const scopes = [group("local", m[4], 0), group("closure", m[5], m[4].length), group("module", file.module, m[4].length + m[5].length)].filter((s) => Object.keys(s.values).length);
    const fnName = (fi: number, fn: number): string => (fn < 0 ? "(module)" : metas[fi]?.fns[fn]?.[0] ?? "?");
    // the stack: the step's own place, then each caller at the step it was on
    const frames: StackFrame[] = [{ fn: fnName(r.fi, m[2]), file: file.file, line: m[0], at: r.n }];
    const callers = [...r.stack].reverse();
    if (callers[0] && callers[0].fn === m[2] && callers[0].fi === r.fi) callers.shift();
    for (const f of callers) {
      const at = rec(f.step);
      const fm = at ? meta(at) : undefined;
      frames.push({ fn: fnName(f.fi, fm ? fm[2] : f.fn), file: metas[f.fi]?.file ?? "?", line: fm?.[0] ?? metas[f.fi]?.fns[f.fn]?.[1] ?? 0, at: at ? at.n : -1 });
    }
    if (m[2] >= 0 && !r.stack.length) frames.push({ fn: "(async)", file: file.file, line: 0, at: -1 });
    // the file's top level that made the outermost call
    const root = rec(r.stack[0]?.caller ?? -1), rm = root ? meta(root) : undefined;
    if (root && rm) frames.push({ fn: "(module)", file: metas[root.fi]?.file ?? "?", line: rm[0], at: root.n });
    return { n: r.n, file: file.file, line: m[0], col: m[1], fn: fnName(r.fi, m[2]), kind: r.kind, ...(r.kind === "exception" ? { error: r.error } : {}), stack: frames, scopes };
  };
  // a kept step never changes: the view follows the step shown (and the dropping of old steps), not every new one
  const current = computed(() => { dropped(); return view(rec(index())); });
  const shown = computed(() => {
    const cur = current(), f = frame();
    if (!cur || f <= 0) return cur;
    const at = cur.stack[f]?.at ?? -1;
    return at >= 0 ? view(rec(at)) ?? cur : cur;
  });
  const scopeOf = (v: StepView | null): Record<string, unknown> => {
    const out: Record<string, unknown> = {};
    // the inner ones win: module first, the local last
    for (const s of [...(v?.scopes ?? [])].reverse()) for (const [k, x] of Object.entries(s.values)) if (x !== TDZ) out[k] = x;
    return out;
  };
  // one evaluation at a time: an evaluator may keep its scope in one global while its module loads
  let queue: Promise<unknown> = Promise.resolve();
  const evalIn = (expr: string, v: StepView | null): Promise<unknown> => {
    const run = (): Promise<unknown> => (o.evaluate ?? evaluateInModule)(expr, scopeOf(v));
    const p = queue.then(run, run);
    queue = p.catch(() => undefined);
    return p;
  };

  // ---- stops
  const bpAt = (file: string, line: number): Breakpoint | undefined => breakpoints.peek().find((b) => b.enabled && b.file === file && b.line === line);
  const truthy = async (expr: string, r: Rec): Promise<boolean> => { try { return !!(await evalIn(expr, view(r))); } catch { return false; } };
  /** Why a step stops a Continue (null: it does not). */
  const stopOf = async (r: Rec): Promise<PauseReason | null> => {
    if (r.kind === "debugger") return "debugger";
    if (r.kind === "exception") return pauseOnExceptions.peek() ? "exception" : null;
    const m = meta(r), file = metas[r.fi];
    if (!m || !file || !breakpointsActive.peek()) return null;
    const bp = bpAt(file.file, m[0]);
    if (!bp || bp.log) return null;
    // a breakpoint's line stops once: not again for the next statement on the same line
    const prev = rec(r.n - 1);
    if (prev && prev.fi === r.fi && prev.si !== r.si && meta(prev)?.[0] === m[0] && prev.depth === r.depth) return null;
    return !bp.condition || (await truthy(bp.condition, r)) ? "breakpoint" : null;
  };
  type Pred = (r: Rec) => Promise<PauseReason | null>;
  // what the session waits for (running), from which step on
  let pending: { pred: Pred; from: number } | null = null;
  let logCursor = 0, scanning = false;
  const pauseAt = (n: number, why: PauseReason): void => { pending = null; batch(() => { index.set(n); frame.set(0); reason.set(why); state.set("paused"); }); };
  async function scan(): Promise<void> {
    if (scanning) return;
    scanning = true;
    try {
      for (;;) {
        let did = false;
        // logpoints: their messages, in the order of the steps
        if (logCursor < first) logCursor = first;
        while (logCursor < count) {
          const r = rec(logCursor++);
          const m = r && meta(r), file = r && metas[r.fi];
          const bp = m && file && r.kind === "" ? bpAt(file.file, m[0]) : undefined;
          if (r && bp?.log && breakpointsActive.peek()) {
            const parts = await Promise.all(bp.log.split(/(\{[^{}]+\})/).map(async (p) => (/^\{[^{}]+\}$/.test(p) ? evalIn(p.slice(1, -1), view(r)).then(text, (e: unknown) => `‹${String((e as Error)?.message ?? e)}›`) : p)));
            logs.push({ at: r.n, level: "logpoint", text: parts.join(""), file: file!.file, line: m![0] });
            logs.sort((a, b) => a.at - b.at);
            version.set(version.peek() + 1);
          }
          did = true;
        }
        // a wait: the next step that stops it
        const p = pending;
        if (p && state.peek() === "running") {
          if (p.from < first) p.from = first;
          while (p.from < count && pending === p) {
            const r = rec(p.from++)!;
            const why = await p.pred(r);
            if (why && pending === p) { pauseAt(r.n, why); break; }
          }
          did = true;
        }
        if (!did || (logCursor >= count && (!pending || pending.from >= count))) break;
      }
    } finally { scanning = false; }
  }
  /** Go on from the step shown until `pred` stops (the recording first, then the code as it runs). */
  const go = (pred: Pred): void => {
    const from = index.peek() < 0 ? first : index.peek() + 1;
    pending = { pred, from };
    batch(() => { state.set("running"); reason.set(null); frame.set(0); });
    void scan();
  };
  const depthAt = (): number => rec(index.peek())?.depth ?? 0;
  const session: DebugSession = {
    state, reason, index, frame, current, shown,
    range: () => { version(); return [first, count - 1]; },
    breakpoints,
    toggleBreakpoint(file, line) {
      const b = breakpoints.peek().find((x) => x.file === file && x.line === line);
      if (b) session.removeBreakpoint(b.id); else session.setBreakpoint(file, line);
    },
    setBreakpoint(file, line, patch = {}) {
      const old = breakpoints.peek().find((x) => x.file === file && x.line === line);
      const b: Breakpoint = { id: old?.id ?? ++ids, file, line, enabled: true, ...old, ...patch };
      breakpoints.set([...breakpoints.peek().filter((x) => x !== old), b].sort((x, y) => x.file.localeCompare(y.file) || x.line - y.line));
      return b;
    },
    updateBreakpoint(id, patch) { breakpoints.set(breakpoints.peek().map((b) => (b.id === id ? { ...b, ...patch } : b))); },
    removeBreakpoint(id) { breakpoints.set(breakpoints.peek().filter((b) => b.id !== id)); },
    clearBreakpoints() { breakpoints.set([]); },
    watches,
    addWatch(expr) { const e = expr.trim(); if (e) watches.set([...watches.peek(), { id: ++ids, expr: e }]); },
    updateWatch(id, expr) { watches.set(watches.peek().map((w) => (w.id === id ? { ...w, expr } : w))); },
    removeWatch(id) { watches.set(watches.peek().filter((w) => w.id !== id)); },
    watchValue: (id) => watchValues()[id] ?? { pending: true },
    // paused: what was written up to the step shown; running (Continue went past the last stop): all of it, live
    output: computed(() => { version(); const n = state() === "running" ? -1 : index(); return n < 0 ? [...logs] : logs.filter((l) => l.at <= n); }, { equals: (a, b) => !!a && !!b && a.length === b.length && a[a.length - 1] === b[b.length - 1] }),
    pauseOnExceptions, stopOnEntry, breakpointsActive,
    begin(next) {
      session.end();
      metas = next; recs = []; first = 0; count = 0; stack = []; logs = []; logCursor = 0; inHook = false;
      g[name] = hooks;
      tapConsole();
      batch(() => { index.set(-1); frame.set(0); version.set(version.peek() + 1); dropped.set(dropped.peek() + 1); });
      go(stopOnEntry.peek() ? async () => "entry" : stopOf);
    },
    end() {
      restore?.();
      pending = null;
      // the code built with the hooks may still run: it reports nowhere now
      if (g[name] === hooks) g[name] = Object.freeze({ s() {}, e: () => -1, x() {}, t: (e: unknown) => e });
      batch(() => { state.set("idle"); reason.set(null); });
    },
    resume() { if (state.peek() !== "idle") go(stopOf); },
    stepInto() { if (state.peek() !== "idle") go(async () => "step"); },
    stepOver() { if (state.peek() === "idle") return; const d = depthAt(); go(async (r) => (r.depth <= d ? "step" : await stopOf(r))); },
    stepOut() { if (state.peek() === "idle") return; const d = depthAt(); go(async (r) => (r.depth < d ? "step" : await stopOf(r))); },
    stepBack() { const n = index.peek(); if (n > first) pauseAt(n - 1, "time"); },
    goTo(n) { if (n >= first && n < count) pauseAt(n, "time"); },
    scope: () => scopeOf(untrack(shown)),
    evaluate: (expr) => evalIn(expr, untrack(shown)),
    litLine(file) {
      const v = shown(), cur = current();
      if (!v || v.file !== file || state() !== "paused") return null;
      return { line: v.line, kind: frame() > 0 ? "frame" : cur?.kind === "exception" ? "exception" : "current" };
    },
  };
  // the watches: evaluated again whenever the step shown, the frame or the list changes (the last answer wins)
  const watchValues = signal<Record<number, WatchValue>>({});
  let wseq = 0;
  effect(() => {
    const v = shown(), list = watches();
    const k = ++wseq;
    if (!v) { watchValues.set({}); return; }
    watchValues.set(Object.fromEntries(list.map((w) => [w.id, { pending: true } as WatchValue])));
    void Promise.all(list.map(async (w): Promise<[number, WatchValue]> => {
      try { return [w.id, { ok: true, value: await evalIn(w.expr, v) }]; } catch (e) {
        const error = String((e as Error)?.message ?? e), name = /^(\S+) is not defined/.exec(error)?.[1];
        // a name of the scope that is not declared yet at this step (its let / const has not run)
        const undeclared = name && v.scopes.some((g) => g.values[name] === TDZ) ? name : undefined;
        return [w.id, { ok: false, error, ...(undeclared ? { undeclared } : {}) }];
      }
    })).then((all) => { if (k === wseq) watchValues.set(Object.fromEntries(all)); });
  });
  return session;
}

let evals = 0;
/** The default evaluator: the expression as a module from a blob: URL with the scope's names (no eval; a CSP needs script-src blob:). */
export async function evaluateInModule(expr: string, scope: Record<string, unknown>): Promise<unknown> {
  const g = globalThis as Record<string, unknown>;
  const key = `__marchDebugScope${++evals}`;
  const names = Object.keys(scope).filter((k) => /^[A-Za-z_$][\w$]*$/.test(k));
  g[key] = scope;
  const url = URL.createObjectURL(new Blob([`const { ${names.join(", ")} } = globalThis.${key};\nexport default await (async () => (\n${expr}\n))();\n`], { type: "text/javascript" }));
  try { return ((await import(/* @vite-ignore */ url)) as { default: unknown }).default; }
  finally { URL.revokeObjectURL(url); delete g[key]; }
}
/** A value as one short line (output, logpoints). */
export function text(v: unknown): string {
  if (typeof v === "string") return v;
  if (v === TDZ) return "‹not yet defined›";
  const kind = accessorKind(v);
  if (kind) return `${kind}(${text((v as () => unknown)())})`;
  if (typeof v === "function") return `ƒ ${v.name || "anonymous"}()`;
  if (typeof Element !== "undefined" && v instanceof Element) return `<${v.tagName.toLowerCase()}>`;
  if (v instanceof Error) return `${v.name}: ${v.message}`;
  try { const j = JSON.stringify(v, (_k, x: unknown) => (typeof x === "bigint" ? `${x}n` : x)); return j === undefined ? String(v) : j.length > 300 ? `${j.slice(0, 297)}…` : j; } catch { return String(v); }
}
