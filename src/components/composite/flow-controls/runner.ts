// Flow runner: executes a FlowStore node by node and writes the run state the canvas draws (status per node, values
// per edge, pulses for the moving dots) plus a timeline record. Waits run on the motion engine's clock, so the global
// speed and "pause all" slow down or stop a run like any animation.
//
// Order: sources first; a node runs once every incoming edge has delivered (a value, or "skipped" from a branch that
// did not fire). A node whose inputs were all skipped is skipped; a failing node skips what follows it.
import { signal, batch, type Accessor, type Signal } from "../../../core/reactive.ts";
import { onFrame } from "../../../motion/engine/clock.ts";
import { now } from "../../../motion/env.ts";
import { val } from "../../../core/util.ts";
import { endOf, emitted, type FlowStore, type NodeStatus } from "../flow-canvas/model.ts";

export type RunState = "idle" | "running" | "paused" | "done" | "error";
/** One line of the run record. Times are ms from the start, on the motion clock. */
export interface TimelineEntry { node: string; label: string; start: number; end?: number; status: NodeStatus; value?: unknown; error?: string }

export interface FlowRunner {
  state: Accessor<RunState>;
  /** Run speed (1 = normal). */
  speed: Signal<number>;
  timeline: Accessor<readonly TimelineEntry[]>;
  /** Clock of the current run (ms), live while it runs. */
  elapsed: Accessor<number>;
  /** Start (or restart) a run. Resolves with how it ended. */
  run(): Promise<RunState>;
  pause(): void;
  resume(): void;
  /** Run exactly one node, then stay paused (starts a paused run when idle). */
  step(): void;
  /** Stop and clear the run state. */
  reset(): void;
}

export interface FlowRunnerOptions {
  /** Time a node shows as running (ms at speed 1). Default 650. */
  nodeMs?: number;
  /** Time a value travels along an edge (ms at speed 1). Default 560. */
  travelMs?: number;
}

const SKIP = Symbol("skip");

/** `const runner = createFlowRunner(flow)`; `<FlowControls runner={runner} flow={flow} />` */
export function createFlowRunner(flow: FlowStore, o: FlowRunnerOptions = {}): FlowRunner {
  const state = signal<RunState>("idle");
  const speed = signal(1);
  const timeline = signal<readonly TimelineEntry[]>([]);
  const elapsed = signal(0);
  let token = 0, t0 = 0, wake: (() => void) | null = null, stepOnce = false;
  let ticker: (() => void) | null = null;

  const wait = (ms: number, my: number): Promise<void> => new Promise((res) => {
    if (ms <= 0) { res(); return; }
    let tt = 0;
    const stop = onFrame((_, dt) => { tt += dt; if (tt >= ms || my !== token) { stop(); res(); } });
  });
  const gate = async (my: number): Promise<void> => {
    while (state.peek() === "paused" && !stepOnce && my === token) await new Promise<void>((r) => { wake = r; });
    stepOnce = false;
  };
  const setStatus = (id: string, s: NodeStatus): void => { flow.status.set(new Map(flow.status.peek()).set(id, s)); };
  const record = (e: TimelineEntry): number => { timeline.set([...timeline.peek(), e]); return timeline.peek().length - 1; };
  const patch = (i: number, p: Partial<TimelineEntry>): void => { const l = [...timeline.peek()]; l[i] = { ...l[i]!, ...p }; timeline.set(l); };
  const clock = (): number => now() - t0;

  async function exec(my: number): Promise<RunState> {
    const nodes = flow.nodes.peek(), edges = flow.edges.peek();
    const incoming = new Map(nodes.map((n) => [n.id, edges.filter((e) => endOf(e.to)[0] === n.id)]));
    const outgoing = new Map(nodes.map((n) => [n.id, edges.filter((e) => endOf(e.from)[0] === n.id)]));
    const arrived = new Map<string, Map<string, unknown>>();
    const queue = nodes.filter((n) => !incoming.get(n.id)!.length).map((n) => n.id);
    const ctrl = new AbortController();
    let failed = false;
    batch(() => { for (const id of queue) setStatus(id, "queued"); });
    const deliver = (from: string, value: (port: string) => unknown): void => {
      for (const e of outgoing.get(from) ?? []) {
        const to = endOf(e.to)[0];
        const got = arrived.get(to) ?? new Map<string, unknown>();
        got.set(e.id, value(endOf(e.from)[1]));
        arrived.set(to, got);
        if (got.size === incoming.get(to)!.length) { queue.push(to); setStatus(to, "queued"); }
      }
    };
    while (queue.length) {
      await gate(my);
      if (my !== token) { ctrl.abort(); return "idle"; }
      const id = queue.shift()!;
      const n = flow.node(id);
      if (!n) continue;
      const ty = flow.typeOf(n.type);
      const label = n.label.peek() || String(val(ty?.label) ?? n.type);
      const got = arrived.get(id) ?? new Map<string, unknown>();
      const live = [...got.entries()].filter(([, v]) => v !== SKIP);
      if (incoming.get(id)!.length && !live.length) {
        setStatus(id, "skipped");
        record({ node: id, label, start: clock(), end: clock(), status: "skipped" });
        deliver(id, () => SKIP);
        continue;
      }
      setStatus(id, "running");
      const at = record({ node: id, label, start: clock(), status: "running" });
      await wait((o.nodeMs ?? 650) / speed.peek(), my);
      if (my !== token) return "idle";
      const inputs: Record<string, unknown> = {};
      for (const [eid, v] of live) { const e = edges.find((x) => x.id === eid)!; inputs[endOf(e.to)[1]] = v; }
      let result: unknown;
      try {
        const data = n.data.peek();
        result = await ty?.run?.({ node: { id, type: n.type, x: n.x.peek(), y: n.y.peek(), data }, data, inputs, input: live[0]?.[1], signal: ctrl.signal });
      } catch (err) {
        failed = true;
        const msg = err instanceof Error ? err.message : String(err);
        batch(() => { setStatus(id, "error"); flow.errors.set(new Map(flow.errors.peek()).set(id, msg)); });
        patch(at, { end: clock(), status: "error", error: msg });
        deliver(id, () => SKIP);
        continue;
      }
      if (my !== token) return "idle";
      setStatus(id, "done");
      patch(at, { end: clock(), status: "done", value: result });
      const em = emitted(result);
      const valueOf = (port: string): unknown => (em ? (port in em ? em[port] : SKIP) : result);
      const travel = (o.travelMs ?? 560) / speed.peek();
      let sent = 0;
      for (const e of outgoing.get(id) ?? []) if (valueOf(endOf(e.from)[1]) !== SKIP) { flow.pulse(e.id, travel); sent++; }
      if (sent) await wait(travel, my);
      if (my !== token) return "idle";
      deliver(id, valueOf);
    }
    return failed ? "error" : "done";
  }

  const runner: FlowRunner = {
    state, speed, timeline, elapsed,
    async run() {
      const my = ++token;
      wake?.();
      flow.resetRun();
      batch(() => { timeline.set([]); elapsed.set(0); if (!(state.peek() === "paused" && stepOnce)) state.set("running"); });
      t0 = now();
      ticker?.();
      ticker = onFrame(() => elapsed.set(clock()));
      const end = await exec(my);
      if (my !== token) return state.peek();
      ticker?.(); ticker = null;
      elapsed.set(clock());
      state.set(end);
      return end;
    },
    pause() { if (state.peek() === "running") state.set("paused"); },
    resume() { if (state.peek() === "paused") { state.set("running"); wake?.(); } },
    step() {
      const s = state.peek();
      stepOnce = true;
      if (s === "paused") { wake?.(); return; }
      if (s === "running") { stepOnce = false; state.set("paused"); return; }
      state.set("paused");
      void runner.run();
    },
    reset() {
      token++;
      wake?.();
      ticker?.(); ticker = null;
      stepOnce = false;
      batch(() => { state.set("idle"); timeline.set([]); elapsed.set(0); flow.resetRun(); });
    },
  };
  return runner;
}
