import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { Altimeter } = await import("./index.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const rot = (el, sel) => Number(/rotate\(([-\d.]+)/.exec(el.querySelector(sel).getAttribute("transform"))[1]);
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("Altimeter: three hands at their ratios, 0–9 numerals, the pressure window, a spoken altitude", async () => {
  const [el, dispose] = mount(() => h(Altimeter, { value: 12500, pressure: 1013, motion: false }));
  assert.equal(Math.abs(rot(el, ".m-alt-100")), 180, "500 of 1000: half a turn");
  assert.equal(rot(el, ".m-alt-1k"), 90, "12.5 thousands: a quarter past one turn");
  assert.equal(rot(el, ".m-alt-10k"), 45, "1.25 ten thousands");
  assert.deepEqual([...el.querySelectorAll(".m-gauge-label")].map((x) => x.textContent), ["0", "1", "2", "3", "4", "5", "6", "7", "8", "9"]);
  assert.match(el.querySelector(".m-alt-window").textContent, /1013\s*hPa/);
  assert.equal(el.querySelector(".m-gauge-caption").textContent, "ALT · ft");
  const root = el.querySelector(".m-alt");
  assert.equal(root.getAttribute("role"), "img");
  assert.equal(root.getAttribute("aria-label"), "Altimeter: 12,500 ft, 1013 hPa");
  assert.equal(el.querySelector(".m-gauge").getAttribute("aria-hidden"), "true");
  dispose();
});

// Rule "data changes animate": the hands spring to a new altitude (between after one frame, every hand on its own,
// the long hand spinning through the whole turns of a climb), retarget mid-move, and motion={false} jumps.
test("Altimeter animates: the hands spring through a climb, retarget mid-move; the window rolls; motion off jumps", () => {
  const alt = signal(0), pr = signal(1013);
  const [el, dispose] = mount(() => [h(Altimeter, { value: alt, pressure: pr, class: "a" }), h(Altimeter, { value: alt, motion: false, class: "b" })]);
  const a = el.querySelector(".a"), b = el.querySelector(".b");
  alt.set(2000); E.step(16); E.step(16);
  const raw = (sel) => Number(/rotate\(([-\d.]+)/.exec(a.querySelector(sel).getAttribute("transform"))[1]);
  const k = raw(".m-alt-1k");
  assert.ok(k > 0 && k < 72, `the thousands hand is on its way (${k})`);
  assert.equal(rot(b, ".m-alt-1k"), 72, "motion off: at once");
  alt.set(1000); E.step(16);
  assert.ok(Math.abs(raw(".m-alt-1k") - k) < 20, "retargets from where it is");
  run(3000);
  assert.ok(Math.abs(raw(".m-alt-1k") - 36) < 0.5);
  pr.set(1020);
  assert.ok(a.querySelector(".m-alt-window .m-roll-slot"), "the pressure digits roll");
  dispose();
});

test("Altimeter: metres, inHg, no window, own caption and hand look, parts off", () => {
  const [el, dispose] = mount(() => h(Altimeter, { value: 300, unit: "m", pressure: 29.92, pressureUnit: "inHg", caption: "BARO", motion: false,
    hands: { hundreds: { color: "info", class: "mine" } }, parts: { tenThousands: false, glass: false }, label: "Baro", size: 180 }));
  assert.match(el.querySelector(".m-alt-window").textContent, /29\.92\s*inHg/);
  assert.equal(el.querySelector(".m-gauge-caption").textContent, "BARO");
  assert.ok(el.querySelector(".m-alt-100.mine"));
  assert.equal(el.querySelector(".m-alt-10k"), null);
  assert.equal(el.querySelector(".m-gauge-glass"), null);
  assert.equal(el.querySelector(".m-alt").getAttribute("aria-label"), "Baro: 300 m, 29.92 inHg");
  dispose();
  const [el2, dispose2] = mount(() => h(Altimeter, { value: 50, motion: false }));
  assert.equal(el2.querySelector(".m-alt-window"), null, "no pressure, no window");
  dispose2();
});

test("Altimeter: later values (getters) for hands, color and size take effect", () => {
  const col = signal("warning"), size = signal(200), hands = signal(undefined);
  const [el, dispose] = mount(() => h(Altimeter, { value: 500, motion: false, get color() { return col(); }, get size() { return size(); }, get hands() { return hands(); } }));
  col.set("info");
  assert.equal(el.querySelector(".m-alt-10k").style.getPropertyValue("--m-gauge-needle"), "var(--m-info)");
  hands.set({ hundreds: { class: "late" } });
  assert.ok(el.querySelector(".m-alt-100.late"));
  size.set(170);
  assert.equal(el.querySelector(".m-gauge").style.getPropertyValue("--m-gauge-w"), "170px");
  dispose();
});

test("Altimeter: later parts (a getter) take a hand and the window away", () => {
  const parts = signal(undefined);
  const [el, dispose] = mount(() => h(Altimeter, { value: 500, pressure: 1013, motion: false, get parts() { return parts(); } }));
  parts.set({ tenThousands: false, window: false });
  assert.equal(el.querySelector(".m-alt-10k"), null);
  assert.equal(el.querySelector(".m-alt-window"), null);
  dispose();
});
