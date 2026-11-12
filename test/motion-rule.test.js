// One engine for every animation: no private requestAnimationFrame loop, raw el.animate() or setInterval animation
// outside the motion engine — global speed, "Stop all" and reduced motion only reach what runs through it.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

const ROOT = new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1");
const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : /\.(ts|tsx|js|jsx)$/.test(f) ? [p] : []; });
const rel = (p) => relative(ROOT, p).replace(/\\/g, "/");

// where a raw call is the point (the engine itself, its native bridge, the test DOM) or is not an animation
const ALLOWED = {
  "src/motion/engine/clock.ts": "the one clock",
  "src/motion/engine/drivers.ts": "WAAPI driver",
  "src/motion/engine/native.ts": "native bridge (adopted by the global control)",
  "src/motion/page.ts": "View Transition pseudo-element driver",
  "src/testing/dom.ts": "test DOM shim",
  "src/router/router.ts": "scroll restoration after a page swap, not an animation",
  "src/ui/popover.ts": "positions a popover once after mount, not an animation",
  "examples/showcase/src/bench/paint.ts": "benchmark: time to the next paint, a measurement (global speed or stop-all must not change it)",
  "examples/showcase/src/bench/scenarios/runner.ts": "benchmark: each scenario step starts at a frame and is timed to its paint, a measurement (global speed or stop-all must not change it)",
};

test("animations go through the motion engine (inventory of raw requestAnimationFrame / el.animate / setInterval)", () => {
  const files = [...walk(join(ROOT, "src")), ...walk(join(ROOT, "examples/showcase/src"))];
  const bad = [];
  for (const f of files) {
    const r = rel(f);
    if (ALLOWED[r]) continue;
    const lines = readFileSync(f, "utf8").split(/\r?\n/);
    lines.forEach((line, i) => {
      const code = line.replace(/\/\/.*$/, "");
      if (/\brequestAnimationFrame\s*\(|[\w)\]]\.animate\s*\(\s*\[|\bel\.animate\s*\(/.test(code)) bad.push(`${r}:${i + 1}: ${line.trim()}`);
      // setInterval that changes something on screen every tick: use onFrame() / animate() instead
      if (/\bsetInterval\s*\(/.test(code) && /\$\w+\s*=|style|transform|width/.test(code)) bad.push(`${r}:${i + 1}: ${line.trim()}`);
    });
  }
  assert.deepEqual(bad, [], `use hadi-march/motion (animate, onFrame, frameLoop, animateEl):\n${bad.join("\n")}`);
});

test("animateEl: a component's raw animation follows the global speed, pause all and resume", async () => {
  const { installDom } = await import("../src/testing/dom.ts");
  installDom();
  const M = await import("../src/motion/index.ts");
  const stub = () => {
    const ls = {};
    return { playbackRate: 1, playState: "running", effect: { getTiming: () => ({ iterations: Infinity }) },
      updatePlaybackRate(r) { this.playbackRate = r; }, pause() { this.playState = "paused"; }, play() { this.playState = "running"; },
      addEventListener(t, f) { ls[t] = f; }, cancel() { ls.cancel?.(); } };
  };
  const el = { animate: () => stub() };
  M.motion.config({ speed: 2 }, { persist: false });
  const a = M.animateEl(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 100, iterations: Infinity });
  assert.equal(a.playbackRate, 2, "starts at the global speed");
  M.motion.config({ speed: 0.5 }, { persist: false });
  assert.equal(a.playbackRate, 0.5, "follows a speed change");
  M.motion.pauseAll();
  assert.equal(a.playState, "paused");
  const b = M.animateEl(el, [{ opacity: 0 }, { opacity: 1 }], { duration: 100, iterations: Infinity });
  assert.equal(b.playState, "paused", "one started while paused starts paused");
  M.motion.resumeAll();
  assert.equal(a.playState, "running"); assert.equal(b.playState, "running");
  a.cancel(); b.cancel();
  M.motion.reset();
});
