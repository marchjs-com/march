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

test("setRestyleTransition: wraps setTheme / setColorTheme (an accent lands at once, outside it); apply runs once; off() removes it", () => {
  const calls = [];
  const off = U.setRestyleTransition((apply) => { calls.push(root.getAttribute("data-theme")); apply(); apply(); });
  U.setTheme("dark");
  assert.deepEqual(calls, [null], "the transition ran before the new look was written");
  assert.equal(root.getAttribute("data-theme"), "dark");
  U.setAccent("brand-blue");
  assert.equal(calls.length, 1, "an accent is not wrapped");
  assert.equal(root.getAttribute("data-m-accent"), "brand-blue");
  off();
  U.setTheme("light");
  assert.equal(calls.length, 1, "removed: the restyle lands directly");
  assert.equal(root.getAttribute("data-theme"), "light");
  // a transition that throws must not lose the change
  const off2 = U.setRestyleTransition(() => { throw new Error("no transition"); });
  U.setTheme("dark");
  assert.equal(root.getAttribute("data-theme"), "dark");
  off2();
  U.setTheme("system"); U.setAccent("primary");
});

test("setRestyleTransition prepare: runs before a setter changes anything (the old choice still in place), only for a new value", () => {
  const seen = [];
  const off = U.setRestyleTransition((apply) => apply(), () => seen.push([U.theme.peek(), U.colorTheme(), root.getAttribute("data-theme")]));
  U.setTheme("dark");
  assert.deepEqual(seen, [["system", seen[0][1], null]], "prepared while the old mode was still set");
  U.setTheme("dark");
  assert.equal(seen.length, 1, "the same value again: nothing to prepare");
  U.setAccent("brand-blue");
  assert.equal(seen.length, 1, "an accent needs no picture of the old look");
  off();
  U.setTheme("system"); U.setAccent("primary");
  assert.equal(seen.length, 1, "removed with its transition");
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

test("painted theme waves (spray, sweep, splat): no place left bare at the end; nothing painted at the start; layers that tween", async () => {
  const P = await import("../src/motion/theme-paint.ts");
  // how much paint a layer puts on a point (the pictures' gradient stops) at a moment of the wave
  const dot = (q) => (q < 0.38 ? 1 : q < 0.58 ? 1 - (q - 0.38) / 0.2 * 0.3 : q < 0.78 ? 0.7 - (q - 0.58) / 0.2 * 0.42 : q < 1 ? 0.28 * (1 - (q - 0.78) / 0.22) : 0);
  const ink = (l, t, x, y) => {
    const [bx, by, bw, bh] = l.box(t);
    if (bw <= 0 || bh <= 0) return 0;
    if (l.kind === "dot") return dot(Math.hypot((x - bx - bw / 2) / (bw / 2), (y - by - bh / 2) / (bh / 2)));
    if (x < bx || x > bx + bw || y < by || y > by + bh) return 0;
    if (l.kind === "blob") return Math.hypot((x - bx - bw / 2) / (bw / 2), (y - by - bh / 2) / (bh / 2)) <= 1 ? 1 : 0;
    return x >= bx && x <= bx + bw && y >= by && y <= by + bh ? 1 : 0;
  };
  for (const shape of ["spray", "sweep", "splat"]) {
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const layers = P.paintLayers(shape, 900, 600, { x: 100, y: 40 }, rnd);
    for (let x = 0; x <= 900; x += 15) for (let y = 0; y <= 600; y += 15) {
      const sum = layers.reduce((a, l) => a + ink(l, 1, x, y), 0);
      assert.ok(sum >= 0.95, `${shape}: bare at ${x},${y}: ${sum.toFixed(2)}`);
    }
    const area = (t) => layers.reduce((a, l) => { const [, , bw, bh] = l.box(t); return a + Math.max(0, bw) * Math.max(0, bh); }, 0);
    assert.ok(area(0) < 900 * 600 * 0.02, `${shape}: next to nothing painted at the start`);
    const frames = P.paintFrames(layers);
    assert.equal(frames.length, 17);
    assert.ok(frames.every((f) => f.maskSize.split(", ").length === layers.length + 1 && f.maskPosition.split(", ").length === layers.length + 1), `${shape}: the same layers in every keyframe`);
    const mask = P.paintMask(layers);
    assert.equal(mask.composite.split(", ")[0], "subtract");
    assert.equal(mask.image.split("gradient(").length - 1, layers.length + 1);
  }
});

test("drip: one outline of paint from the top, its edge waving, drips running ahead; the same path commands in every keyframe", async () => {
  const P = await import("../src/motion/theme-paint.ts");
  let seed = 3; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  const st = P.dripState(900, 600, rnd);
  assert.ok(st.at(0).edge.every(([, y]) => y <= 0), "nothing painted at the start");
  assert.ok(st.at(1).edge.every(([, y]) => y >= 600), "the screen is covered at the end");
  const mid = st.at(0.4).edge.map(([, y]) => y);
  assert.ok(Math.max(...mid) - Math.min(...mid) > 40, "the edge waves: its points come down at their own pace");
  assert.ok(st.dripsAt.length >= 2 && st.at(0.7).drips.some((d) => d.length > 30), "drips run ahead of the edge");
  // when each drip has run 60 px: not all at once
  const when = st.dripsAt.map((_, i) => { for (let t = 0; t <= 1; t += 0.01) if (st.at(t).drips[i].length >= 60) return t; return 1; });
  assert.ok(Math.max(...when) - Math.min(...when) > 0.1, "some drips are faster than others");
  const frames = P.liquidFrames(st, false);
  const shape = (f) => f.clipPath.replace(/-?[\d.]+/g, "");
  assert.ok(frames.every((f) => shape(f) === shape(frames[0])), "the same commands in every keyframe: the outline tweens");
  assert.match(frames[0].clipPath, /^path\(evenodd, "M-100 -100/, "the veil: the screen with the paint as a hole");
  assert.match(P.liquidFrames(st, true)[5].clipPath, /^path\("M/, "the paint itself (shine, shadow)");
});

test("painted wave: a live veil over the live page; the page takes the new look at once; the part loads lazily", async () => {
  globalThis.CSS = { supports: () => true };
  globalThis.getComputedStyle = () => ({ length: 1, 0: "--m-bg", colorScheme: "light", backgroundColor: "#fff", getPropertyValue: () => "#fff" });
  let observed = null;
  globalThis.MutationObserver = class { constructor(cb) { observed = cb; } observe() {} disconnect() {} takeRecords() { return []; } };
  const main = document.createElement("main"); main.id = "m";
  const para = document.createElement("p"); para.className = "t"; para.textContent = "old";
  main.appendChild(para); document.body.appendChild(main);
  const anims = [];
  const proto = Object.getPrototypeOf(document.body);
  const before = proto.animate;
  proto.animate = function (kf, o) { const a = { kf, o, cancel() {}, pause() {}, play() {}, addEventListener(type, fn) { if (type === "finish") a.done = fn; }, effect: { getTiming: () => ({}) } }; anims.push(a); return a; };
  let changed = 0;
  const wave = M.themeWave(() => { changed++; }, { shape: "drip" });
  for (let i = 0; i < 20 && !anims.length; i++) await tick(5);
  const veil = document.documentElement.querySelector(".m-wave-veil");
  assert.ok(veil, "the veil is up");
  assert.equal(changed, 1, "the page took the new look at once (no waiting)");
  assert.equal(veil.getAttribute("aria-hidden"), "true");
  assert.equal(veil.querySelector("[id]"), null, "no duplicate ids in the copy");
  assert.equal(veil.querySelector(".t")?.textContent, "old");
  assert.equal(veil.style.getPropertyValue("--m-bg"), "#fff", "the old look's tokens are on the veil");
  // live: a change of the page shows in the copy (after the first moments, which belong to the theme change itself)
  observed([{ type: "attributes", target: para, attributeName: "class" }]);
  await tick(150);
  para.setAttribute("class", "t is-on");
  observed([{ type: "attributes", target: para, attributeName: "class" }]);
  assert.equal(veil.querySelector(".t").getAttribute("class"), "t is-on", "the copy follows the page");
  // (the theme change's own update a moment ago was not copied: the first observation was dropped)
  const run = anims.find((a) => a.o?.duration === 1500);
  assert.ok(run, "the pour runs for 1500 ms");
  run.done(); await wave;
  assert.equal(document.documentElement.querySelector(".m-wave-veil"), null, "the veil is gone at the end");
  proto.animate = before; delete globalThis.CSS; delete globalThis.getComputedStyle; delete globalThis.MutationObserver;
  main.remove();
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

test("drip: time slows and picks up again also without frames (a hidden tab): the next theme change is not held back", async () => {
  const P = await import("../src/motion/theme-paint.ts");
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 0; // frames never come
  try {
    const within = (p, ms) => Promise.race([p.then(() => true), tick(ms).then(() => false)]);
    assert.ok(await within(P.warpTime(0, 40), 1500), "slowed to a stop without a frame");
    assert.ok(await within(P.warpTime(1, 40), 1500), "and back");
  } finally { globalThis.requestAnimationFrame = raf; }
});

test("drip with time stopped: where frames never come, the picture still goes (the transition is dropped) and the next change runs", async () => {
  const P = await import("../src/motion/theme-paint.ts");
  const raf = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = () => 0; // a page that is not drawn
  const vts = [];
  document.startViewTransition = (cb) => {
    cb();
    let skip;
    const finished = new Promise((r) => { skip = r; });
    const vt = { ready: Promise.resolve(), finished, skipTransition: () => { vt.skipped = true; skip(); } };
    vts.push(vt);
    return vt;
  };
  try {
    let changed = 0;
    const within = (p, ms) => Promise.race([p.then(() => true), tick(ms).then(() => false)]);
    assert.ok(await within(P.frozenDrip(document, () => changed++, { duration: 50 }), 6000), "the drip ends without frames");
    assert.equal(changed, 1);
    assert.ok(vts[0].skipped, "its transition was dropped");
    assert.equal(root.hasAttribute("data-m-wave"), false);
    // not held: the next change runs as a drip of its own (a stuck one would apply it at once, without a transition)
    void P.frozenDrip(document, () => changed++, { duration: 50 });
    await tick(800);
    assert.equal(vts.length, 2, "the next change starts its own transition");
  } finally { globalThis.requestAnimationFrame = raf; delete document.startViewTransition; }
});
