import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { SplitFlap, FLAP_REEL } = await import("./index.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const shown = (el) => [...el.querySelectorAll(".m-flap-half.is-bottom")].map((x) => x.textContent).join("");
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };

test("SplitFlap: one cell per character, padded to `length`, upper-cased in the page's language, text for screen readers", () => {
  setLocale("tr");
  const [el, dispose] = mount(() => h(SplitFlap, { value: "izmir", length: 7, align: "end", label: "Varış" }));
  assert.equal(el.querySelectorAll(".m-flap-cell").length, 7);
  assert.equal(shown(el), "  İZMİR", "Turkish capitals, aligned to the end, shown at once on the first paint");
  assert.equal(el.querySelector(".m-flap-cells").getAttribute("aria-hidden"), "true");
  assert.equal(el.querySelector(".m-sr-only").textContent, "Varış: İZMİR");
  assert.ok([...el.querySelectorAll(".m-flap-cell")].every((c) => c.classList.contains("is-idle")));
  dispose();
  setLocale("en");
});

test("SplitFlap: a change flips each reel forward flap by flap (in between after a frame), retargets mid-way, motion off jumps", () => {
  const v = signal("A"), settled = [];
  const [el, dispose] = mount(() => h(SplitFlap, { value: v, flapTime: 50, stagger: 0, onSettle: (x) => settled.push(x) }));
  const cell = el.querySelector(".m-flap-cell");
  v.set("E");
  assert.ok(el.querySelector(".m-flap").classList.contains("is-moving"));
  E.step(16);
  assert.ok(!cell.classList.contains("is-idle"), "the leaf turns");
  assert.match(cell.style.getPropertyValue("--m-flap-turn"), /^-\d+deg$/);
  assert.equal(shown(el), "A", "still on A after one frame");
  assert.equal(cell.querySelector(".m-flap-half.is-top").textContent, "B", "the next flap waits behind");
  run(64);
  assert.equal(shown(el), "B", "one flap later: B (in between A and E)");
  // retarget: C is ahead of B on the reel, so the reel goes on from where it is and stops at C
  v.set("C");
  run(200);
  assert.equal(shown(el), "C");
  assert.ok(cell.classList.contains("is-idle"));
  assert.deepEqual(settled, ["C"]);
  dispose();

  const w = signal("A"), motion = signal(false);
  const [el2, dispose2] = mount(() => h(SplitFlap, { value: w, motion }));
  w.set("Z");
  assert.equal(shown(el2), "Z", "motion off: at once");
  assert.ok(!el2.querySelector(".m-flap").classList.contains("is-moving"));
  dispose2();
});

test("SplitFlap: reels only turn forward (Z → A goes round), stagger delays the next cell, unknown characters show as they are", () => {
  const v = signal("ZZ");
  const [el, dispose] = mount(() => h(SplitFlap, { value: v, flapTime: 20, stagger: 100 }));
  v.set("AA");
  run(48);
  const [a, b] = [...el.querySelectorAll(".m-flap-half.is-bottom")].map((x) => x.textContent);
  assert.notEqual(a, "Z", "the first cell turned");
  assert.equal(b, "Z", "the second waits its stagger");
  run(3000);
  assert.equal(shown(el), "AA");
  v.set("A~");
  assert.equal(shown(el), "A~", "a character not on the reel is shown without flaps");
  assert.equal(FLAP_REEL[0], " ");
  dispose();
});

test("SplitFlap: every prop is reactive after mount", () => {
  const value = signal("AB"), length = signal(undefined), chars = signal(undefined), size = signal("md"), color = signal(undefined), frame = signal(true), label = signal("Gate"), live = signal("off"), align = signal("start");
  const [el, dispose] = mount(() => h(SplitFlap, { value, length, chars, size, color, frame, label, live, align, motion: false }));
  const root = el.querySelector(".m-flap");
  length.set(4); assert.equal(el.querySelectorAll(".m-flap-cell").length, 4); assert.equal(shown(el), "AB  ");
  align.set("end"); assert.equal(shown(el), "  AB");
  chars.set(" abc"); value.set("abc"); assert.equal(shown(el), " abc", "a reel with lower case keeps the case");
  size.set("lg"); assert.ok(root.classList.contains("m-flap-lg"));
  size.set(50); assert.equal(root.style.getPropertyValue("--m-flap-h"), "50px");
  color.set("warning"); assert.equal(root.getAttribute("data-m-color"), "warning");
  frame.set(false); assert.ok(root.classList.contains("m-flap-bare"));
  label.set("Kapı"); assert.equal(el.querySelector(".m-sr-only").textContent, "Kapı: abc");
  live.set("polite"); assert.equal(el.querySelector(".m-sr-only").getAttribute("aria-live"), "polite");
  dispose();
});
