import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { NumberInput, IntInput, MoneyInput, PercentInput, currencyInfo } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("NumberInput: decimal comma and point, never NaN, arrow steps clamp", () => {
  const v = signal(null);
  const { el } = mount(() => h(NumberInput, { "bind:value": v, locale: "de" }));
  const input = el.querySelector("input");
  input.focus();
  type(input, "12,5"); assert.equal(v(), 12.5);
  // text that makes no number is refused: the field keeps its value
  type(input, "abc"); assert.equal(v(), 12.5);
  assert.equal(input.value, "12,5");
  input.blur();
  assert.equal(input.value, "12,5");
  // a typed character past max is refused while typing (march/mask number kind)
  const big = signal(null);
  const mb = mount(() => h(NumberInput, { "bind:value": big, max: 100, locale: "en", grouping: true }));
  const bi = mb.el.querySelector("input");
  bi.focus();
  bi.selectionStart = bi.selectionEnd = 0;
  bi.setSelectionRange = (a, b) => { bi.selectionStart = a; bi.selectionEnd = b; };
  for (const d of "1000") { const e = new Event("beforeinput", { bubbles: true, cancelable: true }); Object.assign(e, { inputType: "insertText", data: d }); bi.dispatchEvent(e); }
  assert.equal(big(), 100);
  assert.equal(bi.value, "100");
  const n = signal(5);
  const m2 = mount(() => h(NumberInput, { "bind:value": n, min: 0, max: 6, locale: "en" }));
  const i2 = m2.el.querySelector("input");
  key(i2, "ArrowUp"); key(i2, "ArrowUp");
  assert.equal(n(), 6);
});

test("IntInput rounds; MoneyInput symbol side and decimals; PercentInput stores a fraction", () => {
  const i = signal(null);
  const a = mount(() => h(IntInput, { "bind:value": i, locale: "en" }));
  const ai = a.el.querySelector("input");
  ai.focus(); type(ai, "3.6"); ai.blur();
  assert.equal(i(), 4);
  const usd = mount(() => h(MoneyInput, { value: 3, currency: "USD", locale: "en" }));
  assert.equal(usd.el.querySelector(".m-affix-prefix").textContent, "$");
  assert.equal(usd.el.querySelector("input").value, "3.00");
  assert.equal(currencyInfo("de", "EUR").prefix, false);
  assert.equal(currencyInfo("en", "JPY").digits, 0);
  const p = signal(0.125);
  const pm = mount(() => h(PercentInput, { "bind:value": p, locale: "en" }));
  assert.equal(pm.el.querySelector("input").value, "12.5");
  assert.equal(pm.el.querySelector(".m-affix-suffix").textContent, "%");
});

test("NumberInput: class reaches the input without a prefix / suffix, the wrapper with one", () => {
  const a = mount(() => h(NumberInput, { value: 1, class: "mine" }));
  assert.ok(a.el.querySelector("input").className.includes("mine"));
  a.dispose();
  const b = mount(() => h(NumberInput, { value: 1, class: "mine", suffix: "kg" }));
  assert.ok(b.el.querySelector(".m-affix").className.includes("mine"));
  assert.ok(!b.el.querySelector("input").className.includes("mine"));
  b.dispose();
});
