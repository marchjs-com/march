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
