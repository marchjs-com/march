import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Segmented } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("Segmented: radios with aria-checked, roving tabindex, arrows select", () => {
  const v = signal("b");
  const { el } = mount(() => h(Segmented, { "bind:value": v, options: ["a", "b", "c"], "aria-label": "Pick" }));
  const group = el.querySelector("[role=radiogroup]");
  const btns = () => el.querySelectorAll("[role=radio]");
  assert.equal(group.getAttribute("aria-label"), "Pick");
  assert.deepEqual(btns().map((b) => b.getAttribute("tabindex")), ["-1", "0", "-1"]);
  btns()[1].focus();
  key(group, "ArrowRight");
  assert.equal(v(), "c");
  assert.equal(btns()[2].getAttribute("aria-checked"), "true");
  btns()[0].click();
  assert.equal(v(), "a");
});
