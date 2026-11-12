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
