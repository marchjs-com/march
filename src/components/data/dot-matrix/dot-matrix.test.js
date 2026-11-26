import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { DotMatrix, glyphOf, textColumns } = await import("./index.ts");

setLocale("en");
E.manualClock(true);
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const lit = (el) => el.querySelector(".m-dm-lit path").getAttribute("d");
const dots = (el) => (lit(el).match(/M/g) ?? []).length;
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };

test("glyphs: the 5×7 font, Turkish letters, your own glyphs (rows or columns), a box for the unknown", () => {
  assert.deepEqual(glyphOf("1"), [0x00, 0x42, 0x7f, 0x40, 0x00]);
  assert.deepEqual(glyphOf("I"), [0x00, 0x41, 0x7f, 0x41, 0x00]);
  assert.notDeepEqual(glyphOf("İ"), glyphOf("I"));
  assert.notDeepEqual(glyphOf("ş"), glyphOf("s"));
  assert.deepEqual(glyphOf("☺"), [0x7f, 0x41, 0x41, 0x41, 0x7f]);
  const heart = [".#.#.", "#####", "#####", ".###.", "..#..", ".....", "....."];
  assert.deepEqual(glyphOf("♥", { "♥": heart }), [0b0110, 0b1111, 0b11110, 0b1111, 0b0110]);
  assert.deepEqual(glyphOf("x", { x: [1, 2, 3, 4, 5] }), [1, 2, 3, 4, 5]);
  assert.equal(textColumns("AB").length, 11, "5 + 1 + 5");
  assert.equal(textColumns("AB", 0).length, 10);
});

test("DotMatrix: an img named label + text, unlit dots for the whole window, lit dots for the text", () => {
  const [el, dispose] = mount(() => h(DotMatrix, { value: "HI", label: "Sign" }));
  const root = el.querySelector(".m-dm");
  assert.equal(root.getAttribute("role"), "img");
  assert.equal(root.getAttribute("aria-label"), "Sign: HI");
  assert.equal(el.querySelector(".m-dm-screen").getAttribute("aria-hidden"), "true");
  assert.equal(el.querySelector(".m-dm-screen").getAttribute("viewBox"), "0 0 11 7");
  assert.equal((el.querySelector(".m-dm-off").getAttribute("d").match(/M/g) ?? []).length, 77, "11 × 7 unlit dots");
  // H = 7+1+1+1+7 dots, I = 2+7+2 dots
  assert.equal(dots(el), 17 + 11);
  dispose();
});

test("DotMatrix: numbers in the locale, a window of `columns` aligned to the end, square dots, parts off", () => {
  const n = signal(1234.5);
  const [el, dispose] = mount(() => h(DotMatrix, { value: n, columns: 8, align: "end", dot: "square", format: { maximumFractionDigits: 1 }, parts: { off: false, glow: false }, motion: false }));
  assert.equal(el.querySelector(".m-dm-screen").getAttribute("viewBox"), "0 0 47 7");
  assert.match(el.querySelector(".m-dm").getAttribute("aria-label"), /1,234\.5$/);
  assert.equal(el.querySelector(".m-dm-off").getAttribute("d"), "");
  assert.ok(!el.querySelector(".m-dm-lit").classList.contains("is-glow"));
  assert.match(lit(el), /h0\.78v0\.78/, "square dots");
  // right-aligned: the first columns of the window are dark
  assert.ok(!/M0\.\d+ /.test(lit(el)));
  n.set(7); // motion off: at once
  assert.match(el.querySelector(".m-dm").getAttribute("aria-label"), /: 7$/);
  assert.ok(!el.querySelector(".m-dm").classList.contains("is-changing"));
  dispose();
});

test("DotMatrix: a change starts a wipe (in between after one frame), a change mid-way retargets, motion off jumps", () => {
  const v = signal("8888");
  const [el, dispose] = mount(() => h(DotMatrix, { value: v, duration: 400 }));
  const full = dots(el);
  v.set("    ");
  assert.ok(el.querySelector(".m-dm").classList.contains("is-changing"), "a tween runs");
  E.step(16); run(160);
  const mid = dots(el);
  assert.ok(mid > 0 && mid < full, `in between: ${mid} of ${full}`);
  // retarget: back to 8888 from the half-wiped board (not from blank, not from full)
  v.set("1111");
  E.step(16);
  const again = dots(el);
  assert.ok(again > 0 && again <= mid + 20, `from where it was: ${again}`);
  run(600);
  assert.ok(!el.querySelector(".m-dm").classList.contains("is-changing"));
  assert.equal(dots(el), 4 * 10, '"1" = 2 + 7 + 1 dots');
  dispose();

  const w = signal("AAAA");
  const [el2, dispose2] = mount(() => h(DotMatrix, { value: w, motion: false }));
  w.set("BBBB");
  assert.ok(!el2.querySelector(".m-dm").classList.contains("is-changing"), "motion off: no tween");
  assert.equal(el2.querySelector(".m-dm").getAttribute("aria-label"), "Display: BBBB");
  dispose2();
});

test("DotMatrix: long text scrolls a column at a time after the hold, pauses, and stays still with motion off", () => {
  const paused = signal(false), motion = signal(true);
  const [el, dispose] = mount(() => h(DotMatrix, { value: "HELLO WORLD", columns: 4, hold: 100, speed: 60, paused, motion }));
  const root = el.querySelector(".m-dm");
  assert.ok(root.classList.contains("is-scrolling"));
  const g = el.querySelector(".m-dm-lit");
  assert.equal(g.getAttribute("transform"), "translate(0 0)");
  run(96);
  assert.equal(g.getAttribute("transform"), "translate(0 0)", "holds first");
  run(200);
  const moved = Number(/translate\((-?\d+)/.exec(g.getAttribute("transform"))[1]);
  assert.ok(moved < 0, `moved ${moved}`);
  paused.set(true);
  const at = g.getAttribute("transform");
  run(300);
  assert.equal(g.getAttribute("transform"), at, "paused");
  paused.set(false);
  motion.set(false);
  assert.equal(g.getAttribute("transform"), "translate(0 0)", "motion off: the start of the text");
  run(300);
  assert.equal(g.getAttribute("transform"), "translate(0 0)");
  dispose();
});

test("DotMatrix: every prop is reactive after mount", () => {
  const value = signal("AB"), columns = signal(undefined), dot = signal("round"), size = signal("md"), color = signal(undefined), label = signal("A"), spacing = signal(1), parts = signal({}), scroll = signal("auto");
  const [el, dispose] = mount(() => h(DotMatrix, { value, columns, dot, size, color, label, spacing, parts, scroll, motion: false }));
  const root = el.querySelector(".m-dm");
  columns.set(3); assert.equal(el.querySelector(".m-dm-screen").getAttribute("viewBox"), "0 0 17 7");
  spacing.set(0); assert.equal(el.querySelector(".m-dm-screen").getAttribute("viewBox"), "0 0 15 7");
  dot.set("square"); assert.match(lit(el), /h0\.78/);
  size.set("lg"); assert.ok(root.classList.contains("m-dm-lg"));
  size.set(12); assert.equal(root.style.getPropertyValue("--m-dm-dot"), "12px");
  color.set("success"); assert.equal(root.getAttribute("data-m-color"), "success");
  label.set("Board"); assert.equal(root.getAttribute("aria-label"), "Board: AB");
  parts.set({ bezel: false }); assert.ok(root.classList.contains("m-dm-bare"));
  value.set("ABCDEFG"); assert.ok(root.classList.contains("is-scrolling"));
  scroll.set(false); assert.ok(!root.classList.contains("is-scrolling"));
  dispose();
});
