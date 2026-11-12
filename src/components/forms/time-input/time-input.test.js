import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { TimeInput } = await import("./index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void tick; void type; void key; void signal;

test("TimeInput: native time input with min / max / step and a two-way value", () => {
  const v = signal("09:30");
  const { el } = mount(() => h(TimeInput, { "bind:value": v, min: "09:00", max: "18:00", step: 60 }));
  const input = el.querySelector("input");
  assert.equal(input.getAttribute("type"), "time");
  assert.equal(input.getAttribute("min"), "09:00");
  assert.equal(input.getAttribute("step"), "60");
  assert.equal(input.value, "09:30");
  type(input, "10:15");
  assert.equal(v(), "10:15");
});
