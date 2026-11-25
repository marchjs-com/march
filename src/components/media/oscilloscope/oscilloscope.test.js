import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { Oscilloscope } = await import("./index.ts");
const { audioSource } = await import("../../../audio/index.ts");
const { triggerIndex, periodOf, isMono } = await import("./trace.ts");
const { messages } = await import("../../../core/i18n.ts");
messages("tr", (await import("../../../i18n/tr.ts")).default); // the Turkish pack, as an app loads it

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("Oscilloscope: no source is a quiet screen: an image named 'no signal', the graticule, the idle text, a height", () => {
  const [el, dispose] = mount(() => h(Oscilloscope, { height: 120, grid: { x: 8, y: 6 } }));
  const osc = el.querySelector(".m-osc");
  assert.equal(osc.getAttribute("role"), "img");
  assert.equal(osc.getAttribute("aria-label"), "Oscilloscope: No signal");
  assert.ok(osc.classList.contains("is-idle") && osc.classList.contains("m-osc-modern"));
  assert.ok(osc.querySelector(".m-osc-grid") && osc.querySelector("canvas.m-osc-canvas"));
  assert.equal(osc.querySelector(".m-osc-idle").textContent, "No signal");
  assert.equal(osc.style.getPropertyValue("--m-osc-h"), "120px");
  assert.equal(osc.style.getPropertyValue("--m-osc-gx"), "8");
  dispose();
});

test("Oscilloscope: parts turn off and change: grid false, idleText false / own, look crt, color, label, Turkish", async () => {
  const grid = signal(true);
  const [el, dispose] = mount(() => [h(Oscilloscope, { grid, idleText: false, look: "crt", color: "brand-blue", label: "Scope" }), h(Oscilloscope, { idleText: "Press play" })]);
  const [a, b] = el.querySelectorAll(".m-osc");
  assert.ok(a.querySelector(".m-osc-grid"));
  grid.set(false);
  assert.equal(a.querySelector(".m-osc-grid"), null);
  assert.equal(a.querySelector(".m-osc-idle"), null);
  assert.ok(a.classList.contains("m-osc-crt"));
  assert.equal(a.getAttribute("data-m-color"), "brand-blue");
  assert.equal(a.getAttribute("aria-label"), "Scope: No signal");
  assert.equal(b.getAttribute("aria-label"), "Oscilloscope: Press play");
  await setLocale("tr");
  assert.equal(a.getAttribute("aria-label"), "Scope: Sinyal yok");
  await setLocale("en");
  dispose();
});

test("Oscilloscope: a live source says its level in words, at most once a second, and goes idle when it stops", () => {
  const loud = signal(0.6);
  let src;
  const [el, dispose] = mount(() => h(Oscilloscope, { source: (src = audioSource(() => loud())) }));
  const osc = el.querySelector(".m-osc");
  E.step(16);
  assert.ok(!osc.classList.contains("is-idle"));
  assert.equal(osc.getAttribute("aria-label"), "Oscilloscope: loud");
  loud.set(0.05);
  E.step(16); E.step(16);
  assert.equal(osc.getAttribute("aria-label"), "Oscilloscope: loud", "not yet: one announcement a second");
  for (let i = 0; i < 70; i++) E.step(16);
  assert.equal(osc.getAttribute("aria-label"), "Oscilloscope: quiet");
  src.stop();
  assert.ok(osc.classList.contains("is-idle"));
  assert.equal(osc.getAttribute("aria-label"), "Oscilloscope: No signal");
  dispose();
});

test("Oscilloscope: the trigger finds the rising crossing; a period; mono and stereo", () => {
  const n = 480, s = Float32Array.from({ length: n }, (_, i) => Math.sin((2 * Math.PI * i) / 96 + 1));
  const at = triggerIndex(s);
  assert.ok(at > 0 && s[at - 1] < 0 && s[at] >= 0);
  assert.equal(periodOf(s), 96);
  assert.equal(triggerIndex(s, 2), -1, "a level never reached");
  assert.ok(isMono(s, s));
  assert.ok(isMono(s, new Float32Array(n)));
  assert.ok(!isMono(s, Float32Array.from(s, (_, i) => Math.cos(i / 10))));
});
