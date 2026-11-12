// Page transition variants: registered names resolve from meta.transition (also as a function of params), each one
// gives keyframes for both sides, back reverses, the directional ones mirror in RTL, the pixel dissolve keeps one
// polygon shape across its stepped frames.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";

installDom();
const M = await import("../src/motion/index.ts");
M.usePageTransitions(...M.PAGE_VARIANTS);

test("registered variants resolve from meta.transition (string or function of params)", () => {
  const r = M.resolveTransition({}, { meta: { transition: "cube" } }, null, "forward");
  assert.equal(r.type, "cube");
  const f = M.resolveTransition({}, { meta: { transition: (p) => `${p.v}` }, params: { v: "blinds" } }, null, "forward");
  assert.equal(f.type, "blinds");
  assert.equal(M.resolveTransition({ type: "fade" }, { meta: { transition: "nope" } }, null, "forward").type, "fade", "unknown names fall back");
});

test("every variant has frames for both sides and both directions", () => {
  for (const v of M.PAGE_VARIANTS) for (const side of ["in", "out"]) for (const dir of ["forward", "back"]) {
    const f = M.transitionFrames(v.name, side, dir, false);
    assert.ok(Array.isArray(f) && f.length >= 2, `${v.name} ${side} ${dir}`);
    const offs = f.map((k) => k.offset).filter((o) => typeof o === "number");
    assert.deepEqual(offs, [...offs].sort((a, b) => a - b), `${v.name} ${side} ${dir}: offsets ascend`);
  }
});

test("back reverses: circle opens on the new page going forward, closes the old one going back (on top)", () => {
  const fin = M.transitionFrames("circle", "in", "forward");
  assert.match(fin[0].clipPath, /^circle\(0%/);
  assert.equal(fin[0].zIndex, 2);
  const bout = M.transitionFrames("circle", "out", "back");
  assert.match(bout.at(-1).clipPath, /^circle\(0%/);
  assert.equal(bout[0].zIndex, 2);
});

test("RTL mirrors wipe, cube and stack", () => {
  assert.notEqual(M.transitionFrames("wipe", "in", "forward", false)[0].clipPath, M.transitionFrames("wipe", "in", "forward", true)[0].clipPath);
  assert.notEqual(M.transitionFrames("cube", "in", "forward", false)[0].transform, M.transitionFrames("cube", "in", "forward", true)[0].transform);
  assert.equal(M.transitionFrames("stack", "in", "forward", true)[0].transform, "translateX(-100%)");
  assert.equal(M.transitionFrames("cube", "in", "forward", false)[0].transform, M.transitionFrames("cube", "in", "back", true)[0].transform, "back in RTL = forward in LTR");
});

test("pixel dissolve: stepped frames, one polygon with the same point count", () => {
  const f = M.transitionFrames("pixel", "in", "forward");
  assert.ok(f.length > 8);
  const n = f[0].clipPath.split(",").length;
  for (const k of f) { assert.equal(k.clipPath.split(",").length, n); assert.equal(k.easing, "steps(1, end)"); }
});
