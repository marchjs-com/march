// Morph family: container transform frames (clip + move, colour and radius blend), morphBack shows the source again,
// scale mode (shared element FLIP), icon outlines tween number by number, shape polygons share their point count.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";

installDom();
const M = await import("../src/motion/index.ts");
const P = await import("../src/motion/path.ts");

const boxEl = (x, y, w, h) => {
  const el = document.createElement("div");
  el.getBoundingClientRect = () => ({ left: x, top: y, width: w, height: h, right: x + w, bottom: y + h, x, y });
  document.body.append(el);
  return el;
};

test("morph: the target starts clipped to the source box and moved onto it; the source hides", async () => {
  const a = boxEl(0, 0, 100, 40), b = boxEl(200, 100, 300, 200);
  let frames;
  b.animate = (f) => { frames = f; return { pause() {}, play() {}, cancel() {}, finish() {}, currentTime: 0, playbackRate: 1, playState: "paused", effect: { getTiming: () => ({}), updateTiming() {} }, addEventListener() {}, updatePlaybackRate() {}, finished: Promise.resolve() }; };
  const pb = M.morph(a, b, { fadeContent: false });
  assert.equal(a.style.getPropertyValue("visibility"), "hidden");
  assert.match(frames[0].transform, /^translate\(-300px, -180px\)$/);
  assert.match(frames[0].clipPath, /^inset\(80px 100px round/);
  assert.match(frames[1].clipPath, /^inset\(0px 0px round/);
  pb.cancel();
  a.remove(); b.remove();
});

test("morph scale mode: translate + scale from the source box (FLIP)", () => {
  const a = boxEl(0, 0, 50, 50), b = boxEl(100, 0, 100, 100);
  let frames;
  b.animate = (f) => { frames = f; return { pause() {}, cancel() {}, currentTime: 0, playbackRate: 1, effect: { getTiming: () => ({}), updateTiming() {} }, addEventListener() {}, updatePlaybackRate() {}, finished: Promise.resolve() }; };
  const pb = M.morph(a, b, { mode: "scale", hideSource: false });
  assert.equal(frames[0].transform, "translate(-125px, -25px) scale(0.5, 0.5)");
  assert.equal(a.style.getPropertyValue("visibility"), "");
  pb.cancel(); a.remove(); b.remove();
});

test("morphBack: shows the source again when it ends", async () => {
  const a = boxEl(0, 0, 100, 40), b = boxEl(0, 0, 300, 200);
  a.style.setProperty("visibility", "hidden");
  const pb = M.morphBack(b, a, { duration: 10, fadeContent: false });
  pb.finish();
  await pb.finished;
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(a.style.getPropertyValue("visibility"), "");
  a.remove(); b.remove();
});

test("MORPH_ICONS: every pair has the same command list (tweens number by number)", () => {
  const names = Object.keys(M.MORPH_ICONS);
  const sig = (d) => P.parsePath(d).map((s) => s.c + s.v.length).join();
  for (const n of names) assert.equal(sig(M.MORPH_ICONS[n]), sig(M.MORPH_ICONS.play), n);
  const mix = M.interpolatePath(M.MORPH_ICONS.menu, M.MORPH_ICONS.close);
  assert.match(mix(0.5), /^M[\d. -]+L/);
});

test("shapePolygon: same point count for every shape; shapeMorph remembers the current shape", () => {
  const n = (s) => s.split(",").length;
  for (const s of ["circle", "square", "triangle", "diamond", "hexagon", "star", "blob", "flower"]) assert.equal(n(M.shapePolygon(s, 40)), 40, s);
  const el = document.createElement("div");
  const pb = M.shapeMorph(el, "star", { duration: 10 });
  assert.equal(el.getAttribute("data-hm-shape"), "star");
  pb.finish();
  assert.equal(el.style.getPropertyValue("clip-path"), M.shapePolygon("star", 60));
});

// what a morph may leave on an element: nothing (inline styles of the effects, the source's visibility)
const clean = (el) => ["transform", "clip-path", "background-color", "opacity", "visibility"].every((k) => !el.style.getPropertyValue(k));
const tick = () => new Promise((r) => setTimeout(r, 5));

test("morph ⇄ morphBack, 5 rounds: the source shows again, nothing stays on the target or its children", async () => {
  const a = boxEl(0, 0, 100, 40), b = boxEl(200, 100, 300, 200);
  b.append(document.createElement("h3"), document.createElement("p"));
  for (let i = 0; i < 5; i++) {
    const o = M.morph(a, b, { duration: 20 });
    assert.equal(a.style.getPropertyValue("visibility"), "hidden", `round ${i}: the source hides`);
    o.finish(); await o.finished;
    const c = M.morphBack(b, a, { duration: 20 });
    c.finish(); await c.finished; await tick();
    assert.ok(clean(a), `round ${i}: the source is back, unstyled`);
    assert.ok(clean(b) && [...b.children].every(clean), `round ${i}: no effect left on the target`);
  }
  a.remove(); b.remove();
});

test("morph: overlapping clicks (reopen while shrinking, two sources in a row) leave a clean state", async () => {
  const a = boxEl(0, 0, 100, 40), a2 = boxEl(0, 50, 100, 40), b = boxEl(200, 100, 300, 200);
  b.append(document.createElement("p"));
  // close, and reopen before the shrink ends: the shrink is cancelled, the source hidden by the new morph
  M.morph(a, b, { duration: 50 }).finish();
  const back = M.morphBack(b, a, { duration: 200 });
  const again = M.morph(a, b, { duration: 50 });
  assert.equal(back.state, "idle", "the shrink was cancelled");
  assert.equal(a.style.getPropertyValue("visibility"), "hidden");
  again.finish(); await again.finished; await tick();
  assert.ok(clean(b) && [...b.children].every(clean), `the reopened target carries no shrink effect: ${JSON.stringify([b, ...b.children].map((e) => ["transform", "clip-path", "background-color", "opacity", "visibility"].map((k) => e.style.getPropertyValue(k))))}`);
  // another source morphs into the same target mid-way: the first source shows again
  const m2 = M.morph(a2, b, { duration: 50 });
  assert.equal(a.style.getPropertyValue("visibility"), "", "the first source is visible again");
  assert.equal(a2.style.getPropertyValue("visibility"), "hidden");
  m2.finish();
  const c = M.morphBack(b, a2, { duration: 20 }); c.finish(); await c.finished; await tick();
  for (const el of [a, a2, b, ...b.children]) assert.ok(clean(el));
  a.remove(); a2.remove(); b.remove();
});

test("shared element and icon morphs: rapid clicks replace the running one, the last one wins", async () => {
  const t1 = boxEl(0, 0, 40, 40), t2 = boxEl(50, 0, 40, 40), big = boxEl(0, 100, 200, 200);
  for (let i = 0; i < 5; i++) { M.morph(i % 2 ? t1 : t2, big, { mode: "scale", hideSource: false, duration: 100 }); }
  const last = M.morph(t1, big, { mode: "scale", hideSource: false, duration: 20 });
  last.finish(); await last.finished;
  for (const el of [t1, t2, big]) assert.ok(clean(el));
  const ns = "http://www.w3.org/2000/svg", path = document.createElementNS(ns, "path");
  path.setAttribute("d", M.MORPH_ICONS.play);
  let p;
  for (let i = 0; i < 5; i++) p = M.morphIcon(path, i % 2 ? "play" : "pause", { duration: 50 });
  p.finish(); await p.finished;
  assert.equal(path.getAttribute("d"), M.MORPH_ICONS.pause);
  t1.remove(); t2.remove(); big.remove();
});
