import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { KeyValueEditor } = await import("./index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void tick; void type; void key; void signal;

test("KeyValueEditor: rows → object, numbers, duplicate keys flagged", () => {
  const o = signal({ a: "1" });
  const { el } = mount(() => h(KeyValueEditor, { "bind:value": o, numbers: true }));
  assert.ok(el.querySelector("[role=group]"));
  el.querySelector(".m-kv-add").click();
  const inputs = el.querySelectorAll(".m-kv-row input");
  assert.equal(inputs[0].getAttribute("aria-label"), "Key");
  type(inputs[2], "b"); type(inputs[3], "42");
  assert.deepEqual(o(), { a: 1, b: 42 });
  type(inputs[2], "a");
  assert.equal(inputs[2].getAttribute("aria-invalid"), "true");
  assert.match(el.textContent, /Duplicate key/);
  const ro = mount(() => h(KeyValueEditor, { value: { x: "1" }, readonly: true }));
  assert.equal(ro.el.querySelector(".m-kv-add"), null);
});

test("KeyValueEditor: texts, the remove button and the add button are yours", () => {
  const a = mount(() => h(KeyValueEditor, { value: { a: "1" }, labels: { key: "Name", value: "Content", remove: "Drop", add: "New line" }, removeIcon: "del" }));
  const [k, v] = a.el.querySelectorAll(".m-kv-row input");
  assert.equal(k.getAttribute("aria-label"), "Name");
  assert.equal(k.getAttribute("placeholder"), "Name");
  assert.equal(v.getAttribute("aria-label"), "Content");
  const x = a.el.querySelector(".m-kv-row .m-icon-btn");
  assert.equal(x.getAttribute("aria-label"), "Drop");
  assert.equal(x.textContent, "del");
  assert.equal(a.el.querySelector(".m-kv-add").textContent, "New line");
  a.dispose();
  const b = mount(() => h(KeyValueEditor, { value: { a: "1" }, removable: false, addable: false }));
  assert.equal(b.el.querySelector(".m-icon-btn"), null);
  assert.equal(b.el.querySelector(".m-kv-add"), null);
  assert.equal(b.el.querySelectorAll(".m-kv-row input").length, 2);
  b.dispose();
});
