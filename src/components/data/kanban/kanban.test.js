import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Kanban } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Kanban: columns, counts, tones and keyboard moves", () => {
  const moves = [];
  const cols = [{ id: "a", title: "A", tone: "info", items: [{ id: "1" }, { id: "2" }] }, { id: "b", title: "B", items: [] }];
  const m = mount(() => h(Kanban, { columns: cols, itemKey: (x) => x.id, card: (x) => `card ${x.id}`, onMove: (it, from, to) => moves.push([it.id, from, to]) }));
  const sections = m.el.querySelectorAll(".hm-kanban-col");
  assert.equal(sections.length, 2);
  assert.equal(sections[0].getAttribute("aria-label"), "A");
  assert.equal(sections[0].querySelector(".hm-kanban-count").textContent, "2");
  assert.ok(sections[0].querySelector(".hm-kanban-dot").className.includes("hm-kanban-dot-info"));
  const card = sections[0].querySelector(".hm-kanban-card");
  assert.equal(card.getAttribute("tabindex"), "0");
  card.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true }));
  card.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true }));
  assert.deepEqual(moves, [["1", "a", "b"]], "no column before the first");
  m.dispose();
});
