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
  assert.ok(bar.className.includes("hm-sprog-inline") && bar.className.includes("hm-sprog-accent"));
  assert.equal(bar.style.getPropertyValue("--hm-sprog-h"), "6px");
  assert.ok(bar.querySelector(".hm-sprog-fill"));
  dispose();
});
