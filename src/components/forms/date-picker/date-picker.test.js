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
  document.querySelector(`.hm-cal-pop [data-date="2026-03-20"]`).click();
  assert.equal(v(), "2026-03-20");
  assert.equal(document.querySelector(".hm-cal-pop"), null);
});
