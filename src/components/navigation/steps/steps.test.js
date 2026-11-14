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
  const items = host.querySelectorAll(".m-step2");
  assert.equal(items.length, 3);
  assert.match(items[0].getAttribute("class"), /is-done/);
  assert.match(items[2].getAttribute("class"), /is-todo/);
  assert.equal(host.querySelector('[aria-current="step"] .m-step2-title').textContent, "B");
  host.querySelectorAll("button.m-step2-hit")[2].click();
  assert.equal(cur(), 2);
  assert.equal(host.querySelector('[aria-current="step"] .m-step2-title').textContent, "C");
  dispose();
});

test("Steps: without onSelect the steps are not buttons", () => {
  const { host, dispose } = mount(() => h(Steps, { steps: [{ title: "A" }, { title: "B" }], current: 0, vertical: true }));
  assert.equal(host.querySelectorAll("button").length, 0);
  assert.match(host.querySelector("ol").getAttribute("class"), /m-steps2-v/);
  dispose();
});

test("Steps: doneIcon off / own, renderDot, connector off", () => {
  const { host, dispose } = mount(() => [
    h(Steps, { steps: [{ title: "A" }, { title: "B" }], current: 1, doneIcon: false, connector: false }),
    h(Steps, { steps: [{ title: "A" }, { title: "B" }], current: 1, doneIcon: "★" }),
    h(Steps, { steps: [{ title: "A" }, { title: "B" }], current: 1, renderDot: (i, state) => `${state}-${i}` }),
  ]);
  const [off, own, fn] = host.querySelectorAll("ol");
  assert.equal(off.querySelector(".m-step2-dot").textContent, "1", "the number stays");
  assert.match(off.getAttribute("class"), /m-steps2-bare/);
  assert.equal(own.querySelector(".m-step2-dot").textContent, "★");
  assert.doesNotMatch(own.getAttribute("class"), /m-steps2-bare/);
  assert.deepEqual([...fn.querySelectorAll(".m-step2-dot")].map((d) => d.textContent), ["done-0", "current-1"]);
  dispose();
});
