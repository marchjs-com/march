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
  assert.ok(host.querySelectorAll(".m-flowpal-cat").length >= 3);
  const cards = host.querySelectorAll(".m-flowpal-card");
  assert.equal(cards.length, sampleTypes.length);
  assert.match(cards[0].getAttribute("aria-label"), /Sipariş geldi/);
  cards[0].dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
  assert.deepEqual(added, ["webhook"]);
  assert.equal(flow.nodes.peek().length, 1);
  const input = host.querySelector("input");
  input.value = "odeme";
  input.dispatchEvent(new Event("input", { bubbles: true }));
  await new Promise((r) => setTimeout(r, 5));
  const names = [...host.querySelectorAll(".m-flowpal-card")].map((c) => c.getAttribute("aria-label"));
  assert.ok(names.length >= 1 && names.every((n) => /Ödeme/i.test(n)), names.join(" | "));
  dispose();
});

test("FlowPalette: parts off, own card, own texts, own empty state", async () => {
  const flow = createFlow({ types: sampleTypes, undo: false });
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => [
    h(FlowPalette, { flow, class: "mine", categories: false, descriptions: false, grip: false, labels: { region: "Steps", search: "Find a step", hint: "Press Enter", empty: "Nothing" } }),
    h(FlowPalette, { flow, renderCard: (ty) => h("b", { class: "own" }, ty.type), empty: false }),
  ], host);
  const [a, b] = host.querySelectorAll(".m-flowpal");
  assert.ok(a.classList.contains("mine"));
  assert.equal(a.getAttribute("aria-label"), "Steps");
  assert.equal(a.querySelector("input").getAttribute("placeholder"), "Find a step");
  assert.equal(a.querySelector(".m-sr-only").textContent, "Press Enter");
  assert.equal(a.querySelector(".m-flowpal-cattitle"), null);
  assert.equal(a.querySelector(".m-flowpal-desc"), null);
  assert.equal(a.querySelector(".m-flowpal-grip"), null);
  assert.ok(a.querySelector(".m-flowpal-name"));
  assert.equal(b.querySelectorAll(".m-flowpal-own .own").length, sampleTypes.length);
  assert.equal(b.querySelector(".m-flowpal-name"), null);
  assert.ok(b.querySelector(".m-flowpal-grip"), "the default parts stay unless turned off");
  for (const p of [a, b]) { const input = p.querySelector("input"); input.value = "zzzzqq"; input.dispatchEvent(new Event("input", { bubbles: true })); }
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(a.querySelector(".m-flowpal-empty").textContent, "Nothing");
  assert.equal(b.querySelector(".m-flowpal-empty"), null);
  dispose();
});
