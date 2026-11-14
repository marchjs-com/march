import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { KeyValue } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("KeyValue: rows, object items, hints, hidden rows, empty placeholder, columns", () => {
  const m = mount(() => [
    h(KeyValue, { columns: 9, items: [{ label: "A", value: "1", hint: "h" }, { label: "B", value: "" }, { label: "C", value: "x", hidden: true }] }),
    h(KeyValue, { items: { Plan: "Pro" }, empty: "n/a" }),
  ]);
  const [a, b] = m.el.querySelectorAll("dl");
  assert.ok(a.className.includes("hm-kv-cols-4"), "columns capped at 4");
  assert.equal(a.querySelectorAll("dt").length, 2, "hidden row skipped");
  assert.equal(a.querySelector(".hm-kv-hint").textContent, "h");
  assert.equal(a.querySelectorAll("dd")[1].textContent, "—");
  assert.equal(b.querySelector("dt.hm-kv-label").textContent, "Plan");
  assert.equal(b.querySelector("dd.hm-kv-value").textContent, "Pro");
  assert.equal(b.querySelector("dd").textContent, "Pro");
  m.dispose();
});
