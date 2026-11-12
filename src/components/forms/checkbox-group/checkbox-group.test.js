import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { CheckboxGroup } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("CheckboxGroup: role=group, array value, per-option brand colors", () => {
  const v = signal(["a"]);
  const { el } = mount(() => h(CheckboxGroup, { "bind:value": v, colors: "brand", inline: true, variant: "chip", options: [{ value: "a", label: "A" }, { value: "b", label: "B" }, { value: "c", label: "C", disabled: true }] }));
  const group = el.querySelector("[role=group]");
  assert.ok(group.className.includes("hm-choices-inline"));
  const boxes = el.querySelectorAll("input[type=checkbox]");
  assert.equal(boxes[0].checked, true);
  assert.equal(boxes[2].hasAttribute("disabled"), true);
  boxes[1].checked = true; fire(boxes[1], "change");
  assert.deepEqual(v(), ["a", "b"]);
  boxes[0].checked = false; fire(boxes[0], "change");
  assert.deepEqual(v(), ["b"]);
  assert.equal(el.querySelectorAll("label.hm-check")[1].getAttribute("data-hm-color"), "brand-blue");
});
