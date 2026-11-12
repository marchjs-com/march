import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const { Steps } = await import("./index.ts");

test("Steps: done / current / upcoming, aria-current, buttons with onSelect", () => {
  const cur = signal(1);
  const { host, dispose } = mount(() => h(Steps, { steps: [{ title: "A" }, { title: "B", description: "b" }, { title: "C" }], current: cur, onSelect: (i) => cur.set(i) }));
  const items = host.querySelectorAll(".hm-step2");
  assert.equal(items.length, 3);
  assert.match(items[0].getAttribute("class"), /is-done/);
  assert.match(items[2].getAttribute("class"), /is-todo/);
  assert.equal(host.querySelector('[aria-current="step"] .hm-step2-title').textContent, "B");
  host.querySelectorAll("button.hm-step2-hit")[2].click();
  assert.equal(cur(), 2);
  assert.equal(host.querySelector('[aria-current="step"] .hm-step2-title').textContent, "C");
  dispose();
});

test("Steps: without onSelect the steps are not buttons", () => {
  const { host, dispose } = mount(() => h(Steps, { steps: [{ title: "A" }, { title: "B" }], current: 0, vertical: true }));
  assert.equal(host.querySelectorAll("button").length, 0);
  assert.match(host.querySelector("ol").getAttribute("class"), /hm-steps2-v/);
  dispose();
});
