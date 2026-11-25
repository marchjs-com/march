import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { Spectrum } = await import("./index.ts");
const { audioSource } = await import("../../../audio/index.ts");
const { barEdges, barValues } = await import("./bands.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("Spectrum: no source is empty bars: an image named 'no signal', the variant class, the idle text, a height", () => {
  const [el, dispose] = mount(() => [h(Spectrum, { variant: "mirror", height: 90 }), h(Spectrum, { idleText: false, label: "Mic" })]);
  const [a, b] = el.querySelectorAll(".m-spec");
  assert.equal(a.getAttribute("role"), "img");
  assert.equal(a.getAttribute("aria-label"), "Spectrum: No signal");
  assert.ok(a.classList.contains("m-spec-mirror") && a.classList.contains("is-idle"));
  assert.equal(a.querySelector(".m-spec-idle").textContent, "No signal");
  assert.equal(a.style.getPropertyValue("--m-spec-h"), "90px");
  assert.equal(b.querySelector(".m-spec-idle"), null);
  assert.equal(b.getAttribute("aria-label"), "Mic: No signal");
  dispose();
});

test("Spectrum: colors: one token, the four HADİ colors, an own list (as theme variables the canvas reads)", () => {
  const [el, dispose] = mount(() => [h(Spectrum, { color: "brand-green" }), h(Spectrum, { colors: "brand" }), h(Spectrum, { colors: ["cat-1", "danger"] })]);
  const [one, brand, own] = el.querySelectorAll(".m-spec");
  assert.equal(one.getAttribute("data-m-color"), "brand-green");
  assert.equal(brand.getAttribute("data-m-colors"), "brand");
  assert.equal(brand.style.getPropertyValue("--m-spec-c0"), "var(--m-brand-orange, var(--m-cat-1))");
  assert.equal(brand.style.getPropertyValue("--m-spec-c3"), "var(--m-brand-purple, var(--m-cat-4))");
  assert.equal(own.getAttribute("data-m-colors"), "custom");
  assert.equal(own.style.getPropertyValue("--m-spec-c1"), "var(--m-danger)");
  dispose();
});

test("Spectrum: log edges, bar values from bins (wide bars average, narrow bars blend)", () => {
  const e = barEdges(4, 20, 20480);
  assert.equal(e.length, 5);
  assert.ok(Math.abs(e[0] - 20) < 1e-3 && Math.abs(e[4] - 20480) < 0.1);
  assert.ok(Math.abs(e[1] / e[0] - e[4] / e[3]) < 1e-3, "evenly spaced on a log scale");
  const lin = barEdges(4, 0, 100, "linear");
  assert.ok(Math.abs(lin[2] - 50.5) < 1e-3);
  // 1024 bins at 48 kHz: 23.4 Hz each; a peak at bin 100 (≈ 2.3 kHz)
  const spec = new Float32Array(1024); spec[100] = 1; spec[101] = 0.5;
  const out = barValues(spec, barEdges(16, 30, 16000), 48000, new Float32Array(16));
  const top = out.indexOf(Math.max(...out));
  const edges = barEdges(16, 30, 16000);
  assert.ok(edges[top] <= 2344 && edges[top + 1] >= 2344);
  const narrow = barValues(Float32Array.from([0, 1, 0, 0]), [27, 33], 192, new Float32Array(1));
  assert.ok(narrow[0] > 0 && narrow[0] < 1, "a bar inside one bin blends its neighbours");
  assert.equal(barValues(Float32Array.from([1, 1]), [0, 48000], 4, new Float32Array(1), 3)[0], 1, "clamped");
});

test("Spectrum: a live source says its level and loudest band in words; idle again when it stops", () => {
  const src = audioSource(() => 0.7);
  const [el, dispose] = mount(() => h(Spectrum, { source: src, bars: 32 }));
  const s = el.querySelector(".m-spec");
  E.step(16);
  assert.ok(!s.classList.contains("is-idle"));
  const said = s.getAttribute("aria-label");
  assert.match(said, /^Spectrum: loud, loudest near \d+ Hz$/);
  const hz = Number(said.match(/(\d+) Hz/)[1]);
  assert.ok(hz > 150 && hz < 320, `the number input is a 220 Hz tone (${hz})`);
  src.stop();
  assert.equal(s.getAttribute("aria-label"), "Spectrum: No signal");
  dispose();
});
