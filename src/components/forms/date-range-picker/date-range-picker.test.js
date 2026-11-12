import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { DateRangePicker, rangePresets } = await import("./index.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const fire = (el, type, init = {}) => { const e = new Event(type, { bubbles: true, cancelable: true, ...init }); for (const k of ["dataTransfer", "clipboardData"]) if (k in init) e[k] = init[k]; el.dispatchEvent(e); return e; };
const type = (el, v) => { el.value = v; fire(el, "input"); };
const key = (el, k, more = {}) => fire(el, "keydown", { key: k, ...more });
void tick; void type; void key; void signal;

test("DateRangePicker: presets set the range; Custom shows the from / to pair", () => {
  const p = rangePresets("2026-03-14");
  assert.deepEqual(p.find((x) => x.id === "7d").range, { from: "2026-03-08", to: "2026-03-14" });
  const v = signal(null);
  const { el } = mount(() => h(DateRangePicker, { "bind:value": v, today: "2026-03-14" }));
  assert.ok(el.querySelector("[role=group]"));
  const btn = (label) => el.querySelectorAll("[role=radio]").find((b) => b.textContent === label);
  btn("Last 30 days").click();
  assert.deepEqual(v(), { from: "2026-02-13", to: "2026-03-14" });
  assert.equal(el.querySelectorAll(".hm-date-input").length, 0);
  btn("Custom").click();
  assert.equal(el.querySelectorAll(".hm-date-input").length, 2);
  const none = mount(() => h(DateRangePicker, { value: null, presets: false }));
  assert.equal(none.el.querySelectorAll("[role=radio]").length, 0);
  assert.equal(none.el.querySelectorAll(".hm-date-input").length, 2);
});
