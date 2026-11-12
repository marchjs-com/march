import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { VirtualList } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const wait = (ms = 40) => new Promise((r) => setTimeout(r, ms));

test("VirtualList: renders a window of rows, list semantics, rows follow their item", async () => {
  const items = signal(Array.from({ length: 500 }, (_, i) => ({ id: i, text: `row ${i}` })));
  let built = 0;
  const m = mount(() => h(VirtualList, { items, key: (x) => x.id, estimate: 100, overscan: 100, label: "Rows", render: (it) => { built++; return h("p", null, () => it().text); } }));
  await wait();
  const list = m.el.querySelector("[role=list]");
  assert.equal(list.getAttribute("aria-label"), "Rows");
  const rows = list.querySelectorAll("[role=listitem]");
  assert.ok(rows.length > 0 && rows.length < 40, `only a window is rendered (${rows.length})`);
  assert.equal(rows[0].getAttribute("aria-posinset"), "1");
  assert.equal(rows[0].getAttribute("aria-setsize"), "500");
  const before = built;
  const next = items().slice(); next[0] = { id: 0, text: "updated" }; items.set(next);
  await wait();
  assert.equal(list.querySelector("p").textContent, "updated");
  assert.equal(built, before, "same key: the row updates, it is not rebuilt");
  m.dispose();
});

test("VirtualList: onEndReached once per item count near the end", async () => {
  const items = signal(Array.from({ length: 3 }, (_, i) => i));
  let calls = 0;
  const m = mount(() => h(VirtualList, { items, estimate: 50, render: (it) => h("p", null, String(it())), onEndReached: () => { calls++; } }));
  await wait();
  assert.equal(calls, 1);
  items.set([0, 1, 2, 3, 4]);
  await wait();
  assert.equal(calls, 2);
  m.dispose();
});
