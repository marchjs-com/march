import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { Stopwatch } = await import("./index.ts");

setLocale("en");
E.manualClock(true);
// a fake real-time clock: the stopwatch measures performance.now()
let fake = 1000;
Object.defineProperty(globalThis, "performance", { value: { now: () => fake }, configurable: true });
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const hand = (el, cls = "m-stopwatch-hand") => Number(/rotate\(([-\d.]+)/.exec(el.querySelector(`.${cls}`).getAttribute("transform"))[1]);
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };
const press = (el, cls) => el.querySelector(`.${cls}`).click();

test("Stopwatch: start, the hand sweeps with real time, the readout and the timer text, stop, resume, reset", () => {
  const events = [];
  const [el, dispose] = mount(() => h(Stopwatch, { onStart: (ms) => events.push(["start", ms]), onStop: (ms) => events.push(["stop", ms]), onReset: () => events.push(["reset"]) }));
  const root = el.querySelector(".m-stopwatch");
  assert.equal(root.getAttribute("role"), "group");
  assert.equal(root.getAttribute("aria-label"), "Stopwatch");
  assert.equal(el.querySelector(".m-gauge").getAttribute("aria-hidden"), "true");
  assert.equal(el.querySelector(".m-stopwatch-toggle").textContent, "Start");
  assert.ok(el.querySelector(".m-stopwatch-second").disabled, "nothing to reset yet");
  press(el, "m-stopwatch-toggle");
  assert.ok(root.classList.contains("is-running"));
  assert.equal(el.querySelector(".m-stopwatch-toggle").textContent, "Stop");
  fake += 15000; E.step(16);
  assert.equal(hand(el), 90, "15 s: a quarter turn");
  assert.equal(el.querySelector(".m-stopwatch-readout").textContent, "00:15.00");
  assert.equal(el.querySelector("[role=timer]").textContent, "0:15");
  press(el, "m-stopwatch-toggle");
  fake += 5000; E.step(16);
  assert.equal(el.querySelector(".m-stopwatch-readout").textContent, "00:15.00", "stopped: time stands");
  assert.equal(el.querySelector(".m-stopwatch-toggle").textContent, "Resume");
  press(el, "m-stopwatch-second");
  assert.equal(el.querySelector(".m-stopwatch-readout").textContent, "00:00.00");
  assert.deepEqual(events, [["start", 0], ["stop", 15000], ["reset"]]);
  dispose();
});

// Rule "data changes animate": stopped, the hands move on a spring: a reset flies back between the old and the zero
// angle after one frame (the short way round), a start mid-flight retargets, and motion={false} jumps.
test("Stopwatch animates the fly-back on reset (short way), motion off jumps", () => {
  const [el, dispose] = mount(() => [h(Stopwatch, { class: "a" }), h(Stopwatch, { class: "b", motion: false })]);
  const [a, b] = el.querySelectorAll(".m-stopwatch");
  press(a, "m-stopwatch-toggle"); press(b, "m-stopwatch-toggle");
  fake += 45000; E.step(16);
  press(a, "m-stopwatch-toggle"); press(b, "m-stopwatch-toggle");
  run(500);
  assert.equal(hand(a), -90, "45 s");
  press(a, "m-stopwatch-second"); press(b, "m-stopwatch-second");
  E.step(16);
  const mid = hand(a);
  assert.ok(mid < 0 && mid > -90, `on its way forward to 60 (${mid})`);
  assert.equal(hand(b), 0, "motion off: at once");
  run(3000);
  assert.ok(Math.abs(hand(a)) < 0.5, "lands on zero");
  dispose();
});

test("Stopwatch: laps (newest first, best and worst), onLap, own texts, decimals, controlled running, parts off", () => {
  const laps = [], on = signal(false);
  const [el, dispose] = mount(() => h(Stopwatch, { running: on, decimals: 1, onLap: (l) => laps.push(l.lap), subDial: false, motion: false,
    texts: { lap: "Tur", lapName: (n) => `Tur ${n}` }, label: "Kronometre", parts: { glass: false } }));
  assert.equal(el.querySelector(".m-stopwatch-sub"), null);
  assert.equal(el.querySelector(".m-gauge-glass"), null);
  on.set(true);
  assert.equal(el.querySelector(".m-stopwatch-second").textContent, "Tur");
  fake += 10000; press(el, "m-stopwatch-second");
  fake += 4000; press(el, "m-stopwatch-second");
  fake += 7000; press(el, "m-stopwatch-second");
  assert.deepEqual(laps, [10000, 4000, 7000]);
  const rows = [...el.querySelectorAll(".m-stopwatch-lap")];
  assert.equal(rows[0].textContent, "Tur 300:07.000:21.0", "newest first");
  assert.ok(rows[1].classList.contains("is-best") && rows[2].classList.contains("is-worst"));
  on.set(false);
  assert.ok(!el.querySelector(".m-stopwatch").classList.contains("is-running"));
  assert.equal(el.querySelector(".m-stopwatch").getAttribute("aria-label"), "Kronometre");
  dispose();
});

test("Stopwatch: the 30-minute sub-dial and controls off", () => {
  const [el, dispose] = mount(() => h(Stopwatch, { motion: false, parts: { controls: false, laps: false } }));
  assert.equal(el.querySelector(".m-stopwatch-controls"), null);
  assert.ok(el.querySelector(".m-stopwatch-sub .m-gauge"));
  dispose();
});

test("Stopwatch: later values (getters) for parts, subDial, decimals and color take effect", () => {
  const parts = signal(undefined), sub = signal(true), dec = signal(2), col = signal("danger");
  const [el, dispose] = mount(() => h(Stopwatch, { motion: false, get parts() { return parts(); }, get subDial() { return sub(); }, get decimals() { return dec(); }, get color() { return col(); } }));
  parts.set({ controls: false, readout: false });
  assert.equal(el.querySelector(".m-stopwatch-controls"), null);
  assert.equal(el.querySelector(".m-stopwatch-readout"), null);
  parts.set(undefined);
  dec.set(0);
  assert.equal(el.querySelector(".m-stopwatch-readout").textContent, "00:00");
  sub.set(false);
  assert.equal(el.querySelector(".m-stopwatch-sub"), null);
  col.set("info");
  assert.equal(el.querySelector(".m-stopwatch-hand").style.getPropertyValue("--m-gauge-needle"), "var(--m-info)");
  dispose();
});
