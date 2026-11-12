// SVG motion family: path geometry (parse, flatten, sample, resample, interpolate), stroke drawing, path morph,
// motion along a path, clip reveals (RTL mirrored wipe) and SVG filters, all on the engine clock.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";

installDom();
const M = await import("../src/motion/index.ts");
const E = await import("../src/motion/engine/clock.ts");

test("parsePath: implicit repeats, relative commands", () => {
  const s = M.parsePath("M0 0 10 10 l5 5 5 5Z");
  assert.deepEqual(s.map((x) => x.c), ["M", "L", "l", "l", "Z"]);
  assert.equal(M.pathLength("M0 0H30V40"), 70);
});

test("pathSampler: points by distance and the tangent angle", () => {
  const at = M.pathSampler("M0 0H100V100");
  assert.deepEqual([at(0.25).x, at(0.25).y], [50, 0]);
  assert.equal(at(0.25).angle, 0);
  assert.deepEqual([at(0.75).x, at(0.75).y], [100, 50]);
  assert.equal(at(0.75).angle, 90);
  const c = M.pathSampler("M10 50A40 40 0 1 1 90 50");
  assert.ok(Math.abs(c(0.5).y - 10) < 1 && Math.abs(c(0.5).x - 50) < 1, "arc midpoint on top (sweep 1)");
});

test("resample: closed shapes get n points without repeating the start", () => {
  const r = M.resample("M0 0H10V10H0Z", 8);
  assert.equal(r.pts.length, 16);
  assert.equal(r.closed, true);
  assert.deepEqual(r.pts.slice(0, 4), [0, 0, 5, 0]);
});

test("interpolatePath: same commands tween numbers, others resample; ends are exact", () => {
  const same = M.interpolatePath("M0 0L10 0", "M0 10L20 0");
  assert.equal(same(0.5), "M0 5L15 0");
  const tri = "M0 0L10 0L5 10Z", star = "M5 0L6 4L10 4L7 6L8 10L5 8L2 10L3 6L0 4L4 4Z";
  const mix = M.interpolatePath(tri, star, { points: 20 });
  assert.equal(mix(0), tri);
  assert.equal(mix(1), star);
  const mid = mix(0.5);
  assert.match(mid, /^M[\d. -]+(L[\d. -]+){19}Z$/, "20 resampled points, closed");
});

test("drawPath: pathLength=1 dash, dashoffset from 1 to 0 on the engine", async () => {
  const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
  p.setAttribute("d", "M0 0H10");
  const pb = M.drawPath(p, { duration: 10 });
  assert.equal(p.getAttribute("pathLength"), "1");
  assert.ok(pb instanceof M.Playback);
  pb.finish();
  await pb.finished;
});

test("morphPath and followPath write attributes on the engine clock", async () => {
  E.manualClock(true);
  try {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", "M0 0L10 0");
    const a = M.morphPath(p, "M0 10L20 0", { duration: 100, easing: "linear" });
    E.step(50); E.step(1);
    assert.match(p.getAttribute("d"), /^M0 [\d.]+L[\d.]+ 0$/);
    a.finish();
    assert.equal(p.getAttribute("d"), "M0 10L20 0");
    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");
    const f = M.followPath(g, "M0 0H100", { duration: 100, easing: "linear", rotate: true });
    assert.equal(g.getAttribute("transform"), "translate(0 0)");
    f.finish();
    assert.equal(g.getAttribute("transform"), "translate(100 0)");
  } finally { E.manualClock(false); }
});

test("clipFrames: circle from an origin, wipe mirrors in RTL, blinds keep their point count", () => {
  assert.equal(M.clipAt(0, { shape: "circle", origin: { x: 0, y: 0 } }), "circle(0% at 0% 0%)");
  assert.equal(M.clipAt(0, { shape: "wipe", from: "start" }), "inset(0% 100% 0% 0%)");
  assert.equal(M.clipAt(0, { shape: "wipe", from: "start", rtl: true }), "inset(0% 0% 0% 100%)");
  const [a, b] = M.clipFrames({ shape: "blinds", count: 5 });
  assert.equal(a.clipPath.split(",").length, b.clipPath.split(",").length);
  assert.equal(M.clipFrames({ shape: "curtain", hide: true })[1].clipPath, "inset(0% 50% 0% 50%)");
});

test("svg filters: a filter per call, removed when it settles to 0; goo is static", async () => {
  const el = document.createElement("div");
  document.body.append(el);
  const pb = M.filterBlur(el, { from: 10, duration: 10 });
  assert.match(el.style.filter, /^url\(#hm-f-/);
  pb.finish();
  await pb.finished;
  assert.equal(el.style.filter, "");
  const off = M.goo(el, { blur: 8 });
  assert.match(el.style.filter, /^url\(#hm-f-/);
  off();
  assert.equal(el.style.filter, "");
  el.remove();
});
