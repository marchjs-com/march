import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { ChoicePicker, pickerKind } = await import("./index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void tick; void type; void key; void signal;

test("ChoicePicker: auto look by option count; forced kinds win; a click sets the value", () => {
  const o = (n) => Array.from({ length: n }, (_, i) => ({ value: i, label: `Option ${i}` }));
  assert.equal(pickerKind(o(3)), "segmented");
  assert.equal(pickerKind(o(8)), "chips");
  assert.equal(pickerKind(o(12)), "combobox");
  assert.equal(pickerKind(o(3), "chips"), "chips");
  const v = signal(null);
  const { el } = mount(() => h(ChoicePicker, { "bind:value": v, options: ["a", "b", "c"] }));
  assert.equal(el.querySelector("select"), null);
  el.querySelectorAll("[role=radio]")[2].click();
  assert.equal(v(), "c");
  const chips = mount(() => h(ChoicePicker, { value: null, options: o(8) }));
  assert.ok(chips.el.querySelector(".hm-picker-chips .hm-choice-chip"));
});
