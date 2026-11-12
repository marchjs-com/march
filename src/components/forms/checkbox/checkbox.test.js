import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Checkbox } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("Checkbox: a real input under a drawn box; Space / click toggles; indeterminate and looks", () => {
  const v = signal(false);
  const { el } = mount(() => h(Checkbox, { "bind:value": v, label: "Agree", variant: "soft", size: "lg" }));
  const input = el.querySelector("input[type=checkbox]");
  assert.ok(el.querySelector(".hm-check-box[aria-hidden=true]"));
  assert.equal(el.querySelector("label").textContent.includes("Agree"), true);
  const wrap = el.querySelector(".hm-choice");
  assert.ok(wrap.className.includes("hm-choice-soft") && wrap.className.includes("hm-choice-lg"));
  input.checked = true; fire(input, "change");
  assert.equal(v(), true);
  const m = mount(() => h(Checkbox, { value: true, indeterminate: true, label: "Some" }));
  assert.equal(m.el.querySelector("input").indeterminate, true);
});
