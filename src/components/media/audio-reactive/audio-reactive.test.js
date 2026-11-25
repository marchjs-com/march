import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { audioSource } = await import("../../../audio/index.ts");
const { AudioReactive, audioVarNames } = await import("./index.ts");

E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const v = (el, name) => el.style.getPropertyValue(name);

test("AudioReactive: writes the five variables on itself per reading, with gain; effects, tag and children", () => {
  const level = signal(0.25);
  const seen = [];
  const [root, dispose] = mount(() => h(AudioReactive, { source: () => level(), as: "span", gain: 2, effect: ["ring", "glow"], color: "brand-blue", onLevel: (l) => seen.push(l), "aria-label": "Ada", class: "mine" }, h("b", null, "A")));
  const el = root.querySelector(".m-ar");
  assert.equal(el.tagName, "SPAN");
  assert.ok(el.classList.contains("m-ar-ring") && el.classList.contains("m-ar-glow") && el.classList.contains("mine"));
  assert.equal(el.getAttribute("data-m-color"), "brand-blue");
  assert.equal(el.getAttribute("aria-label"), "Ada");
  assert.equal(el.querySelector("b").textContent, "A");
  assert.equal(v(el, "--m-level"), "0.000", "starts at 0 before a reading");
  assert.equal(seen.length, 0);
  E.step(16);
  assert.equal(v(el, "--m-level"), "0.500", "0.25 × gain 2");
  assert.equal(v(el, "--m-peak"), "0.500");
  assert.ok(Number(v(el, "--m-bass")) > Number(v(el, "--m-treble")), "the number source is a low tone");
  assert.equal(seen.length, 1);
  assert.equal(seen[0].level, 0.5);
  level.set(0.9); E.step(16);
  assert.equal(v(el, "--m-level"), "1.000", "clamped to 1");
  dispose();
});

test("AudioReactive: vars picks and renames; motion off writes zeros; a shared source feeds several", () => {
  const level = signal(0.6);
  const src = audioSource(() => level(), { smoothing: 0 });
  const [root, dispose] = mount(() => [
    h(AudioReactive, { source: src, vars: { level: "talk", bass: false } }),
    h(AudioReactive, { source: src, vars: ["peak"] }),
    h(AudioReactive, { source: src, motion: false }),
  ]);
  const [a, b, c] = root.querySelectorAll(".m-ar");
  E.step(16);
  assert.equal(v(a, "--talk"), "0.600");
  assert.equal(v(a, "--m-level"), "");
  assert.equal(v(a, "--m-bass"), "");
  assert.notEqual(v(a, "--m-treble"), "");
  assert.equal(v(b, "--m-peak"), "0.600");
  assert.equal(v(b, "--m-level"), "");
  assert.equal(v(c, "--m-level"), "0.000");
  assert.deepEqual(audioVarNames(["level"]), { level: "--m-level", bass: null, mid: null, treble: null, peak: null });
  dispose();
  src.stop();
});

test("AudioReactive: smoothing slows the fall, not the rise", () => {
  const level = signal(1);
  const [root, dispose] = mount(() => h(AudioReactive, { source: audioSource(() => level(), { smoothing: 0 }), smoothing: 0.5, vars: ["level"] }));
  const el = root.querySelector(".m-ar");
  E.step(16); assert.equal(v(el, "--m-level"), "1.000");
  level.set(0); E.step(16); assert.equal(v(el, "--m-level"), "0.500");
  level.set(0.8); E.step(16); assert.equal(v(el, "--m-level"), "0.800");
  dispose();
});
