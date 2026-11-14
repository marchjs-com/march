import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const { JsonView } = await import("./index.ts");

test("JsonView: typed values, open depth, toggle, circular reference", () => {
  const value = { a: 1, s: "x", n: null, list: [true, 2], deep: { k: { z: 1 } } };
  value.self = value;
  const m = mount(() => h(JsonView, { value, open: 1 }));
  const root = m.el.querySelector(".hm-json [role=tree]");
  assert.ok(root.querySelector(".hm-json-number") && root.querySelector(".hm-json-string") && root.querySelector(".hm-json-null"));
  const toggles = [...root.querySelectorAll(".hm-json-toggle")];
  assert.equal(toggles[0].getAttribute("aria-expanded"), "true", "depth 0 open");
  const list = toggles.find((b) => b.textContent.startsWith('"list"'));
  assert.equal(list.getAttribute("aria-expanded"), "false", "depth 1 closed");
  assert.match(list.textContent, /2 items/);
  list.click();
  assert.equal(list.getAttribute("aria-expanded"), "true");
  assert.ok(root.querySelector(".hm-json-boolean"));
  assert.match(root.textContent, /\[circular\]/);
  m.dispose();
});

test("JsonView: own texts, no arrow, own arrow, accessible name", () => {
  const value = { list: [1, 2], o: { a: 1 } };
  value.self = value;
  const m = mount(() => [h(JsonView, { value, labels: { items: "entries", keys: "fields", circular: "(loop)" }, arrow: false, label: "Order" }), h(JsonView, { value, arrow: (open) => h("i", {}, () => (open() ? "-" : "+")) })]);
  const [a, b] = m.el.querySelectorAll(".hm-json");
  assert.equal(a.querySelector("[role=tree]").getAttribute("aria-label"), "Order");
  assert.match(a.textContent, /2 entries/);
  assert.match(a.textContent, /1 fields/);
  assert.match(a.textContent, /\(loop\)/);
  assert.ok(a.querySelector(".hm-json-toggle").className.includes("is-plain"));
  assert.equal(a.querySelector(".hm-json-arrow"), null);
  const t0 = b.querySelector(".hm-json-toggle");
  assert.ok(t0.className.includes("is-own"));
  assert.equal(t0.querySelector(".hm-json-arrow").textContent, "-");
  t0.click();
  assert.equal(t0.querySelector(".hm-json-arrow").textContent, "+");
  m.dispose();
});
