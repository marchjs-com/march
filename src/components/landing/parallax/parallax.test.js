import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Parallax } = await import("./index.ts");
const { manualClock, step } = await import("../../../motion/engine/clock.ts");

test("Parallax: one Overlay per layer with bleed, content in front, transforms written on a frame", () => {
  manualClock(true);
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(Parallax, { layers: [{ src: "/a.jpg", speed: 0.5 }, { content: h("b", {}, "x"), speed: -0.2 }] }, h("h2", {}, "Hi")), el);
  const layers = el.querySelectorAll(".hm-plx-layer");
  assert.equal(layers.length, 2);
  assert.equal(layers[0].style.getPropertyValue("--hm-ov-top"), "-12%");
  assert.equal(el.querySelector(".hm-plx-content h2").textContent, "Hi");
  step(16);
  assert.match(layers[0].style.getPropertyValue("transform"), /translate3d/);
  dispose();
  manualClock(false);
});
