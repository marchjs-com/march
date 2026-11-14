import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { StoryProgress } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("StoryProgress: segments, done / current classes, progressbar values", () => {
  const i = signal(1), n = signal(4);
  const m = mount(() => h(StoryProgress, { count: n, index: i, duration: 50 }));
  const root = m.el.querySelector(".m-story-progress");
  assert.ok(root.classList.contains("m-progress2-line") && !root.classList.contains("m-sprog"), "a line Progress; no class shared with ScrollProgress");
  const bar = root.querySelector("[role=progressbar]");
  assert.equal(bar.getAttribute("aria-valuenow"), "1");
  assert.equal(bar.getAttribute("aria-valuemax"), "4");
  assert.equal(bar.getAttribute("aria-valuetext"), "Story 2 of 4");
  const segs = bar.querySelectorAll(".m-progress2-seg");
  assert.equal(segs.length, 4);
  assert.ok(segs[0].classList.contains("is-done") && segs[1].classList.contains("is-now") && !segs[2].classList.contains("is-done"));
  n.set(2);
  assert.equal(bar.querySelectorAll(".m-progress2-seg").length, 2);
  m.dispose();
});

test("StoryProgress: own screen-reader text, fill color", () => {
  const color = signal(undefined);
  const m = mount(() => h(StoryProgress, { count: 3, index: 1, duration: 50, color, label: (i, n) => `Slide ${i + 1}/${n}`, class: "mine" }));
  const root = m.el.querySelector(".m-story-progress");
  assert.ok(root.classList.contains("mine"));
  assert.equal(root.querySelector("[role=progressbar]").getAttribute("aria-valuetext"), "Slide 2/3");
  assert.equal(root.getAttribute("data-m-color"), null);
  color.set("brand-orange");
  assert.equal(root.getAttribute("data-m-color"), "brand-orange");
  m.dispose();
});
