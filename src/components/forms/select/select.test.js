import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Select } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("Select: typed values, placeholder option, live options", () => {
  const v = signal(2);
  const opts = signal([{ value: 1, label: "One" }, { value: 2, label: "Two" }]);
  const { el } = mount(() => h(Select, { "bind:value": v, options: opts, placeholder: "Pick" }));
  const sel = el.querySelector("select");
  const options = sel.querySelectorAll("option");
  assert.equal(options[0].textContent, "Pick");
  assert.equal(sel.value, "1");
  sel.value = "0"; fire(sel, "change");
  assert.equal(v(), 1, "number stays a number");
  sel.value = ""; fire(sel, "change");
  assert.equal(v(), null);
  opts.set([...opts(), { value: 3, label: "Three" }]);
  assert.equal(el.querySelectorAll("option").length, 4);
});

test("Select: placeholder={false} draws no empty option", () => {
  const { el } = mount(() => h(Select, { value: "b", options: ["a", "b"], placeholder: false }));
  assert.deepEqual([...el.querySelectorAll("option")].map((o) => o.textContent), ["a", "b"]);
  assert.equal(el.querySelector("select").value, "1");
});
