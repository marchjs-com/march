import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { ResizeHandle } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const key = (el, k, shiftKey = false) => { const e = new Event("keydown", { bubbles: true, cancelable: true }); Object.assign(e, { key: k, shiftKey }); el.dispatchEvent(e); return e; };
const ptr = (type, x, y) => { const e = new Event(type, { bubbles: true, cancelable: true }); Object.assign(e, { clientX: x, clientY: y, pointerId: 1, pointerType: "mouse", button: 0 }); return e; };

test("ResizeHandle: with value + set it is the full separator (ARIA, arrows, Home / End, Enter resets, drag)", () => {
  const w = signal(200), log = [];
  const m = mount(() => h(ResizeHandle, { value: w, set: (v, done) => { w.set(v); log.push(done); }, min: 100, max: 400, reset: () => w.set(250), label: "Sidebar width" }));
  const el = m.el.querySelector("span.m-resize-handle.m-resize-handle-end.m-resize-handle-line-hover");
  assert.equal(el.getAttribute("role"), "separator");
  assert.equal(el.getAttribute("aria-orientation"), "vertical");
  assert.equal(el.getAttribute("aria-label"), "Sidebar width");
  assert.equal(el.getAttribute("aria-valuenow"), "200");
  assert.equal(el.getAttribute("aria-valuemin"), "100");
  assert.equal(el.getAttribute("tabindex"), "0");
  assert.equal(el.getAttribute("aria-hidden"), null);
  key(el, "ArrowRight");
  assert.equal(w(), 216);
  key(el, "ArrowLeft", true);
  assert.equal(w(), 152);
  key(el, "End");
  assert.equal(w(), 400);
  key(el, "Enter");
  assert.equal(w(), 250);
  el.dispatchEvent(ptr("pointerdown", 100, 0));
  document.dispatchEvent(ptr("pointermove", 130, 0));
  assert.equal(w(), 280);
  document.dispatchEvent(ptr("pointerup", 130, 0));
  assert.equal(log.at(-1), true, "the gesture ends with done");
  m.dispose();
});

test("ResizeHandle: start / top edges grow backwards; block axis; between", () => {
  const a = signal(200), b = signal(100);
  const m = mount(() => [
    h(ResizeHandle, { edge: "start", value: a, set: (v) => a.set(v) }),
    h(ResizeHandle, { edge: "bottom", value: b, set: (v) => b.set(v), step: 10 }),
    h(ResizeHandle, { edge: "between", axis: "block", value: b, set: (v) => b.set(v) }),
  ]);
  const [s, bt, bw] = m.el.querySelectorAll(".m-resize-handle");
  key(s, "ArrowRight");
  assert.equal(a(), 184, "a panel on the start edge shrinks when the handle moves to the end");
  assert.equal(bt.getAttribute("aria-orientation"), "horizontal");
  assert.ok(bt.classList.contains("m-resize-handle-block"));
  key(bt, "ArrowDown");
  assert.equal(b(), 110);
  assert.ok(bw.classList.contains("m-resize-handle-between") && bw.classList.contains("m-resize-handle-block"));
  m.dispose();
});

test("ResizeHandle: bare grip (no value) is decorative and passes pointer events; onStep gives it arrow keys", () => {
  let downs = 0; const steps = [];
  const m = mount(() => [
    h(ResizeHandle, { edge: "end", onPointerDown: () => downs++, "data-handle": "end" }),
    h(ResizeHandle, { edge: "bottom-end", onStep: (dx, dy) => steps.push([dx, dy]), label: "Resize window" }),
    h(ResizeHandle, { edge: "top", onStep: (dx, dy) => steps.push([dx, dy]), step: 8 }),
  ]);
  const [bare, corner, top] = m.el.querySelectorAll(".m-resize-handle");
  assert.equal(bare.getAttribute("aria-hidden"), "true");
  assert.equal(bare.getAttribute("role"), null);
  assert.equal(bare.getAttribute("tabindex"), null);
  assert.equal(bare.getAttribute("data-handle"), "end");
  bare.dispatchEvent(ptr("pointerdown", 0, 0));
  assert.equal(downs, 1);
  assert.ok(corner.classList.contains("m-resize-handle-corner") && corner.classList.contains("m-resize-handle-bottom-end"));
  assert.equal(corner.getAttribute("aria-label"), "Resize window");
  assert.equal(corner.getAttribute("tabindex"), "0");
  key(corner, "ArrowRight"); key(corner, "ArrowDown", true);
  assert.equal(top.getAttribute("role"), "separator");
  key(top, "ArrowLeft"); key(top, "ArrowUp");
  assert.deepEqual(steps, [[16, 0], [0, 64], [0, -8]], "an edge only steps along its axis");
  m.dispose();
});

test("ResizeHandle: line, grip (default and own), color, disabled, class, ref", () => {
  const off = signal(false);
  let got = null;
  const m = mount(() => [
    mProps(h(ResizeHandle, { value: () => 1, set: () => {}, line: "always", grip: true, disabled: off, class: "mine", ref: (el) => { got = el; } }), { color: "brand-orange" }),
    h(ResizeHandle, { line: "none", grip: h("i", { class: "dots" }) }),
  ]);
  const [a, b] = m.el.querySelectorAll(".m-resize-handle");
  assert.equal(got, a);
  assert.ok(a.classList.contains("m-resize-handle-line-always") && a.classList.contains("mine"));
  assert.equal(a.getAttribute("data-m-color"), "brand-orange");
  assert.ok(a.querySelector(".m-resize-handle-grip") && !a.querySelector(".m-resize-handle-grip.is-own"));
  off.set(true);
  assert.ok(a.classList.contains("is-disabled"));
  assert.equal(a.getAttribute("tabindex"), "-1");
  assert.ok(b.classList.contains("m-resize-handle-line-none"));
  assert.ok(b.querySelector(".m-resize-handle-grip.is-own .dots"));
  m.dispose();
});
