// play() (motion/play.ts): the light path must look exactly like the engine's animate().
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const { PLAY_EASE, play } = await import("../src/motion/play.ts");
const { ease, cssOf } = await import("../src/motion/engine/ease.ts");

test("play(): every named easing is the engine's own CSS curve", () => {
  for (const [name, css] of Object.entries(PLAY_EASE)) assert.equal(css, cssOf(ease(name)), name);
});

test("play(): without WAAPI the end state is kept (fill both), nothing for fill none", async () => {
  const style = new Map();
  const el = { style: { setProperty: (k, v) => style.set(k, v) } };
  const p = play(el, [{ opacity: 0, transform: "scale(.9)" }, { opacity: 1, transform: "none", offset: 1 }], { duration: 200, easing: "out" });
  await p.finished;
  assert.deepEqual([...style], [["opacity", "1"], ["transform", "none"]]);
  style.clear();
  play(el, { opacity: [0, 1] }, { duration: 200, easing: "out", fill: "none" });
  assert.equal(style.size, 0);
});

test("play(): a WAAPI element gets the CSS curve, the engine defaults (fill both) and no engine import", () => {
  let got = null;
  const el = { animate: (frames, opts) => { got = { frames, opts }; return { finished: Promise.resolve(), cancel() {}, finish() {}, addEventListener() {}, playbackRate: 1, effect: { getTiming: () => ({ iterations: 1 }) } }; } };
  play(el, { opacity: [0, 1] }, { duration: 160, easing: "expo" });
  assert.equal(got.opts.easing, PLAY_EASE.expo);
  assert.equal(got.opts.fill, "both");
  assert.equal(got.opts.duration, 160);
  const src = readFileSync(new URL("../src/motion/play.ts", import.meta.url), "utf8");
  assert.doesNotMatch(src, /^import (?!type)[^;]*engine\/playback/m, "the engine is only imported lazily");
});

test("components that only need a short effect use play(), not the engine", () => {
  for (const f of ["components/forms/segmented/index.ts", "components/landing/reveal/index.ts", "motion/engine/parts.ts", "motion/burst.ts", "components/typography/overflow-text/index.ts", "components/navigation/tabs/index.ts"]) {
    const src = readFileSync(new URL(`../src/${f}`, import.meta.url), "utf8");
    assert.doesNotMatch(src, /^import (?!type)[^;]*(engine\/playback|motion\/animate|router\/router)\.ts/m, f);
  }
});
