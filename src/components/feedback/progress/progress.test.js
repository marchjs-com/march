import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Progress } = await import("./index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };
const mountD = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Progress: progressbar values follow the value; the percentage is shown; null is indeterminate", async () => {
  const v = signal(30);
  const el = mount(() => [h(Progress, { value: v, max: 200, label: "Upload", showValue: true }), h(Progress, {})]);
  const [a, b] = el.querySelectorAll(".hm-progress2");
  const bar = a.querySelector("[role=progressbar]");
  assert.equal(bar.getAttribute("aria-valuenow"), "30");
  assert.equal(bar.getAttribute("aria-valuemax"), "200");
  assert.equal(bar.getAttribute("aria-label"), "Upload");
  assert.equal(a.querySelector(".hm-progress2-value").textContent, "15%");
  v.set(100);
  await tick();
  assert.equal(a.querySelector(".hm-progress2-value").textContent, "50%");
  assert.equal(a.querySelector(".hm-progress2-fill").style.getPropertyValue("--hm-progress"), "0.5");
  assert.ok(b.classList.contains("is-indeterminate"));
  assert.equal(b.querySelector("[role=progressbar]").getAttribute("aria-valuenow"), null);
});

test("Progress: own value text and an accessible name without a visible label", () => {
  const m = mountD(() => [h(Progress, { value: 3, max: 8, showValue: (p, v) => `${v} of 8 (${p}%)` }), h(Progress, { value: 40, ariaLabel: "Storage used", class: "mine" })]);
  const [a, b] = m.el.querySelectorAll(".hm-progress2");
  assert.equal(a.querySelector(".hm-progress2-value").textContent, "3 of 8 (38%)");
  assert.equal(b.querySelector("[role=progressbar]").getAttribute("aria-label"), "Storage used");
  assert.equal(b.querySelector(".hm-progress2-head"), null);
  assert.ok(b.classList.contains("mine"));
  m.dispose();
});
