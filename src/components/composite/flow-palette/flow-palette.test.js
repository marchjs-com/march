import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { FlowPalette } = await import("./index.ts");
const { createFlow } = await import("../flow-canvas/index.ts");
const { sampleTypes } = await import("../flow-canvas/sample.ts");

test("FlowPalette: categories, named cards, Enter adds a node, search filters", async () => {
  const flow = createFlow({ types: sampleTypes, undo: false });
  const added = [];
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(FlowPalette, { flow, onAdd: (id, ty) => added.push(ty.type) }), host);
  assert.ok(host.querySelectorAll(".hm-flowpal-cat").length >= 3);
  const cards = host.querySelectorAll(".hm-flowpal-card");
  assert.equal(cards.length, sampleTypes.length);
  assert.match(cards[0].getAttribute("aria-label"), /Sipariş geldi/);
  cards[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.deepEqual(added, ["webhook"]);
  assert.equal(flow.nodes.peek().length, 1);
  const input = host.querySelector("input");
  input.value = "odeme";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 5));
  const names = [...host.querySelectorAll(".hm-flowpal-card")].map((c) => c.getAttribute("aria-label"));
  assert.ok(names.length >= 1 && names.every((n) => /Ödeme/i.test(n)), names.join(" | "));
  dispose();
});
