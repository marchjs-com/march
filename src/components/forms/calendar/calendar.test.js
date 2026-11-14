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
  assert.equal(el.querySelector(".m-cal-wd").textContent, "Mon");
  key(grid, "ArrowRight"); assert.equal(focused(), "2026-03-15");
  key(grid, "ArrowDown"); assert.equal(focused(), "2026-03-22");
  key(grid, "Home"); assert.equal(focused(), "2026-03-16");
  key(grid, "PageDown"); assert.equal(focused(), "2026-04-16");
  key(grid, "PageDown"); assert.equal(focused(), "2026-04-20", "clamped to max");
  key(grid, "Enter");
  assert.equal(v(), "2026-04-20");
});

test("Calendar: month buttons, weekday row, labels, icons, day content and color are yours", () => {
  const { el, dispose } = mount(() => h(Calendar, { value: "2026-03-14", labels: { prevMonth: "Back", nextMonth: "Forward" }, prevIcon: "<", nextIcon: () => h("b", {}, ">"), weekdays: false, renderDay: (_iso, d) => `${d}.`, color: "brand-orange" }));
  const [p, n] = el.querySelectorAll(".m-cal-nav");
  assert.equal(p.getAttribute("aria-label"), "Back");
  assert.equal(n.getAttribute("aria-label"), "Forward");
  assert.equal(p.textContent, "<");
  assert.equal(n.querySelector("b").textContent, ">");
  assert.equal(el.querySelector(".m-cal-head"), null);
  assert.equal(el.querySelector('[data-date="2026-03-14"]').textContent, "14.");
  assert.equal(el.querySelector(".m-cal").getAttribute("data-m-color"), "brand-orange");
  dispose();
  const m = mount(() => h(Calendar, { value: "2026-03-14", nav: false }));
  assert.equal(m.el.querySelector(".m-cal-nav"), null);
  assert.ok(m.el.querySelector(".m-cal-head"));
  assert.equal(m.el.querySelector('[data-date="2026-03-14"]').textContent, "14");
  m.dispose();
});

test("dayGridKey: the day a key moves to in a grid of days (shared with other day grids)", async () => {
  const { dayGridKey } = await import("./index.ts");
  const d = "2026-03-11"; // a Wednesday
  assert.equal(dayGridKey({ key: "ArrowLeft" }, d, 1), "2026-03-10");
  assert.equal(dayGridKey({ key: "ArrowLeft" }, d, 1, -1), "2026-03-12", "right-to-left columns");
  assert.equal(dayGridKey({ key: "ArrowDown" }, d, 1), "2026-03-18");
  assert.equal(dayGridKey({ key: "Home" }, d, 1), "2026-03-09");
  assert.equal(dayGridKey({ key: "End" }, d, 1), "2026-03-15");
  assert.equal(dayGridKey({ key: "End" }, d, 0), "2026-03-14", "week starting on Sunday");
  assert.equal(dayGridKey({ key: "PageDown" }, d, 1), "2026-04-11");
  assert.equal(dayGridKey({ key: "PageUp", shiftKey: true }, d, 1), "2025-03-11");
  assert.equal(dayGridKey({ key: "Enter" }, d, 1), null);
});

test("Calendar: the month buttons are IconButtons with their names", () => {
  const { el, dispose } = mount(() => h(Calendar, { value: "2026-03-14", labels: { prevMonth: "Back" } }));
  const [prev, next] = el.querySelectorAll(".m-cal-nav.m-icon-btn");
  assert.equal(prev.getAttribute("aria-label"), "Back");
  assert.ok(next.classList.contains("m-cal-next"));
  next.click();
  assert.match(el.querySelector(".m-cal-title").textContent, /2026/);
  dispose();
});
