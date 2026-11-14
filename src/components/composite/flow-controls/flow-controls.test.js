import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { FlowControls, FlowTimeline, createFlowRunner } = await import("./index.ts");
const { createFlow, emit, FLOW_SCHEMA } = await import("../flow-canvas/index.ts");
const { manualClock, step } = await import("../../../motion/engine/clock.ts");

const types = [
  { type: "src", label: "Source", outputs: [{ id: "out" }], run: () => 5 },
  { type: "split", label: "Split", inputs: [{ id: "in" }], outputs: [{ id: "big" }, { id: "small" }], run: ({ input }) => (input > 3 ? emit({ big: input }) : emit({ small: input })) },
  { type: "double", label: "Double", inputs: [{ id: "in" }], outputs: [{ id: "out" }], run: ({ input }) => input * 2 },
  { type: "boom", label: "Boom", inputs: [{ id: "in" }], outputs: [{ id: "out" }], run: () => { throw new Error("nope"); } },
  { type: "join", label: "Join", inputs: [{ id: "a" }, { id: "b" }], outputs: [{ id: "out" }], run: ({ inputs }) => inputs.a ?? inputs.b },
  { type: "sink", label: "Sink", inputs: [{ id: "in" }], run: ({ input }) => input },
];
const doc = (withBoom) => ({ schema: FLOW_SCHEMA, nodes: [
  { id: "s", type: "src", x: 0, y: 0 }, { id: "p", type: "split", x: 1, y: 0 }, { id: "d", type: withBoom ? "boom" : "double", x: 2, y: 0 },
  { id: "q", type: "double", x: 2, y: 1 }, { id: "j", type: "join", x: 3, y: 0 }, { id: "k", type: "sink", x: 4, y: 0 },
], edges: [
  { id: "e1", from: "s.out", to: "p.in" }, { id: "e2", from: "p.big", to: "d.in" }, { id: "e3", from: "p.small", to: "q.in" },
  { id: "e4", from: "d.out", to: "j.a" }, { id: "e5", from: "q.out", to: "j.b" }, { id: "e6", from: "j.out", to: "k.in" },
] });
const tick = () => new Promise((r) => setTimeout(r, 0));
// drive the motion clock by hand until the run settles
async function settle(p) { let done = false; p.then(() => { done = true; }); for (let i = 0; i < 400 && !done; i++) { step(50); await tick(); } return p; }

test("runner: branches skip, joins wait for both sides, edges count values, timeline records", async () => {
  manualClock(true);
  const flow = createFlow({ types, doc: doc(false), undo: false });
  const r = createFlowRunner(flow, { nodeMs: 100, travelMs: 100 });
  const end = await settle(r.run());
  assert.equal(end, "done");
  const st = flow.status.peek();
  assert.equal(st.get("q"), "skipped");
  assert.equal(st.get("j"), "done");
  assert.equal(st.get("k"), "done");
  assert.equal(flow.counts.peek().get("e2"), 1);
  assert.equal(flow.counts.peek().get("e3") ?? 0, 0);
  assert.deepEqual(r.timeline().map((e) => e.node), ["s", "p", "d", "q", "j", "k"]);
  assert.ok(r.timeline().every((e) => e.end != null && e.end >= e.start));
  manualClock(false);
});

test("runner: an error marks the node, skips what follows, ends with error; step and reset", async () => {
  manualClock(true);
  const flow = createFlow({ types, doc: doc(true), undo: false });
  const r = createFlowRunner(flow, { nodeMs: 100, travelMs: 100 });
  assert.equal(await settle(r.run()), "error");
  assert.equal(flow.status.peek().get("d"), "error");
  assert.equal(flow.errors.peek().get("d"), "nope");
  assert.equal(flow.status.peek().get("k"), "skipped");
  r.reset();
  assert.equal(r.state(), "idle");
  assert.equal(flow.status.peek().size, 0);
  r.step();
  for (let i = 0; i < 20; i++) { step(50); await tick(); }
  assert.equal(r.state(), "paused");
  assert.equal(r.timeline().length, 1, "one node per step");
  r.reset();
  manualClock(false);
});

test("FlowControls + FlowTimeline: toolbar, state, rows", async () => {
  manualClock(true);
  const flow = createFlow({ types, doc: doc(false), undo: false });
  const r = createFlowRunner(flow, { nodeMs: 50, travelMs: 50 });
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(FlowControls, { runner: r, flow, timeline: true }), host);
  assert.match(host.querySelector('[role="toolbar"]').getAttribute("aria-label"), /Run controls|Çalıştırma denetimleri/);
  assert.match(host.querySelector(".m-flowtl-empty").textContent, /Run the flow|akışı çalıştırın/);
  host.querySelector(".m-flowctl-run").click();
  assert.equal(r.state(), "running");
  for (let i = 0; i < 200 && r.state() === "running"; i++) { step(50); await tick(); }
  assert.equal(r.state(), "done");
  assert.equal(host.querySelectorAll(".m-flowtl-row").length, 6);
  assert.match(host.querySelector(".m-flowctl-count").textContent, /5 \/ 6/);
  dispose();
  manualClock(false);
});

test("FlowControls: parts off, own texts and icons; FlowTimeline: no axis, own empty text", () => {
  const flow = createFlow({ types, doc: doc(false), undo: false });
  const r = createFlowRunner(flow, { nodeMs: 100, travelMs: 100 });
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => [
    h(FlowControls, { runner: r, flow, class: "mine", step: false, reset: false, speeds: false, clock: false,
      icons: { run: h("i", { class: "own-run" }) }, labels: { toolbar: "Runner", run: "Start", ready: "Waiting", count: (d, n) => `${d} of ${n}` } }),
    h(FlowControls, { runner: r, flow, status: false, count: false, labels: { step: "One step" } }),
    h(FlowTimeline, { runner: r, axis: false, labels: { region: "Record", empty: "Nothing ran yet" } }),
    h(FlowTimeline, { runner: r, empty: false }),
  ], host);
  const [a, b] = host.querySelectorAll(".m-flowctl");
  assert.ok(a.classList.contains("mine"));
  assert.equal(a.querySelector("[role=toolbar]").getAttribute("aria-label"), "Runner");
  assert.match(a.querySelector(".m-flowctl-run").textContent, /Start/);
  assert.ok(a.querySelector(".m-flowctl-run .own-run"));
  assert.equal(a.querySelector(".m-flowctl-step"), null);
  assert.equal(a.querySelector(".m-flowctl-reset"), null);
  assert.equal(a.querySelector(".m-flowctl-speed"), null);
  assert.equal(a.querySelector(".m-flowctl-clock"), null);
  assert.match(a.querySelector(".m-flowctl-status").textContent, /Waiting/);
  assert.equal(a.querySelector(".m-flowctl-count").textContent, "0 of 6");
  assert.equal(b.querySelector(".m-flowctl-step").getAttribute("aria-label"), "One step");
  assert.ok(b.querySelector(".m-flowctl-reset") && b.querySelector(".m-flowctl-speed") && b.querySelector(".m-flowctl-clock"));
  assert.equal(b.querySelector(".m-flowctl-count"), null);
  assert.equal(b.querySelector(".m-chip2"), null);
  const [t1, t2] = host.querySelectorAll(".m-flowtl");
  assert.equal(t1.getAttribute("aria-label"), "Record");
  assert.equal(t1.querySelector(".m-flowtl-axis"), null);
  assert.equal(t1.querySelector(".m-flowtl-empty").textContent, "Nothing ran yet");
  assert.ok(t2.querySelector(".m-flowtl-axis"));
  assert.equal(t2.querySelector(".m-flowtl-empty"), null);
  dispose();
});
