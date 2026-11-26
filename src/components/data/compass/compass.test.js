import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { Compass, normHeading } = await import("./index.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const rot = (el, sel) => Number(/rotate\(([-\d.]+)/.exec(el.querySelector(sel).getAttribute("transform"))[1]);
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("normHeading keeps a heading within one turn", () => {
  assert.equal(normHeading(-90), 270);
  assert.equal(normHeading(725), 5);
});

test("Compass rose: the scale turns by -heading, N E S W letters, a lubber line, a meter with the heading in words", async () => {
  const [el, dispose] = mount(() => h(Compass, { heading: 90, motion: false, bearing: 120 }));
  const g = el.querySelector(".m-gauge");
  assert.equal(rot(el, ".m-gauge-scale"), -90);
  const labels = [...el.querySelectorAll(".m-gauge-label")].map((x) => x.textContent);
  assert.deepEqual(labels, ["N", "3", "6", "E", "12", "15", "S", "21", "24", "W", "30", "33"]);
  assert.ok(el.querySelector(".m-compass-lubber"));
  assert.equal(el.querySelector(".m-gauge-needle"), null, "no needle: the rose turns");
  assert.equal(rot(el, ".m-gauge-peak"), 120, "the bearing mark sits on the rose");
  assert.equal(g.getAttribute("role"), "meter");
  assert.equal(g.getAttribute("aria-label"), "Compass, bearing 120° E");
  await wait(300);
  assert.equal(g.getAttribute("aria-valuetext"), "090° E");
  assert.match(el.querySelector(".m-compass-readout").textContent, /090° E/);
  dispose();
});

// Rule "data changes animate": the rose turns on a damped spring (between old and new after one frame), the short way
// round (350° → 10° turns 20°, not 340°), retargets mid-turn, and motion={false} jumps.
test("Compass animates the turn the short way round, retargets, motion off jumps", () => {
  const hd = signal(350);
  const [el, dispose] = mount(() => [h(Compass, { heading: hd, class: "a" }), h(Compass, { heading: hd, motion: false, class: "b" })]);
  const a = el.querySelector(".a"), b = el.querySelector(".b");
  assert.equal(rot(a, ".m-gauge-scale"), 10);
  hd.set(10); E.step(16);
  const mid = rot(a, ".m-gauge-scale");
  assert.ok(mid < 10 && mid > -10, `turning 20° the short way (${mid})`);
  assert.equal(rot(b, ".m-gauge-scale"), -10, "motion off: at once");
  hd.set(0); E.step(16);
  const back = rot(a, ".m-gauge-scale");
  assert.ok(Math.abs(back - mid) < 5, "retargets from where it is");
  run(3000);
  assert.ok(Math.abs(rot(a, ".m-gauge-scale")) < 0.5);
  dispose();
});

test("Compass needle mode: a fixed rose, a two-tone needle that springs to the heading; 8 points; own names; parts off", async () => {
  const hd = signal(45);
  const [el, dispose] = mount(() => h(Compass, { heading: hd, mode: "needle", points: 8, cardinals: ["K", "KD", "D", "GD", "G", "GB", "B", "KB"], readout: false, parts: { glass: false } }));
  assert.equal(rot(el, ".m-gauge-scale"), 0);
  assert.equal(el.querySelector(".m-compass-lubber"), null);
  assert.equal(rot(el, ".m-compass-north"), 45);
  assert.equal(rot(el, ".m-compass-south"), -135);
  assert.deepEqual([...el.querySelectorAll(".m-gauge-label")].map((x) => x.textContent), ["K", "KD", "D", "GD", "G", "GB", "B", "KB"]);
  assert.equal(el.querySelector(".m-compass-readout"), null);
  assert.equal(el.querySelector(".m-gauge-glass"), null);
  hd.set(90); E.step(16);
  const n = rot(el, ".m-compass-north");
  assert.ok(n > 45 && n < 90, `the needle springs (${n})`);
  run(3000);
  await wait(300);
  assert.equal(el.querySelector(".m-gauge").getAttribute("aria-valuetext"), "090° D", "the needle halves are not read twice");
  dispose();
});

test("Compass: later values (getters) for mode, readout, size and color take effect", () => {
  const mode = signal("rose"), ro = signal(true), size = signal(200), col = signal(undefined);
  const [el, dispose] = mount(() => h(Compass, { heading: 10, motion: false, get mode() { return mode(); }, get readout() { return ro(); }, get size() { return size(); }, get color() { return col(); } }));
  mode.set("needle");
  assert.ok(el.querySelector(".m-compass-north"));
  ro.set(false);
  assert.equal(el.querySelector(".m-compass-readout"), null);
  size.set(160);
  assert.equal(el.querySelector(".m-gauge").style.getPropertyValue("--m-gauge-w"), "160px");
  col.set("info");
  assert.equal(el.querySelector(".m-compass").getAttribute("data-m-color"), "info");
  dispose();
});
