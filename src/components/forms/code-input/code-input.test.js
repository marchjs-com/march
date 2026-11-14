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

test("CodeInput: the separator can go or be replaced; box names and the pop are yours", () => {
  const off = mount(() => h(CodeInput, { length: 6, groups: [3, 3], separator: false }));
  assert.equal(off.el.querySelector(".hm-otp-sep"), null);
  assert.equal(off.el.querySelector(".hm-otp-sep-own"), null);
  assert.equal(off.el.querySelectorAll("input").length, 6);
  off.dispose();
  const popped = [];
  const own = mount(() => h(CodeInput, { length: 4, groups: [2, 2], separator: "/", boxLabel: (i, n) => `Digit ${i}/${n}`, animate: (box) => popped.push(box) }));
  assert.equal(own.el.querySelector(".hm-otp-sep"), null);
  assert.equal(own.el.querySelector(".hm-otp-sep-own").textContent, "/");
  const first = own.el.querySelector("input");
  assert.equal(first.getAttribute("aria-label"), "Digit 1/4");
  type(first, "7");
  assert.ok(popped.length <= 1); // none with reduced motion, one otherwise
  if (popped.length) assert.equal(popped[0], first);
  own.dispose();
  const def = mount(() => h(CodeInput, { length: 4, groups: [2, 2] }));
  assert.ok(def.el.querySelector(".hm-otp-sep"));
  assert.equal(def.el.querySelector("input").getAttribute("aria-label"), "Character 1 of 4");
  def.dispose();
});
