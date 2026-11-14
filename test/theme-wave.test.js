// The shell helpers of the motion module: the theme wave (a page-wide restyle revealed by a growing circle, through
// the restyle hook of ui/restyle.ts) and the pointer spotlight over cards.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../src/testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const U = await import("../src/ui/index.ts");
const M = await import("../src/motion/index.ts");
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const root = document.documentElement;

test("setRestyleTransition: wraps setTheme / setColorTheme / setAccent; apply runs once; off() removes it", () => {
  const calls = [];
  const off = U.setRestyleTransition((apply) => { calls.push(root.getAttribute("data-theme")); apply(); apply(); });
  U.setTheme("dark");
  assert.deepEqual(calls, [null], "the transition ran before the new look was written");
  assert.equal(root.getAttribute("data-theme"), "dark");
  U.setAccent("brand-blue");
  assert.equal(calls.length, 2);
  assert.equal(root.getAttribute("data-m-accent"), "brand-blue");
  off();
  U.setTheme("light");
  assert.equal(calls.length, 2, "removed: the restyle lands directly");
  assert.equal(root.getAttribute("data-theme"), "light");
  // a transition that throws must not lose the change
  const off2 = U.setRestyleTransition(() => { throw new Error("no transition"); });
  U.setTheme("dark");
  assert.equal(root.getAttribute("data-theme"), "dark");
  off2();
  U.setTheme("system"); U.setAccent("primary");
});

test("themeWave: without View Transitions the change lands at once; with them it runs inside one, marked on <html>", async () => {
  let ran = 0;
  await M.themeWave(() => { ran++; });
  assert.equal(ran, 1);
  assert.equal(root.hasAttribute("data-m-wave"), false);

  // a View Transition stub: the callback runs later, `finished` resolves after it
  let finish;
  const frames = [];
  document.startViewTransition = (cb) => { const done = new Promise((r) => { finish = () => { cb(); r(); }; }); return { ready: Promise.resolve(), finished: done }; };
  root.animate = (kf, o) => { frames.push([kf, o]); return { cancel() {}, pause() {}, play() {}, addEventListener() {}, effect: { getTiming: () => ({}) }, updatePlaybackRate() {} }; };
  const wave = M.themeWave(() => { ran++; }, { origin: { x: 100, y: 40 }, duration: 300 });
  assert.equal(root.hasAttribute("data-m-wave"), true, "the browser's own cross-fade is off while the wave runs");
  assert.equal(ran, 1, "the change waits for the transition");
  await tick();
  assert.equal(frames.length, 1);
  assert.match(frames[0][0][0].clipPath, /^circle\(0px at 100px 40px\)$/);
  assert.match(frames[0][0][1].clipPath, /^circle\([\d.]+px at 100px 40px\)$/);
  assert.equal(frames[0][1].pseudoElement, "::view-transition-new(root)");
  assert.equal(frames[0][1].duration, 300);
  finish(); await wave;
  assert.equal(ran, 2);
  assert.equal(root.hasAttribute("data-m-wave"), false);

  // installThemeWave: every restyle goes through the wave, from the last pressed point
  const off = M.installThemeWave();
  const down = new Event("pointerdown", { bubbles: true }); down.clientX = 640; down.clientY = 20;
  document.body.dispatchEvent(down);
  U.setTheme("dark");
  assert.equal(root.hasAttribute("data-m-wave"), true);
  assert.notEqual(root.getAttribute("data-theme"), "dark", "not yet: the look changes inside the transition");
  await tick();
  assert.match(frames.at(-1)[0][0].clipPath, /at 640px 20px/);
  finish(); await tick(); await tick();
  assert.equal(root.getAttribute("data-theme"), "dark");
  off();
  U.setTheme("system");
  assert.equal(root.hasAttribute("data-theme"), false, "off(): directly again");
  delete document.startViewTransition; delete root.animate;
});

test("themeWave shape spray: the new snapshot is masked by patches that start at the press and end as a full mask", async () => {
  const W = await import("../src/motion/theme-wave.ts");
  let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const frames = W.sprayFrames(100, 40, 800, 600, rnd);
  assert.equal(frames.length, 31);
  assert.equal(frames[0].offset, 0);
  assert.match(frames[0].maskImage, /^linear-gradient\(transparent/, "nothing painted yet");
  assert.match(frames[3].maskImage, /radial-gradient\(circle at 100px 40px/, "the first burst is where the press was");
  const count = (f) => (f.maskImage.match(/radial-gradient/g) ?? []).length;
  assert.ok(count(frames[20]) > count(frames[5]), "the paint spreads");
  assert.equal(frames.at(-1).maskImage, "linear-gradient(#000, #000)", "it ends covering the screen");
  assert.equal(frames.at(-1).webkitMaskImage, frames.at(-1).maskImage);

  const anims = [];
  let finish;
  document.startViewTransition = (cb) => { const done = new Promise((r) => { finish = () => { cb(); r(); }; }); return { ready: Promise.resolve(), finished: done }; };
  root.animate = (kf, o) => { anims.push([kf, o]); return { cancel() {}, pause() {}, play() {}, addEventListener() {}, effect: { getTiming: () => ({}) }, updatePlaybackRate() {} }; };
  const wave = M.themeWave(() => {}, { origin: { x: 10, y: 10 }, shape: "spray" });
  await tick();
  assert.equal(anims.length, 1);
  assert.equal(anims[0][0].length, 31);
  assert.equal(anims[0][1].pseudoElement, "::view-transition-new(root)");
  assert.equal(anims[0][1].duration, 1100);
  finish(); await wave;
  delete document.startViewTransition; delete root.animate;
});

test("spotlight: every card near the pointer is lit from the pointer's place (also from the gap between two)", async () => {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const box = (l, t, w, h) => ({ left: l, top: t, right: l + w, bottom: t + h, width: w, height: h });
  const cards = [box(0, 0, 200, 100), box(220, 0, 200, 100), box(2000, 0, 200, 100)].map((r) => {
    const c = document.createElement("a"); c.className = "card"; c.getBoundingClientRect = () => r; host.appendChild(c); return c;
  });
  const off = M.spotlight(host, { selector: ".card", reach: 300 });
  const move = (x, y, type = "mouse") => { const e = new Event("pointermove", { bubbles: true }); e.clientX = x; e.clientY = y; e.pointerType = type; host.dispatchEvent(e); };
  move(210, 50); // in the gap between the first two
  await tick(30);
  assert.deepEqual(cards.map((c) => c.classList.contains("is-lit")), [true, true, false]);
  assert.ok(cards.every((c) => c.classList.contains("m-spotlight")), "the ready look is put on every card");
  assert.equal(cards[0].style.getPropertyValue("--m-spot-x"), "210px");
  assert.equal(cards[1].style.getPropertyValue("--m-spot-x"), "-10px", "the light comes from where the pointer really is");
  assert.equal(cards[1].style.getPropertyValue("--m-spot-y"), "50px");
  move(2100, 50, "touch"); await tick(30);
  assert.equal(cards[2].classList.contains("is-lit"), false, "touch pointers are ignored");
  move(2100, 50); await tick(30);
  assert.deepEqual(cards.map((c) => c.classList.contains("is-lit")), [false, false, true]);
  off();
  assert.equal(cards[2].classList.contains("is-lit"), false, "stopping puts the lights out");
  host.remove();
});
