import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { FlowCanvas, createFlow, validateFlow, layeredLayout, FLOW_SCHEMA } = await import("./index.ts");
const { sampleTypes, sampleDoc } = await import("./sample.ts");
const { undoStack } = await import("../../../managers/undo/index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("FlowCanvas model: JSON round trip, readable edges, validation", () => {
  const flow = createFlow({ types: sampleTypes, doc: sampleDoc() });
  const doc = flow.toJSON();
  assert.equal(doc.schema, FLOW_SCHEMA);
  assert.equal(doc.nodes.length, 8);
  assert.deepEqual(doc.edges[0], { id: "e1", from: "hook.out", to: "customer.in" });
  assert.deepEqual(validateFlow(doc, sampleTypes), []);
  const bad = validateFlow({ schema: "x", nodes: [{ id: "a.b", type: "nope", x: 0, y: 0 }], edges: [{ id: "e", from: "a.out", to: "z.in" }] }, sampleTypes);
  assert.ok(bad.length >= 3, bad.join("\n"));
  assert.throws(() => flow.load({ schema: FLOW_SCHEMA, nodes: "x", edges: [] }));
});

test("FlowCanvas model: connect refuses cycles and wrong sides; copy / paste with new ids; undo", async () => {
  const flow = createFlow({ types: sampleTypes, doc: sampleDoc() });
  assert.equal(flow.canConnect("mail.in", "hook.out"), false, "input → output is not an edge");
  assert.equal(flow.canConnect("join.out", "customer.in"), false, "cycle");
  assert.equal(flow.connect("hook.out", "save.in") !== null, true);
  const before = flow.nodes.peek().length;
  const text = flow.copy(["pay", "review"]);
  const ids = flow.paste(text);
  assert.equal(ids.length, 2);
  assert.equal(flow.nodes.peek().length, before + 2);
  assert.ok(ids.every((id) => !["pay", "review"].includes(id)));
  assert.equal(flow.groups.peek().length, 2, "the copied group comes along");
  await new Promise((r) => setTimeout(r, 0)); // the UndoManager loads on the first change
  await undoStack().undo();
  assert.equal(flow.nodes.peek().length, before);
  await undoStack().redo();
  assert.equal(flow.nodes.peek().length, before + 2);
});

test("FlowCanvas model: layered layout puts every edge left to right", () => {
  const flow = createFlow({ types: sampleTypes, doc: sampleDoc(), undo: false });
  const pos = layeredLayout(flow);
  for (const e of flow.edges.peek()) {
    const a = pos.get(e.from.split(".")[0]), b = pos.get(e.to.split(".")[0]);
    assert.ok(a.x < b.x, `${e.from} → ${e.to}`);
  }
});

test("FlowCanvas: nodes, named ports, selection and Delete", () => {
  const flow = createFlow({ types: sampleTypes, doc: sampleDoc(), undo: false });
  const m = mount(() => h(FlowCanvas, { flow }));
  const canvas = m.el.querySelector(".hm-flow");
  assert.equal(canvas.getAttribute("role"), "application");
  assert.equal(m.el.querySelectorAll(".hm-flow-node").length, 8);
  const port = m.el.querySelector('[data-ref="hook.out"]');
  assert.match(port.getAttribute("aria-label"), /sipariş/);
  assert.equal(m.el.querySelectorAll(".hm-flow-pill").length, 8);
  flow.selection.set(new Set(["save"]));
  canvas.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
  assert.equal(m.el.querySelectorAll(".hm-flow-node").length, 7);
  assert.equal(flow.edges.peek().some((e) => e.to === "save.in"), false, "its edges went with it");
  m.dispose();
});

test("FlowCanvas: keyboard connect (Enter on two ports) and run state classes", () => {
  const flow = createFlow({ types: sampleTypes, doc: sampleDoc(), undo: false });
  const m = mount(() => h(FlowCanvas, { flow }));
  const key = (el) => el.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  key(m.el.querySelector('[data-ref="hook.out"]'));
  assert.equal(m.el.querySelector('[data-ref="hook.out"]').getAttribute("aria-pressed"), "true");
  key(m.el.querySelector('[data-ref="save.in"]'));
  assert.ok(flow.edges.peek().some((e) => e.from === "hook.out" && e.to === "save.in"));
  flow.status.set(new Map([["pay", "error"]]));
  flow.errors.set(new Map([["pay", "Declined"]]));
  const pay = m.el.querySelector('[data-node="pay"]');
  assert.ok(pay.className.includes("is-error"));
  assert.equal(pay.querySelector(".hm-flow-error").textContent, "Declined");
  m.dispose();
});

test("FlowCanvas: zoom bar off or in parts, own texts, own menu, no menu", () => {
  const flow = createFlow({ types: sampleTypes, doc: sampleDoc(), undo: false });
  let got = null;
  const m = mount(() => [
    h(FlowCanvas, { flow, class: "a", controls: ["zoom"], minimap: false, labels: { editor: "diagram", zoomIn: "Closer", input: (p) => `In: ${p}`, node: "step" } }),
    h(FlowCanvas, { flow, class: "b", controls: false, menu: false, motion: false, labels: { minimap: "Map" } }),
    h(FlowCanvas, { flow, class: "c", minimap: false, menu: (items) => { got = items; return [{ label: "Mine", onSelect() {} }]; } }),
  ]);
  const a = m.el.querySelector(".hm-flow.a"), b = m.el.querySelector(".hm-flow.b"), c = m.el.querySelector(".hm-flow.c");
  assert.equal(a.getAttribute("aria-roledescription"), "diagram");
  const names = [...a.querySelectorAll(".hm-flow-zoom button")].map((x) => x.getAttribute("aria-label"));
  assert.equal(names.length, 2, "only − and +");
  assert.ok(names.includes("Closer"));
  assert.match(a.querySelector('[data-ref="customer.in"]').getAttribute("aria-label"), /^In: /);
  assert.equal(a.querySelector(".hm-flow-node").getAttribute("aria-roledescription"), "step");
  assert.equal(b.querySelector(".hm-flow-zoom"), null);
  assert.equal(b.querySelector(".hm-flow-minimap").getAttribute("aria-label"), "Map");
  assert.equal(c.querySelectorAll(".hm-flow-zoom button").length, 4, "the default bar is whole");
  c.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
  assert.ok(Array.isArray(got) && got.length > 3, "the own menu function gets the built-in items");
  got = null;
  b.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 5 }));
  assert.equal(got, null);
  m.dispose();
});
