import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { RadioGroup } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("RadioGroup: radiogroup of native radios with one name; change picks the value", () => {
  const v = signal("b");
  const { el } = mount(() => h(RadioGroup, { "bind:value": v, options: ["a", "b", "c"], "aria-label": "Letters" }));
  assert.ok(el.querySelector("[role=radiogroup]"));
  const radios = el.querySelectorAll("input[type=radio]");
  assert.equal(new Set(radios.map((r) => r.getAttribute("name"))).size, 1);
  assert.equal(radios[1].checked, true);
  radios[2].checked = true; fire(radios[2], "change");
  assert.equal(v(), "c");
  const card = mount(() => h(RadioGroup, { value: "x", variant: "card", options: [{ value: "x", label: "X", hint: "hint" }] }));
  assert.ok(card.el.querySelector(".hm-choice-card-title"));
});
