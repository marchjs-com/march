import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Slider } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("Slider: range input, value both ways, formatted output", () => {
  const v = signal(30);
  const { el } = mount(() => h(Slider, { "bind:value": v, min: 0, max: 50, step: 5, format: (x) => `${x} pts` }));
  const input = el.querySelector("input[type=range]");
  assert.equal(input.getAttribute("max"), "50");
  assert.equal(input.getAttribute("step"), "5");
  assert.equal(el.querySelector("output").textContent, "30 pts");
  type(input, "45");
  assert.equal(v(), 45);
  assert.equal(el.querySelector("output").textContent, "45 pts");
});
