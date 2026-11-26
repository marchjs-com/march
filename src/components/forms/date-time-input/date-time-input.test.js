import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { DateTimeInput } = await import("./index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void tick; void type; void key; void signal;

test("DateTimeInput: a DatePicker and a TimeInput write one ISO timestamp", () => {
  const v = signal(null);
  const { el } = mount(() => h(DateTimeInput, { "bind:value": v, defaultTime: "09:00" }));
  const [date, time] = el.querySelectorAll("input");
  assert.ok(date.className.includes("m-date-input"));
  assert.equal(time.getAttribute("inputmode"), "numeric");
  assert.equal(time.getAttribute("aria-label"), "Time");
  date.focus(); type(date, "2026-03-14");
  const d = new Date(v());
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getHours(), 9, "defaultTime used");
  type(time, "17:45");
  assert.equal(new Date(v()).getMinutes(), 45);
});

test("DateTimeInput: the time field's name and the date picker are yours", () => {
  const { el, dispose } = mount(() => h(DateTimeInput, { value: null, timeLabel: "Hour", picker: { icon: false, placeholder: "day" } }));
  const [date, time] = el.querySelectorAll("input");
  assert.equal(time.getAttribute("aria-label"), "Hour");
  assert.equal(date.getAttribute("placeholder"), "day");
  assert.equal(el.querySelector("button"), null);
  dispose();
});
