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

test("Stepper: vertical is live (the same stepper turns); morph off switches the panel at once", async () => {
  const step = signal(0), vertical = signal(false), morph = signal(false);
  const root = document.createElement("div"); document.body.appendChild(root);
  render(() => h(Stepper, { steps: [{ title: "A" }, { title: "B" }], current: step, onSelect: (i) => step.set(i), vertical, morph, panels: ["one", "two"] }), root);
  const st = root.querySelector(".hm-stepper");
  assert.ok(!st.classList.contains("hm-stepper-v"));
  vertical.set(true);
  assert.equal(root.querySelector(".hm-stepper"), st, "not rebuilt");
  assert.ok(st.classList.contains("hm-stepper-v") && st.querySelector(".hm-steps2").classList.contains("hm-steps2-v"));
  step.set(1);
  const panes = st.querySelectorAll(".hm-stepper-pane");
  assert.equal(panes.length, 1, "morph off: the old panel is gone at once");
  assert.match(panes[0].textContent, /two/);
});
