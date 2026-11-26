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

const loaded = async (el) => { for (let i = 0; i < 40 && !el.querySelector(".m-mask-mirror"); i++) await new Promise((r) => setTimeout(r, 5)); await new Promise((r) => setTimeout(r, 20)); };
const beforeinput = (el, data, inputType = "insertText") => { const e = new Event("beforeinput", { bubbles: true, cancelable: true }); Object.assign(e, { inputType, data }); el.dispatchEvent(e); return e; };

test("PhoneInput: national format per country, value + and digits, prefix shown", async () => {
  assert.equal(normalizePhone("0 (532) 111-22-33", "+90"), "+905321112233");
  assert.equal(normalizePhone("0044 20 7946 0000"), "+442079460000");
  const v = signal("");
  const { el } = mount(() => h(PhoneInput, { "bind:value": v, country: "+44" }));
  await loaded(el);
  const input = el.querySelector("input");
  assert.equal(input.getAttribute("type"), "tel");
  assert.equal(el.querySelector(".m-affix-prefix").textContent, "+44");
  type(input, "07700 900123");
  assert.equal(v(), "+447700900123");
  assert.equal(input.value, "7700 900123");
  v.set("+905321112233");
  const tr = mount(() => h(PhoneInput, { value: "+905321112233", country: "TR" }));
  await loaded(tr.el);
  assert.equal(tr.el.querySelector("input").value, "(532) 111 22 33");
  assert.equal(tr.el.querySelector(".m-affix-prefix").textContent, "+90");
});

test("PhoneInput: international number chooses its country; caret-correct typing", async () => {
  const v = signal(""), states = [];
  const { el } = mount(() => h(PhoneInput, { "bind:value": v, onMaskState: (s) => states.push(s) }));
  await loaded(el);
  const input = el.querySelector("input");
  input.selectionStart = input.selectionEnd = 0;
  input.setSelectionRange = (a, b) => { input.selectionStart = a; input.selectionEnd = b; };
  input.focus();
  for (const d of "905321112233") beforeinput(input, d);
  assert.equal(input.value, "+90 (532) 111 22 33");
  assert.equal(v(), "+905321112233");
  assert.equal(states.at(-1).name, "TR");
  assert.equal(input.selectionStart, input.value.length);
});

test("PhoneInput: class goes on the field wrapper", async () => {
  const b = mount(() => h(PhoneInput, { value: "", class: "mine", country: "+90" }));
  assert.ok(b.el.querySelector(".m-mask").className.includes("mine"));
  assert.ok(!b.el.querySelector("input").className.includes("mine"));
  b.dispose();
});
