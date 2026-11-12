import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Progress } = await import("./index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };

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
