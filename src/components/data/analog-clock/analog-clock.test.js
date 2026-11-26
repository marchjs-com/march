import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { AnalogClock } = await import("./index.ts");
const { clockParts } = await import("../../../ui/clock.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const rot = (el, cls) => Number(/rotate\(([-\d.]+)/.exec(el.querySelector(`.${cls}`).getAttribute("transform"))[1]);
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };
const at = (hh, mm, ss, ms = 0) => new Date(2026, 10, 26, hh, mm, ss, ms);

test("clockParts (ui/clock): the device's time, or a time zone's", () => {
  const d = new Date(Date.UTC(2026, 10, 26, 9, 30, 15));
  assert.deepEqual(clockParts(d, { timeZone: "UTC" }), { hours: 9, minutes: 30, seconds: 15, ms: 0, period: "" });
  assert.equal(clockParts(d, { timeZone: "Asia/Tokyo" }).hours, 18);
  assert.equal(clockParts(at(3, 4, 5)).minutes, 4);
});

test("AnalogClock: a Gauge dial with hour / minute / second hands at the right angles, numerals, a spoken time", () => {
  const [el, dispose] = mount(() => h(AnalogClock, { time: at(3, 0, 15), motion: false, label: "Office" }));
  const root = el.querySelector(".m-clock");
  assert.equal(root.getAttribute("role"), "img");
  assert.equal(root.getAttribute("aria-label"), "Office: 3:00 AM");
  assert.equal(root.querySelector(".m-gauge").getAttribute("aria-hidden"), "true", "the inner meter is not read twice");
  assert.ok(Math.abs(rot(el, "m-clock-hour") - 90.1) < 0.1, "3 o'clock (and a little)");
  assert.equal(rot(el, "m-clock-minute"), 1.5);
  assert.equal(rot(el, "m-clock-second"), 90);
  const labels = [...el.querySelectorAll(".m-gauge-label")].map((x) => x.textContent);
  assert.deepEqual(labels, ["12", "1", "2", "3", "4", "5", "6", "7", "8", "9", "10", "11"]);
  dispose();
});

// Rule "data changes animate": a ticking second hand springs to the next second (between the two angles after one
// frame), an interrupted move retargets from where the hand is, and motion={false} jumps.
test("AnalogClock animates: the ticking second hand springs, retargets mid-move and takes the short way past 12; motion off jumps", () => {
  const time = signal(at(10, 10, 58));
  const [el, dispose] = mount(() => [h(AnalogClock, { time, class: "a" }), h(AnalogClock, { time, motion: false, class: "b" })]);
  const a = el.querySelector(".a"), b = el.querySelector(".b");
  assert.equal(rot(a, "m-clock-second"), -12);
  time.set(at(10, 10, 59)); E.step(16);
  const mid = rot(a, "m-clock-second");
  assert.ok(mid > -12 && mid < -6, `between 58 s and 59 s (${mid})`);
  assert.equal(rot(b, "m-clock-second"), -6, "motion off: at once");
  time.set(at(10, 11, 0)); E.step(16);
  const next = rot(a, "m-clock-second");
  assert.ok(next >= mid - 0.5 && next < 0, `retargets from where it is and goes forward past 12 (${next})`);
  run(2000);
  assert.ok(Math.abs(rot(a, "m-clock-second")) < 0.5, "lands on 12");
  dispose();
});

test("AnalogClock: roman numerals, seconds off, own hands, caption, readout, size, a time zone", () => {
  const d = new Date(Date.UTC(2026, 10, 26, 0, 45, 0));
  const [el, dispose] = mount(() => h(AnalogClock, { time: d, timeZone: "UTC", numerals: "roman", seconds: false, caption: "UTC", size: 180, motion: false,
    hands: { hour: { color: "brand-blue", class: "mine" } }, readout: (x) => `${x.getUTCDate()}`, class: "own" }));
  assert.equal(el.querySelector(".m-clock-second"), null);
  assert.equal(el.querySelector(".m-gauge-label").textContent, "XII");
  assert.equal(el.querySelector(".m-gauge-caption").textContent, "UTC");
  assert.equal(el.querySelector(".m-clock-readout").textContent, "26");
  assert.ok(el.querySelector(".m-clock-hour.mine"));
  assert.equal(el.querySelector(".m-clock-hour").style.getPropertyValue("--m-gauge-needle"), "var(--m-brand-blue, var(--m-cat-2))");
  assert.equal(rot(el, "m-clock-minute"), -90);
  assert.equal(el.querySelector(".m-gauge").style.getPropertyValue("--m-gauge-w"), "180px");
  assert.ok(el.querySelector(".m-clock").classList.contains("own"));
  dispose();
});

test("AnalogClock: the system clock ticks once a second while on screen; smooth sweeps on frames; onTick", async () => {
  const ticks = [];
  const [el, dispose] = mount(() => [h(AnalogClock, { onTick: (d) => ticks.push(d), class: "t" }), h(AnalogClock, { seconds: "smooth", class: "s" })]);
  const s = el.querySelector(".s");
  const before = s.querySelector(".m-clock-second").getAttribute("transform");
  await new Promise((r) => setTimeout(r, 60));
  E.step(16);
  assert.notEqual(s.querySelector(".m-clock-second").getAttribute("transform"), before, "a smooth hand moves every frame");
  assert.ok(el.querySelector(".s").classList.contains("m-clock-smooth"));
  await new Promise((r) => setTimeout(r, 1050));
  assert.ok(ticks.length >= 1, "onTick each second");
  dispose();
});

test("AnalogClock: later values (getters) for size, seconds, numerals, hands and color take effect", () => {
  const size = signal(200), sec = signal("tick"), num = signal("arabic"), col = signal("danger"), hands = signal(undefined);
  const [el, dispose] = mount(() => h(AnalogClock, { time: at(1, 2, 3), motion: false, get size() { return size(); }, get seconds() { return sec(); },
    get numerals() { return num(); }, get color() { return col(); }, get hands() { return hands(); } }));
  size.set(150);
  assert.equal(el.querySelector(".m-gauge").style.getPropertyValue("--m-gauge-w"), "150px");
  num.set("roman");
  assert.equal(el.querySelector(".m-gauge-label").textContent, "XII");
  col.set("brand-blue");
  assert.match(el.querySelector(".m-clock-second").style.getPropertyValue("--m-gauge-needle"), /brand-blue/);
  hands.set({ hour: { class: "late" } });
  assert.ok(el.querySelector(".m-clock-hour.late"));
  sec.set(false);
  assert.equal(el.querySelector(".m-clock-second"), null);
  dispose();
});
