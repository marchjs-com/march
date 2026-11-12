import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Calendar } = await import("./index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void tick; void type; void key; void signal;

test("Calendar: grid keyboard, min / max clamping, aria states", () => {
  const v = signal("2026-03-14");
  const { el } = mount(() => h(Calendar, { "bind:value": v, min: "2026-03-10", max: "2026-04-20", firstDay: 1, locale: "en" }));
  const grid = el.querySelector("[role=grid]");
  const focused = () => el.querySelector(`[tabindex="0"][data-date]`).getAttribute("data-date");
  assert.equal(focused(), "2026-03-14");
  assert.equal(el.querySelector(`[data-date="2026-03-09"]`).getAttribute("aria-disabled"), "true");
  assert.equal(el.querySelector(`[data-date="2026-03-14"]`).getAttribute("aria-selected"), "true");
  assert.equal(el.querySelector(".hm-cal-wd").textContent, "Mon");
  key(grid, "ArrowRight"); assert.equal(focused(), "2026-03-15");
  key(grid, "ArrowDown"); assert.equal(focused(), "2026-03-22");
  key(grid, "Home"); assert.equal(focused(), "2026-03-16");
  key(grid, "PageDown"); assert.equal(focused(), "2026-04-16");
  key(grid, "PageDown"); assert.equal(focused(), "2026-04-20", "clamped to max");
  key(grid, "Enter");
  assert.equal(v(), "2026-04-20");
});
