// One effect per template clone (compiler/index.js › emitTemplate, dom/tpl.ts › _txt / _st): a text part draws its value
// as a region would (text in place; a node or a list between the text node and an end marker), and a part changing does
// not rewrite the others.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";

installDom();
const { signal, effect, createRoot, _st, _scls } = await import("../src/index.ts");

test("a template's text part shows text, then a node, a list, nothing and text again, in place", () => {
  const td = document.createElement("td"), tail = document.createElement("b");
  td.appendChild(tail);
  const v = signal("a");
  createRoot(() => { let t = null; effect(() => { t = _st(t, td, tail, v()); }); });
  assert.equal(td.textContent, "a");
  assert.ok(td.lastChild === tail);
  v.set(7); assert.equal(td.textContent, "7");
  const i = document.createElement("i");
  v.set(i); assert.equal(td.querySelector("i"), i, "a node is drawn");
  assert.ok(td.lastChild === tail, "before the next sibling");
  v.set(["x", "y"]); assert.equal(td.textContent, "xy");
  v.set(null); assert.equal(td.textContent, "");
  v.set("back"); assert.equal(td.textContent, "back");
});

test("in one effect, a part writes only when its own value changes", () => {
  const tr = document.createElement("tr"), td = document.createElement("td");
  tr.appendChild(td);
  const cls = signal(""), label = signal("x");
  let writes = 0;
  createRoot(() => {
    let t = null;
    effect(() => {
      _scls(tr, cls());
      const was = t;
      t = _st(t, td, null, label());
      if (!was) { let d = t.data; Object.defineProperty(t, "data", { configurable: true, get: () => d, set: (x) => { writes++; d = x; } }); }
    });
  });
  const first = writes;
  cls.set("danger");
  assert.equal(tr.getAttribute("class"), "danger");
  assert.equal(writes, first, "the label is not rewritten when only the class changes");
  label.set("y");
  assert.equal(writes, first + 1);
});
