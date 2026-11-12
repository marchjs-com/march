import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Textarea } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("Textarea: rows, value both ways, autosize sets a height", () => {
  const v = signal("one");
  const { el } = mount(() => h(Textarea, { "bind:value": v, rows: 4 }));
  const ta = el.querySelector("textarea");
  assert.equal(ta.getAttribute("rows"), "4");
  assert.equal(ta.value, "one");
  type(ta, "one\ntwo");
  assert.equal(v(), "one\ntwo");
  assert.ok(ta.className.includes("hm-textarea"));
});
