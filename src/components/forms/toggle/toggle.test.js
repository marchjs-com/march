import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Toggle } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("Toggle: role=switch, aria-checked follows the value, disabled blocks clicks", () => {
  const v = signal(false);
  const { el } = mount(() => mProps(h(Toggle, { "bind:value": v, label: "Wi-Fi" }), { color: "brand-blue" }));
  const sw = el.querySelector("[role=switch]");
  assert.equal(sw.getAttribute("aria-checked"), "false");
  assert.equal(el.querySelector(".m-check-label").textContent, "Wi-Fi");
  sw.click();
  assert.equal(v(), true);
  assert.equal(sw.getAttribute("aria-checked"), "true");
  const off = mount(() => h(Toggle, { value: false, disabled: true }));
  assert.equal(off.el.querySelector("[role=switch]").hasAttribute("disabled"), true);
});

test("Toggle: tristate goes not set → on → off → not set", () => {
  const v = signal(null);
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(Toggle, { tristate: true, value: v, label: "P" }), el);
  const b = el.querySelector("button");
  assert.equal(b.getAttribute("role"), "checkbox");
  assert.equal(b.getAttribute("aria-checked"), "mixed");
  b.click(); assert.equal(v(), true); assert.equal(b.getAttribute("aria-checked"), "true");
  b.click(); assert.equal(v(), false); assert.equal(b.getAttribute("aria-checked"), "false");
  b.click(); assert.equal(v(), null); assert.equal(b.getAttribute("aria-checked"), "mixed");
  dispose();
});
