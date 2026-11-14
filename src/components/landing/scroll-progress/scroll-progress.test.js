import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { ScrollProgress } = await import("./index.ts");

test("ScrollProgress: a named progressbar with a fill, classes by position and paint", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(ScrollProgress, { position: "inline", paint: "accent", size: 6 }), el);
  const bar = el.querySelector('[role="progressbar"]');
  assert.equal(bar.getAttribute("aria-label"), "Reading progress");
  assert.equal(bar.getAttribute("aria-valuemax"), "100");
  const root = el.querySelector(".hm-scroll-progress");
  assert.ok(root.className.includes("hm-scroll-progress-inline") && root.className.includes("hm-scroll-progress-accent") && root.className.includes("hm-progress2-line"));
  assert.equal(root.style.getPropertyValue("--hm-progress-h"), "6px");
  assert.ok(bar.querySelector(".hm-progress2-fill"));
  dispose();
});

test("ScrollProgress: own colour and own name", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(ScrollProgress, { position: "inline", color: "brand-orange", label: "Read so far", class: "mine" }), el);
  const bar = el.querySelector('[role="progressbar"]');
  const root = el.querySelector(".hm-scroll-progress");
  assert.equal(root.getAttribute("data-hm-color"), "brand-orange");
  assert.equal(bar.getAttribute("aria-label"), "Read so far");
  assert.ok(root.classList.contains("mine"));
  dispose();
});
