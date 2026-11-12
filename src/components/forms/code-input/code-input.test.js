import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { CodeInput } = await import("./index.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void type; void key; void signal;

test("CodeInput: typing advances, paste fills, Backspace goes back, onComplete once", () => {
  const v = signal("");
  const done = [];
  const { el } = mount(() => h(CodeInput, { "bind:value": v, length: 4, groups: [2, 2], onComplete: (c) => done.push(c) }));
  const boxes = el.querySelectorAll("input");
  assert.equal(el.querySelector("[role=group]").getAttribute("dir"), "ltr");
  assert.equal(el.querySelectorAll(".hm-otp-sep").length, 1);
  assert.equal(boxes[0].getAttribute("autocomplete"), "one-time-code");
  assert.equal(boxes[1].getAttribute("aria-label"), "Character 2 of 4");
  boxes[0].focus(); type(boxes[0], "7");
  assert.equal(document.activeElement, boxes[1]);
  fire(boxes[1], "paste", { clipboardData: { getData: () => " 12-34 " } });
  assert.equal(v(), "1234");
  assert.deepEqual(done, ["1234"]);
  boxes[3].focus(); type(boxes[3], "");
  key(boxes[3], "Backspace");
  assert.equal(v(), "12");
  assert.equal(document.activeElement, boxes[2]);
});

test("CodeInput: mask turns boxes into password fields", () => {
  const { el } = mount(() => h(CodeInput, { length: 4, mask: true }));
  assert.ok(el.querySelectorAll(".hm-otp-box").every((b) => b.getAttribute("type") === "password"));
});
