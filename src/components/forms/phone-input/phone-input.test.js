import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { PhoneInput, normalizePhone } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("PhoneInput: digits only, country prefix shown and prepended", () => {
  assert.equal(normalizePhone("0 (532) 111-22-33", "+90"), "+905321112233");
  assert.equal(normalizePhone("0044 20 7946 0000"), "+442079460000");
  const v = signal("");
  const { el } = mount(() => h(PhoneInput, { "bind:value": v, country: "+44" }));
  const input = el.querySelector("input");
  assert.equal(input.getAttribute("type"), "tel");
  assert.equal(el.querySelector(".hm-affix-prefix").textContent, "+44");
  type(input, "07700 900123");
  assert.equal(v(), "+447700900123");
  assert.equal(input.value, "7700900123");
});

test("PhoneInput: class reaches the input without a country, the wrapper with one", () => {
  const a = mount(() => h(PhoneInput, { value: "", class: "mine" }));
  assert.ok(a.el.querySelector("input").className.includes("mine"));
  a.dispose();
  const b = mount(() => h(PhoneInput, { value: "", class: "mine", country: "+90" }));
  assert.ok(b.el.querySelector(".hm-affix").className.includes("mine"));
  assert.ok(!b.el.querySelector("input").className.includes("mine"));
  b.dispose();
});
