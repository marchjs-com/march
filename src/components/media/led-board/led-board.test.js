import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { configure } = await import("../../../motion/engine/config.ts");
const { ledFrame, ledNoise } = await import("../led-matrix/frame.ts");
const { LedBoard } = await import("./index.ts");
const { contentOf, mixFrames, hueColor } = await import("./scenes.ts");

setLocale("en");
E.manualClock(true);
configure({ reduce: "full" }, { persist: false });
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };
const ENV = { cols: 32, rows: 8, font: "5x7", spacing: 1, scale: 1, direction: "left", speed: 30, pause: 1000, effect: "none", ink: 0, still: false,
  face: () => ({ state: { x: 0, y: 0, lid: 0, size: 1, pupil: 1, slant: 0, happy: 0, love: 0 }, talk: 0.5 }), audio: () => null };
const draw = (c, at, env = ENV) => { const f = ledFrame(env.cols, env.rows); c.draw(f, at); return f; };
const firstCol = (f) => { for (let x = 0; x < f.cols; x++) for (let y = 0; y < f.rows; y++) if (f.lit[y * f.cols + x]) return x; return -1; };
const same = (a, b) => a.lit.every((v, i) => v === b.lit[i]);

test("LedBoard scenes: long text scrolls left through the board at its speed; short text stands", () => {
  const c = contentOf({ text: "HADİ'ye hoş geldin" }, ENV);
  assert.ok(c.length > 3000 && Number.isFinite(c.length));
  assert.equal(firstCol(draw(c, 0)), -1, "it starts just off the right edge");
  assert.ok(firstCol(draw(c, 300)) >= 20, "then enters from the right");
  assert.ok(firstCol(draw(c, 600)) < firstCol(draw(c, 300)), "and moves left");
  const r = contentOf({ text: "HADİ'ye hoş geldin", direction: "right" }, ENV);
  assert.ok(firstCol(draw(r, 300)) <= 0, "right: enters from the left");
  const s = contentOf({ text: "OK" }, ENV);
  assert.ok(same(draw(s, 0), draw(s, 1500)), "text that fits stands still");
  assert.equal(c.spoken(), "HADİ'ye hoş geldin");
});

test("LedBoard scenes: reduced motion pages the text instead of scrolling it", () => {
  const env = { ...ENV, still: true };
  const c = contentOf({ text: "HADİ'ye hoş geldin dostum" }, env);
  const p0 = draw(c, 0, env), p0b = draw(c, 1000, env), p1 = draw(c, 2300, env);
  assert.ok(same(p0, p0b), "a page stands");
  assert.ok(!same(p0, p1), "the next page replaces it");
  assert.ok(firstCol(p0) > 0, "each page is centered, not cut");
});

test("LedBoard data changes animate: a score's changed digits roll on the clock, then settle", () => {
  const score = signal([1, 0]);
  const c = contentOf({ score: () => score() }, ENV);
  const before = draw(c, 0);
  score.set([2, 0]);
  draw(c, 100); // the frame that sees the change starts the roll
  const mid = draw(c, 260), end = draw(c, 1000);
  assert.ok(!same(mid, end) && !same(mid, before), "between the old and the new score: rolling, not a jump");
  assert.ok(same(end, draw(c, 1200)), "it settles on the new score");
  assert.ok(same(draw(c, 1300, { ...ENV }), end));
  // reduced motion: the new score at once
  const still = { ...ENV, still: true }, s2 = signal([1, 0]), c2 = contentOf({ score: () => s2() }, still);
  draw(c2, 0, still); s2.set([5, 0]);
  assert.ok(same(draw(c2, 16, still), draw(c2, 2000, still)));
});

test("LedBoard scenes: emoji scale up, eyes draw a face, clock, countdown, ticker, effects", () => {
  const big = { ...ENV, cols: 64, rows: 16 };
  const e = contentOf({ emoji: "heart" }, big), f = draw(e, 1000, big);
  assert.ok([...f.lit].filter(Boolean).length > 100, "8 × 8 drawn twice as big on 16 rows");
  assert.equal(e.spoken(), "heart");
  assert.ok(draw(contentOf({ eye: "open" }, ENV), 0).lit.some(Boolean));
  assert.equal(contentOf({ eye: "look-left" }, ENV).spoken(), "Eyes looking left");
  assert.match(contentOf({ clock: "HH:mm" }, ENV).spoken(), /^Time \d\d:\d\d$/);
  assert.equal(contentOf({ countdown: Date.now() - 1, done: "GO" }, ENV).spoken(), "GO");
  assert.match(contentOf({ countdown: Date.now() + 65_000 }, ENV).spoken(), /^01:0[45]$/);
  assert.equal(contentOf({ ticker: ["A", "B"] }, ENV).spoken(), "A • B");
  const bl = contentOf({ text: "OK", effect: "blink" }, ENV);
  assert.ok(draw(bl, 100).lit.some(Boolean) && !draw(bl, 800).lit.some(Boolean), "blink: on, then off");
  const rb = draw(contentOf({ text: "OK", effect: "rainbow" }, ENV), 0);
  assert.ok(new Set([...rb.rgb].filter(Boolean)).size > 2, "rainbow: many colors");
  const tw = contentOf({ text: "HELLO", effect: "typewriter" }, ENV);
  assert.ok([...draw(tw, 10).lit].filter(Boolean).length < [...draw(tw, 5000).lit].filter(Boolean).length, "typewriter: letters appear");
  assert.ok(hueColor(0) !== hueColor(120));
});

test("LedBoard transitions mix two frames LED by LED", () => {
  const a = ledFrame(10, 4), b = ledFrame(10, 4), out = ledFrame(10, 4);
  b.lit.fill(255);
  for (const kind of ["wipe", "dissolve", "rain", "iris", "cut"]) {
    mixFrames(out, a, b, 0, kind); assert.ok(!out.lit.some((v) => v === 255) || kind === "wipe", `${kind} at 0`);
    mixFrames(out, a, b, 1, kind); assert.ok(out.lit.every(Boolean), `${kind} at 1`);
  }
  mixFrames(out, a, b, 0.5, "wipe");
  assert.ok(out.lit[0] && !out.lit[9], "a wipe goes left to right");
  mixFrames(out, a, b, 0.5, "dissolve");
  assert.equal(!!out.lit[3], ledNoise(3, 0) < 0.5);
});

test("LedBoard: a focusable region with a live text, scenes advance on the clock, keys step and pause", () => {
  const seen = [];
  const [el, dispose] = mount(() => h(LedBoard, { scenes: [{ text: "A", duration: 500 }, { emoji: "star", duration: 500 }, { eye: "happy" }], cols: 32, rows: 8, transition: "dissolve", onScene: (i) => seen.push(i) }));
  const root = el.querySelector(".m-led-board");
  assert.equal(root.getAttribute("role"), "region");
  assert.equal(root.getAttribute("aria-roledescription"), "LED board");
  assert.equal(root.getAttribute("tabindex"), "0");
  const live = root.querySelector(".m-sr-only");
  assert.equal(live.getAttribute("aria-live"), "polite");
  assert.equal(live.textContent, "A");
  run(600);
  assert.equal(live.textContent, "star");
  root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.equal(live.textContent, "Happy eyes");
  root.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft", bubbles: true }));
  assert.equal(live.textContent, "star");
  root.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true }));
  assert.equal(root.getAttribute("data-paused"), "");
  run(2000);
  assert.equal(live.textContent, "star", "paused: the scene holds");
  assert.deepEqual(seen.slice(0, 2), [0, 1]);
  dispose();
});

test("LedBoard: text prop, no loop stays on the last scene, live off", () => {
  const [el, dispose] = mount(() => h(LedBoard, { text: "HI :heart:", live: "off", label: "Door sign" }));
  const root = el.querySelector(".m-led-board");
  assert.equal(root.getAttribute("aria-label"), "Door sign");
  assert.equal(root.querySelector(".m-led").style.getPropertyValue("--m-led-cols"), "64");
  assert.equal(root.querySelector(".m-led").getAttribute("role"), "img");
  assert.equal(root.querySelector(".m-sr-only").getAttribute("aria-live"), "off");
  assert.equal(root.querySelector(".m-sr-only").textContent, "HI heart");
  dispose();
  const [el2, dispose2] = mount(() => h(LedBoard, { scenes: [{ text: "A", duration: 300 }, { text: "B", duration: 300 }], loop: false, cols: 16, rows: 8 }));
  run(2000);
  assert.equal(el2.querySelector(".m-sr-only").textContent, "B");
  dispose2();
});
