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
  const sections = m.el.querySelectorAll(".m-kanban-col");
  assert.equal(sections.length, 2);
  assert.equal(sections[0].getAttribute("aria-label"), "A");
  assert.equal(sections[0].querySelector(".m-kanban-count").textContent, "2");
  assert.ok(sections[0].querySelector(".m-kanban-dot").className.includes("m-kanban-dot-info"));
  const card = sections[0].querySelector(".m-kanban-card");
  assert.equal(card.getAttribute("tabindex"), "0");
  card.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, bubbles: true }));
  card.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "ArrowLeft", altKey: true, bubbles: true }));
  assert.deepEqual(moves, [["1", "a", "b"]], "no column before the first");
  m.dispose();
});

test("Kanban: colour token, own dot and count, parts off, no entrance", () => {
  const cols = [{ id: "a", title: "A", color: "brand-orange", items: [{ id: "1" }] }];
  const base = { columns: cols, itemKey: (x) => x.id, card: (x) => x.id };
  const m = mount(() => [h(Kanban, base), h(Kanban, { ...base, dot: false, count: false, animate: false, class: "mine" }), h(Kanban, { ...base, dot: () => h("i", { class: "own-dot" }), count: (c) => `${c.items.length} / 5` })]);
  const [a, b, c] = m.el.querySelectorAll(".m-kanban");
  assert.equal(a.querySelector(".m-kanban-dot").getAttribute("data-m-color"), "brand-orange");
  assert.ok(!a.className.includes("is-still"));
  assert.equal(b.querySelector(".m-kanban-dot, .m-kanban-count"), null);
  assert.ok(b.className.includes("is-still") && b.className.includes("mine"));
  assert.ok(c.querySelector(".m-kanban-dot-own .own-dot"));
  assert.equal(c.querySelector(".m-kanban-count").textContent, "1 / 5");
  m.dispose();
});

test("Kanban: a card is dragged with the drag behavior (a copy follows, the column under the pointer is marked, drop moves)", () => {
  const moves = [];
  const cols = [{ id: "a", title: "A", items: [{ id: "1" }] }, { id: "b", title: "B", items: [] }];
  const m = mount(() => h(Kanban, { columns: cols, itemKey: (x) => x.id, card: (x) => `card ${x.id}`, onMove: (it, from, to) => moves.push([it.id, from, to]) }));
  const [a, b] = m.el.querySelectorAll(".m-kanban-col");
  const card = a.querySelector(".m-kanban-card");
  assert.equal(card.getAttribute("draggable"), null, "no HTML5 drag and drop");
  let under = a;
  document.elementFromPoint = () => under;
  const ptr = (type, x, y) => Object.assign(new globalThis.Event(type, { bubbles: true, cancelable: true }), { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0 });
  card.dispatchEvent(ptr("pointerdown", 10, 10));
  document.dispatchEvent(ptr("pointermove", 40, 10));
  assert.ok(card.classList.contains("is-dragging"));
  assert.ok(document.querySelector(".m-kanban-ghost"), "the copy is in the drag layer");
  assert.ok(a.classList.contains("is-over"));
  under = b;
  document.dispatchEvent(ptr("pointermove", 300, 10));
  assert.ok(b.classList.contains("is-over") && !a.classList.contains("is-over"));
  document.dispatchEvent(ptr("pointerup", 300, 10));
  assert.deepEqual(moves, [["1", "a", "b"]]);
  assert.ok(!card.classList.contains("is-dragging") && !b.classList.contains("is-over"));
  assert.equal(document.querySelector(".m-kanban-ghost"), null);
  card.dispatchEvent(ptr("pointerdown", 10, 10));
  document.dispatchEvent(ptr("pointermove", 40, 10));
  document.dispatchEvent(Object.assign(new globalThis.Event("keydown", { bubbles: true, cancelable: true }), { key: "Escape" }));
  assert.equal(moves.length, 1, "Escape cancels");
  delete document.elementFromPoint;
  m.dispose();
});
