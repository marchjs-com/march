import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Stepper } = await import("./index.ts");

test("Stepper: Steps inside, panels follow the current step, Back / Next / Finish", () => {
  const cur = signal(0);
  let finished = 0;
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(Stepper, {
    steps: [{ title: "A" }, { title: "B" }, { title: "C" }], current: cur, onSelect: (i) => cur.set(i),
    panels: ["one", "two", "three"], onFinish: () => finished++,
  }), host);
  assert.equal(host.querySelectorAll(".hm-step2").length, 3);
  assert.equal(host.querySelector('[aria-current="step"] .hm-step2-title').textContent, "A");
  const frame = host.querySelector(".hm-stepper-frame");
  assert.equal(frame.getAttribute("role"), "region");
  assert.equal(frame.textContent, "one");
  const [back, next] = host.querySelectorAll(".hm-stepper-nav button");
  assert.equal(back.disabled, true);
  next.click();
  assert.equal(cur(), 1);
  assert.match(frame.textContent, /two/);
  next.click();
  assert.equal(cur(), 2);
  next.click();
  assert.equal(finished, 1, "the last step's button finishes");
  back.click();
  assert.equal(cur(), 1);
  host.querySelectorAll(".hm-step2-hit")[0].click();
  assert.equal(cur(), 0);
  dispose();
});
