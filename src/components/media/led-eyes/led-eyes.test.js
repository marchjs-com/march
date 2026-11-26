import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal, setLocale, createRoot } = await import("../../../index.ts");
const E = await import("../../../motion/engine/clock.ts");
const { configure } = await import("../../../motion/engine/config.ts");
const { ledFrame, ledAt } = await import("../led-matrix/frame.ts");
const { LedEyes } = await import("./index.ts");
const { drawFace, expressionState } = await import("./eyes.ts");
const { faceMotion } = await import("./face.ts");

setLocale("en");
E.manualClock(true);
configure({ reduce: "full" }, { persist: false });
const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };
const run = (ms) => { for (let i = 0; i < ms / 16; i++) E.step(16); };
const picture = (s, mouth = "none", cols = 24, rows = 10) => { const f = ledFrame(cols, rows); drawFace(f, s, mouth); return f; };
const count = (f) => [...f.lit].filter(Boolean).length;
const cols = (f) => { const xs = []; for (let x = 0; x < f.cols; x++) for (let y = 0; y < f.rows; y++) if (ledAt(f, x, y)) { xs.push(x); break; } return xs; };

test("drawFace: two eyes with pupils; looking moves them; closed is a line; love draws hearts", () => {
  const open = picture(expressionState("open"));
  const left = picture(expressionState("look-left")), right = picture(expressionState("look-right"));
  assert.ok(count(open) > 30);
  assert.ok(cols(left)[0] < cols(right)[0], "looking left moves the eyes left");
  const closed = picture(expressionState("closed"));
  assert.ok(count(closed) < count(open) / 2, "a closed eye is a thin line");
  assert.ok(count(picture(expressionState("sleepy"))) < count(open), "sleepy lids cover part of the eye");
  assert.notDeepEqual([...picture(expressionState("love")).lit], [...open.lit]);
  assert.notDeepEqual([...picture(expressionState("happy")).lit], [...open.lit]);
  assert.notDeepEqual([...picture(expressionState("angry")).lit], [...picture(expressionState("sad")).lit]);
});

test("drawFace: a mouth only on a tall screen; talk opens and closes", () => {
  const s = expressionState("open");
  assert.equal(count(picture(s, "smile", 24, 8)), count(picture(s, "none", 24, 8)), "8 rows: no room for a mouth");
  // LEDs lit in the bottom rows, where the mouth goes
  const tall = (m, talk) => { const f = ledFrame(32, 16); drawFace(f, s, m, talk); return [...f.lit.slice(11 * 32)].filter(Boolean).length; };
  assert.ok(tall("smile") > 0 && tall("smile") !== tall("grin"));
  assert.ok(tall("talk", 1) > tall("talk", 0), "an open talking mouth lights more LEDs");
});

const faceOf = (o) => {
  let m, stop;
  createRoot((dispose) => { stop = dispose; m = faceMotion(document.createElement("div"), { look: () => undefined, mouth: () => "none", follow: () => false, blinkEvery: () => undefined, ...o }); });
  return [m, stop];
};

test("faceMotion: a look change springs on the engine clock (not a jump); a blink closes then opens the lids", () => {
  const expr = signal("open");
  const [m, dispose] = faceOf({ expression: expr, alive: () => false, still: () => false });
  expr.set("look-right");
  E.step(16);
  const mid = m.state().x;
  assert.ok(mid > 0 && mid < 1, `moving, not jumped: ${mid}`);
  run(1500);
  assert.ok(Math.abs(m.state().x - 1) < 0.02);
  m.blink();
  run(64);
  assert.ok(m.state().lid > 0.5, "the lids came down");
  run(400);
  assert.equal(m.state().lid, 0, "and went up again");
  dispose();
});

test("faceMotion: motion off shows each expression at once and never blinks", () => {
  const expr = signal("open");
  const [m, dispose] = faceOf({ expression: expr, alive: () => true, blinkEvery: () => [10, 20], still: () => true });
  expr.set("look-up");
  assert.equal(m.state().y, -1);
  m.blink(); run(50);
  assert.equal(m.state().lid, 0);
  dispose();
});

test("LedEyes: an image named by its expression, the default size, taller with a mouth", () => {
  const expr = signal("look-left");
  const [el, dispose] = mount(() => [h(LedEyes, { expression: expr, alive: false }), h(LedEyes, { mouth: "smile", label: "Robot" })]);
  const [a, b] = el.querySelectorAll(".m-led");
  assert.equal(a.getAttribute("aria-label"), "Eyes looking left");
  assert.equal(a.style.getPropertyValue("--m-led-cols"), "32");
  assert.equal(a.style.getPropertyValue("--m-led-rows"), "12");
  assert.equal(b.style.getPropertyValue("--m-led-rows"), "16");
  assert.equal(b.getAttribute("aria-label"), "Robot");
  expr.set("surprised");
  assert.equal(a.getAttribute("aria-label"), "Surprised eyes");
  dispose();
});
