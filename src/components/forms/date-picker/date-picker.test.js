import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { DatePicker, parseDate, formatDate } = await import("./index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void tick; void type; void key; void signal;

test("DatePicker: locale typing, invalid dates, calendar popover picks and closes", async () => {
  assert.equal(parseDate("3/14/26", "en-US"), "2026-03-14");
  assert.equal(parseDate("31.02.2026", "de"), undefined);
  assert.equal(formatDate("2026-03-14", "de"), "14.03.2026");
  const v = signal(null);
  const { el } = mount(() => h(DatePicker, { "bind:value": v, locale: "de", firstDay: 1 }));
  const input = el.querySelector("input");
  assert.equal(input.getAttribute("placeholder"), "DD.MM.YYYY");
  input.focus(); type(input, "14.3.2026");
  assert.equal(v(), "2026-03-14");
  type(input, "31.02.2026");
  assert.equal(input.getAttribute("aria-invalid"), "true");
  input.blur();
  assert.equal(input.value, "14.03.2026");
  const btn = el.querySelector("button");
  assert.equal(btn.getAttribute("aria-haspopup"), "dialog");
  btn.click();
  await tick(5);
  assert.equal(btn.getAttribute("aria-expanded"), "true");
  document.querySelector(`.m-cal-pop [data-date="2026-03-20"]`).click();
  assert.equal(v(), "2026-03-20");
  assert.equal(document.querySelector(".m-cal-pop"), null);
});

test("DatePicker: the calendar button can go or be redrawn; names and the calendar are yours", async () => {
  const off = mount(() => h(DatePicker, { value: "2026-03-14", icon: false }));
  assert.equal(off.el.querySelector("button"), null);
  key(off.el.querySelector("input"), "ArrowDown", { altKey: true });
  await tick(5);
  assert.ok(document.querySelector(".m-cal-pop"));
  off.dispose();
  const own = mount(() => h(DatePicker, { value: "2026-03-14", icon: () => h("b", { class: "own-cal" }, "D"), labels: { choose: "Pick a day", prevMonth: "Back" }, calendar: { renderDay: (_iso, d) => `${d}!`, weekdays: false } }));
  const btn = own.el.querySelector("button");
  assert.equal(btn.getAttribute("aria-label"), "Pick a day");
  assert.ok(btn.querySelector(".own-cal"));
  assert.equal(btn.querySelector("svg"), null);
  btn.click();
  await tick(5);
  const pop = document.querySelector(".m-cal-pop");
  assert.equal(pop.getAttribute("aria-label"), "Pick a day");
  assert.equal(pop.querySelector(".m-cal-nav").getAttribute("aria-label"), "Back");
  assert.equal(pop.querySelector('[data-date="2026-03-14"]').textContent, "14!");
  assert.equal(pop.querySelector(".m-cal-head"), null);
  own.dispose();
});
