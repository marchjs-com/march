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

test("Textarea: mono, tabIndent (Tab indents, Shift+Tab and Escape-then-Tab leave), onKeyDown", () => {
  const v = signal("ab"), keys = [];
  const { el } = mount(() => [h(Textarea, { "bind:value": v, mono: true, tabIndent: true, onKeyDown: (e) => keys.push(e.key) }), h(Textarea, { value: "x" }), h(Textarea, { value: "x", tabIndent: 4 })]);
  const [ta, plain, four] = el.querySelectorAll("textarea");
  assert.ok(ta.className.includes("hm-mono"));
  assert.equal(plain.className.includes("hm-mono"), false);
  ta.selectionStart = ta.selectionEnd = 1;
  const e = key(ta, "Tab");
  assert.equal(e.defaultPrevented, true);
  assert.equal(v(), "a  b");
  assert.equal(ta.selectionStart, 3);
  assert.equal(key(ta, "Tab", { shiftKey: true }).defaultPrevented, false, "Shift+Tab leaves");
  key(ta, "Escape");
  assert.equal(key(ta, "Tab").defaultPrevented, false, "Escape, then Tab, leaves");
  assert.equal(v(), "a  b");
  assert.deepEqual(keys, ["Tab", "Tab", "Escape", "Tab"]);
  assert.equal(key(plain, "Tab").defaultPrevented, false, "no tabIndent: Tab moves on");
  four.selectionStart = four.selectionEnd = 0;
  key(four, "Tab");
  assert.equal(four.value, "    x");
});
