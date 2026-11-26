import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { FlipClock } = await import("./index.ts");
const { clockParts } = await import("../../../ui/clock.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
// the digits a group shows (a flipping card's new digit; its ghost is the old one on the way out)
const digits = (el, cl) => [...el.querySelector(`.${cl} .m-roll-vis`).children]
  .map((x) => (x.classList.contains("m-roll-slot") ? x.querySelector(".m-roll-d") : x).textContent).join("");
const at = (hh, mm, ss) => new Date(2026, 10, 26, hh, mm, ss).getTime();

test("clockParts (ui/clock): 24 and 12 hours, a time zone, the day period's text", () => {
  const d = new Date(Date.UTC(2026, 0, 1, 13, 5, 9));
  assert.deepEqual(clockParts(d, { timeZone: "UTC" }), { hours: 13, minutes: 5, seconds: 9, ms: 0, period: "" });
  const p = clockParts(d, { timeZone: "UTC", hour12: true, lang: "en" });
  assert.equal(p.hours, 1); assert.equal(p.period, "PM");
  assert.equal(clockParts(new Date(Date.UTC(2026, 0, 1, 0, 0, 0)), { timeZone: "UTC", hour12: true }).hours, 12);
  assert.equal(clockParts(d, { timeZone: "Asia/Tokyo" }).hours, 22);
});

test("FlipClock: an img with the spoken time, three Odometer flip groups, separators, the 12-hour flap", () => {
  const [el, dispose] = mount(() => h(FlipClock, { time: at(9, 7, 30), hour12: false, label: "Saat" }));
  const root = el.querySelector(".m-flipclock");
  assert.equal(root.getAttribute("role"), "img");
  assert.match(root.getAttribute("aria-label"), /^Saat: 09:07/);
  assert.equal(el.querySelector(".m-flipclock-cards").getAttribute("aria-hidden"), "true");
  assert.equal(el.querySelectorAll(".m-odo-flip").length, 3);
  assert.equal(digits(el, "m-flipclock-h"), "09");
  assert.equal(digits(el, "m-flipclock-m"), "07");
  assert.equal(digits(el, "m-flipclock-s"), "30");
  assert.equal(el.querySelectorAll(".m-flipclock-sep").length, 2);
  assert.equal(el.querySelector(".m-flipclock-period"), null);
  dispose();
  const [el2, dispose2] = mount(() => h(FlipClock, { time: at(15, 0, 0), hour12: true, seconds: false }));
  assert.equal(digits(el2, "m-flipclock-h"), "03");
  assert.equal(el2.querySelectorAll(".m-odo-flip").length, 2);
  assert.match(el2.querySelector(".m-flipclock-period .m-sr-only").textContent, /PM/);
  dispose2();
});

test("FlipClock: a new time flips the cards on the engine (in between after a frame), a change mid-way retargets, motion off jumps", async () => {
  const time = signal(at(10, 0, 58));
  const [el, dispose] = mount(() => h(FlipClock, { time, hour12: false, duration: 400 }));
  time.set(at(10, 0, 59));
  E.step(16);
  assert.ok(el.querySelector(".m-flipclock-s .m-roll-slot"), "a card is flipping");
  assert.ok(el.querySelector(".m-flipclock-s .m-roll-ghost"), "the old digit is still on the way out");
  // mid-way: the next second retargets the same card from where it is
  time.set(at(10, 1, 0));
  E.step(16);
  assert.equal(digits(el, "m-flipclock-s"), "00");
  assert.equal(digits(el, "m-flipclock-m"), "01");
  dispose();

  const t2 = signal(at(10, 0, 0)), motion = signal(false);
  const [el2, dispose2] = mount(() => h(FlipClock, { time: t2, motion }));
  t2.set(at(11, 0, 0));
  assert.equal(el2.querySelector(".m-flipclock-h .m-roll-slot"), null, "motion off: the digit is swapped");
  assert.equal(digits(el2, "m-flipclock-h"), "11");
  assert.ok(!el2.querySelector(".m-flipclock").classList.contains("is-blink"), "no blinking either");
  dispose2();
});

test("FlipClock: every prop is reactive after mount", () => {
  const time = signal(at(13, 4, 5)), timeZone = signal(undefined), hour12 = signal(false), seconds = signal(true), separator = signal(":"), blink = signal(true), size = signal("md"), color = signal(undefined), label = signal("A"), parts = signal({});
  const [el, dispose] = mount(() => h(FlipClock, { time, timeZone, hour12, seconds, separator, blink, size, color, label, parts, motion: false }));
  const root = el.querySelector(".m-flipclock");
  seconds.set(false); assert.equal(el.querySelectorAll(".m-odo-flip").length, 2);
  hour12.set(true); assert.equal(digits(el, "m-flipclock-h"), "01"); assert.ok(el.querySelector(".m-flipclock-period"));
  parts.set({ period: false, frame: false }); assert.equal(el.querySelector(".m-flipclock-period"), null); assert.ok(root.classList.contains("m-flipclock-bare"));
  separator.set("."); assert.equal(el.querySelector(".m-flipclock-sep").textContent, ".");
  separator.set(false); assert.equal(el.querySelector(".m-flipclock-sep"), null);
  size.set("lg"); assert.equal(root.style.getPropertyValue("--m-flipclock-h"), "64px");
  size.set(30); assert.equal(root.style.getPropertyValue("--m-flipclock-h"), "30px");
  color.set("warning"); assert.equal(root.getAttribute("data-m-color"), "warning");
  label.set("Tokyo"); assert.match(root.getAttribute("aria-label"), /^Tokyo: /);
  hour12.set(false);
  timeZone.set("UTC"); assert.equal(digits(el, "m-flipclock-h"), String(new Date(at(13, 4, 5)).getUTCHours()).padStart(2, "0"));
  blink.set(false); assert.ok(!root.classList.contains("is-blink"));
  time.set(at(20, 30, 0)); assert.equal(digits(el, "m-flipclock-m"), "30");
  dispose();
});
