import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { TimeInput } = await import("./index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void tick; void type; void key; void signal;

test("TimeInput: typed time on the mask with min / max / step and a two-way value", () => {
  const v = signal("09:30");
  const { el } = mount(() => h(TimeInput, { "bind:value": v, min: "09:00", max: "18:00", step: 60 }));
  const input = el.querySelector("input");
  assert.equal(input.getAttribute("inputmode"), "numeric");
  assert.equal(input.value, "09:30");
  input.focus();
  type(input, "10:15");
  assert.equal(v(), "10:15");
  assert.equal(input.getAttribute("min"), "09:00");
  // out of min / max: written and marked, as on a native time field
  type(input, "19:00");
  assert.equal(input.getAttribute("aria-invalid"), "true");
  assert.equal(v(), "19:00");
  // half-typed: put back when the field is left
  type(input, "1");
  input.blur();
  assert.equal(input.value, "19:00");
  // typing digit by digit: the colon comes by itself, a single 7 becomes 07, hour 25 is refused
  const t = signal("");
  const m2 = mount(() => h(TimeInput, { "bind:value": t }));
  const i2 = m2.el.querySelector("input");
  i2.focus(); i2.selectionStart = i2.selectionEnd = 0;
  i2.setSelectionRange = (a, b) => { i2.selectionStart = a; i2.selectionEnd = b; };
  const press = (d) => { const e = new Event("beforeinput", { bubbles: true, cancelable: true }); Object.assign(e, { inputType: "insertText", data: d }); i2.dispatchEvent(e); };
  press("7"); assert.equal(i2.value, "07");
  press("3"); press("0"); assert.equal(i2.value, "07:30");
  assert.equal(t(), "07:30");
  const s = mount(() => h(TimeInput, { value: "09:30:15", step: 1 }));
  assert.equal(s.el.querySelector("input").value, "09:30:15");
});

test("TimeInput picker=clock: the button opens the dial; the keyboard picks the hour, then the minutes, then closes", async () => {
  const v = signal("09:30");
  const { el, dispose } = mount(() => h(TimeInput, { "bind:value": v, picker: "clock", hour12: false, labels: { choose: "Pick" } }));
  const btn = el.querySelector(".m-time-btn");
  assert.equal(btn.getAttribute("aria-label"), "Pick");
  assert.equal(btn.getAttribute("aria-expanded"), "false");
  btn.dispatchEvent(new Event("click", { bubbles: true }));
  await tick();
  const face = document.querySelector(".m-clock-face");
  assert.ok(face, "the dial is open");
  assert.equal(face.getAttribute("role"), "slider");
  assert.equal(face.getAttribute("aria-valuenow"), "9");
  assert.equal(document.querySelectorAll(".m-clock-num.is-inner").length, 12, "24 hours: an inner ring");
  key(face, "ArrowUp");
  assert.equal(v(), "10:30");
  key(face, "Enter");
  assert.equal(face.getAttribute("aria-valuemax"), "59", "the face turned to the minutes");
  key(face, "PageDown");
  assert.equal(v(), "10:25");
  key(face, "Enter");
  await tick();
  assert.equal(document.querySelector(".m-clock-face"), null, "the minute closed it");
  dispose();
});

test("TimeInput picker=clock: a 12-hour dial has AM / PM; min / max dim the hours outside", async () => {
  const v = signal("08:15");
  const { el, dispose } = mount(() => h(TimeInput, { "bind:value": v, picker: "clock", hour12: true, locale: "en-US", min: "09:00", max: "17:00" }));
  el.querySelector(".m-time-btn").dispatchEvent(new Event("click", { bubbles: true }));
  await tick();
  assert.equal(document.querySelectorAll(".m-clock-num.is-inner").length, 0);
  const periods = [...document.querySelectorAll(".m-clock-period")];
  assert.deepEqual(periods.map((p) => p.textContent), ["AM", "PM"]);
  assert.equal(periods[0].getAttribute("aria-pressed"), "true");
  const eight = [...document.querySelectorAll(".m-clock-num")].find((n) => n.textContent === "8");
  assert.ok(eight.classList.contains("is-off"), "8 AM is before min");
  periods[1].dispatchEvent(new Event("click", { bubbles: true }));
  assert.equal(v(), "08:15", "8 PM is after max: unchanged");
  dispose();
});
