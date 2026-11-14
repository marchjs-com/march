import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { MultiSelect } = await import("./index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void tick; void type; void key; void signal;

test("MultiSelect: chips, Enter adds, Backspace and × remove", () => {
  const tags = signal(["a"]);
  const { el } = mount(() => h(MultiSelect, { "bind:value": tags, options: [{ value: "a", label: "Alpha" }, { value: "b", label: "Beta" }] }));
  assert.equal(el.querySelector(".hm-chip2-label").textContent, "Alpha");
  assert.equal(el.querySelector(".hm-chip2-x").getAttribute("aria-label"), "Remove Alpha");
  const input = el.querySelector("input");
  type(input, "be"); key(input, "Enter");
  assert.deepEqual(tags(), ["a", "b"]);
  key(input, "Backspace");
  assert.deepEqual(tags(), ["a"]);
  el.querySelector(".hm-chip2-x").click();
  assert.deepEqual(tags(), []);
});
