// Motion engine: value layer, easing, colors, drivers, playback / timeline, one clock, global control, CSS control,
// extension points and the 200-item stagger performance check. The clock is driven by hand (manualClock + step).
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";
installDom();
const E = await import("../src/motion/engine/index.ts");
const { createRoot, signal } = await import("../src/index.ts");

E.manualClock(true);
const run = (ms, frame = 16) => { for (let t = 0; t < ms; t += frame) E.step(Math.min(frame, ms - t)); };
const near = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;
beforeEach(() => { E.motion.resumeAll(); E.motion.reset(); });

/** A fake WAAPI on an element: records frames / timing and the time, rate and play state the engine sets. */
function fakeWaapi(el) {
  const made = [];
  el.animate = (frames, timing) => {
    let resolve; const a = {
      frames, timing, playbackRate: 1, currentTime: 0, playState: "paused", replaceState: "active", cancelled: false,
      finished: new Promise((r) => { resolve = r; }),
      play() { this.playState = "running"; }, pause() { this.playState = "paused"; },
      finish() { this.playState = "finished"; resolve(); }, cancel() { this.cancelled = true; this.playState = "idle"; },
      updatePlaybackRate(r) { this.playbackRate = r; },
    };
    made.push(a);
    return a;
  };
  return made;
}

test("easing: tokens, cubic-bezier, steps, spring → CSS linear(), bounce, linear() round trip", () => {
  assert.equal(E.ease("out").css, "cubic-bezier(0.33,1,0.68,1)");
  assert.equal(E.ease("--hm-ease-out"), E.ease("out"), "CSS token names resolve to the same easing");
  assert.equal(E.ease("var(--hm-ease-expo)"), E.ease("expo"));
  const cb = E.ease("cubic-bezier(.42,0,.58,1)");
  assert.ok(near(cb(0.5), 0.5) && cb(0.25) < 0.25 && cb(0.75) > 0.75);
  const st = E.steps(4, "end");
  assert.deepEqual([0, 0.24, 0.25, 0.99, 1].map(st), [0, 0, 0.25, 0.75, 1]);
  const sp = E.springEase({ stiffness: 180, damping: 9 });
  assert.ok(sp.duration > 500 && sp.duration < 5000, `spring duration ${sp.duration}`);
  assert.match(sp.css, /^linear\(0, .* 1\)$/);
  assert.ok(Math.max(...Array.from({ length: 50 }, (_, i) => sp(i / 50))) > 1.05, "an underdamped spring overshoots");
  assert.equal(sp(1), 1);
  const back = E.ease(sp.css);
  for (const t of [0.1, 0.3, 0.6, 0.9]) assert.ok(near(back(t), sp(t), 0.02), `linear() round trip at ${t}`);
  const b = E.bounceEase();
  assert.equal(b(0), 0); assert.equal(b(1), 1);
  assert.equal(E.ease("nope-not-an-easing"), E.ease("out"), "unknown names fall back");
  assert.equal(E.ease("easeOutCubic").css, E.ease("out").css, "old camelCase names still work");
});

test("colors mix in OKLab (premultiplied alpha) and come back as oklab()", () => {
  const out = [0, 0, 0, 0];
  assert.ok(E.parseColor("#fff", out)); assert.ok(near(out[0], 1, 1e-3) && near(out[3], 1));
  assert.ok(E.parseColor("rgb(255 0 0 / 50%)", out)); assert.ok(near(out[3], 0.5));
  assert.ok(E.parseColor("oklch(0.7 0.1 200)", out));
  assert.equal(E.parseColor("not a color", out), false);
  const mid = E.mixColor("#ff0000", "#0000ff", 0.5);
  assert.match(mid, /^oklab\(/);
  const L = Number(/oklab\(([\d.]+)/.exec(mid)[1]);
  assert.ok(L > 0.5, `OKLab midpoint stays bright (L=${L}); an sRGB mix would be a dark purple`);
  assert.equal(E.mixColor("#000", "transparent", 1), "oklab(0 0 0 / 0)");
});

test("tracks: numbers, vectors, strings with numbers, colors and discrete values; sampling reuses one buffer", () => {
  const [num, vec, str, col, disc] = E.normalize({
    a: [0, 10], v: [new Float32Array([0, 0, 1]), new Float32Array([1, 0.5, 0])], s: ["translate(0px, 10%) rotate(0deg)", "translate(100px, 20%) rotate(90deg)"],
    c: ["#000", "#fff"], d: ["block", "none"],
  }).map((r) => new E.Track(r, () => 0));
  num.sample(0.25); assert.equal(num.num(), 2.5);
  const buf = vec.out; vec.sample(0.5); assert.deepEqual([...vec.out], [0.5, 0.25, 0.5]); assert.equal(vec.out, buf, "same Float64Array every frame");
  str.sample(0.5); assert.equal(str.text(), "translate(50px, 15%) rotate(45deg)");
  col.sample(1); assert.equal(col.text(), "oklab(1 0 0)");
  disc.sample(0.4); assert.equal(disc.text(), "block"); disc.sample(0.6); assert.equal(disc.text(), "none");
  // implicit start: read from the target
  const [imp] = E.normalize([{ x: 10 }]).map((r) => new E.Track(r, () => 4));
  imp.sample(0.5); assert.equal(imp.num(), 7);
  // offsets and per-keyframe easing
  const [k] = E.normalize([{ x: 0 }, { x: 10, offset: 0.8, easing: "linear" }, { x: 20 }]).map((r) => new E.Track(r, () => 0));
  k.sample(0.4); assert.equal(k.num(), 5); k.sample(0.9); assert.equal(k.num(), 15);
});

test("object targets: values written in place on the shared clock; arrays and typed arrays are not replaced", () => {
  const pos = new Float32Array(2);
  const obj = { x: 0, pos, color: "#000" };
  const p = E.animate(obj, { x: [0, 100], pos: [new Float32Array([0, 0]), new Float32Array([10, 20])], color: ["#000", "#fff"] }, { duration: 100, easing: "linear" });
  run(50);
  assert.ok(near(obj.x, 50, 1e-9), `x ${obj.x}`);
  assert.equal(obj.pos, pos); assert.ok(near(pos[0], 5) && near(pos[1], 10));
  assert.match(obj.color, /^oklab\(/);
  run(60);
  assert.equal(obj.x, 100); assert.equal(p.state, "finished"); assert.equal(p.progress(), 1);
});

test("timeline: at / < / -= / labels / stagger, seek, reverse, rate, callbacks, finished", async () => {
  const a = { v: 0 }, b = { v: 0 }, items = [{ v: 0 }, { v: 0 }, { v: 0 }];
  const hits = [];
  const tl = E.timeline({ defaults: { duration: 100, easing: "linear" } })
    .add(a, { v: [0, 1] })                       // 0..100
    .label("mid")
    .add(b, { v: [0, 1] }, { at: "-=50" })        // 50..150
    .add(items, { v: [0, 1] }, { at: "<", stagger: 10 }) // 50..170
    .call(() => hits.push("end"), "mid+=60");
  assert.equal(tl.duration, 170);
  assert.equal(tl.labels.get("mid"), 100);
  tl.seek(75);
  assert.equal(a.v, 0.75); assert.equal(b.v, 0.25); assert.deepEqual(items.map((i) => i.v), [0.25, 0.15, 0.05]);
  tl.seek("mid"); assert.equal(a.v, 1); assert.equal(b.v, 0.5);
  tl.seek(0); tl.play(); run(170);
  assert.equal(tl.state, "finished"); assert.equal(items[2].v, 1); assert.deepEqual(hits, ["end"]);
  await tl.finished;
  tl.reverse(); run(85);
  assert.ok(near(a.v, 0.85, 1e-9), `reversed to ${a.v}`);
  tl.playbackRate = -2; run(40);
  assert.ok(near(a.v, 0.05, 1e-9) || a.v < 0.1, `faster backwards ${a.v}`);
  tl.cancel(); assert.equal(tl.state, "idle");
  // stagger helper
  const s = E.stagger(10, { from: "center" });
  assert.deepEqual([0, 1, 2, 3, 4].map((i) => s(i, 5)), [20, 10, 0, 10, 20]);
  const g = E.stagger(10, { grid: [3, 3], from: "center" });
  assert.equal(g(4, 9), 0); assert.ok(near(g(0, 9), 10 * Math.SQRT2));
});

test("one clock: global speed, pause / resume, slow motion — and the setting is saved", () => {
  const o = { v: 0 };
  E.animate(o, { v: [0, 1] }, { duration: 100, easing: "linear" });
  E.motion.config({ speed: 2 });
  assert.equal(JSON.parse(localStorage.getItem("hm-motion")).speed, 2, "persisted");
  run(25); assert.ok(near(o.v, 0.5, 1e-9), `speed 2: ${o.v}`);
  E.motion.pauseAll(); run(100); assert.ok(near(o.v, 0.5, 1e-9), "frozen while paused");
  assert.equal(E.motion.paused(), true);
  E.motion.resumeAll();
  E.motion.config({ speed: 1, slowMo: 0.5 }); run(50); assert.ok(near(o.v, 0.75, 1e-9), `slow motion: ${o.v}`);
  // springs / tweens of the old API run on the same clock
  const tgt = signal(0); let x;
  createRoot(() => { x = E.track(() => tgt(), { duration: 100, easing: "linear" }); });
  E.motion.config({ slowMo: 1 });
  tgt.set(10); run(50); assert.ok(near(x(), 5, 0.01), `track ${x()}`);
  E.motion.pauseAll(); run(100); assert.ok(near(x(), 5, 0.01));
  E.motion.resumeAll(); run(60); assert.equal(x(), 10);
});

test("reduced motion: animations jump to their end, essential ones still run, endless ones stay still", () => {
  E.motion.config({ reduce: "reduce" });
  assert.equal(E.reducedMotion(), true);
  assert.ok(document.documentElement.hasAttribute("data-hm-reduced"));
  const a = { v: 0 }, b = { v: 0 }, c = { v: 5 };
  E.animate(a, { v: [0, 1] }, { duration: 1000 });
  assert.equal(a.v, 1);
  E.animate(b, { v: [0, 1] }, { duration: 100, easing: "linear", essential: true });
  run(50); assert.ok(near(b.v, 0.5, 1e-9));
  const loop = E.animate(c, { v: [0, 1] }, { duration: 100, iterations: Infinity });
  run(50); assert.equal(c.v, 0); assert.equal(loop.state, "paused");
  E.motion.config({ reduce: "system" });
  assert.ok(!document.documentElement.hasAttribute("data-hm-reduced"));
});

test("DOM: WAAPI first — delay = position in the timeline, time / rate / play state follow the playback, will-change in and out", () => {
  const el = document.createElement("div");
  const made = fakeWaapi(el);
  const tl = E.timeline().add({}, { v: [0, 1] }, { duration: 200 }).add(el, { opacity: [0, 1], transform: ["scale(.5)", "none"] }, { at: 100, duration: 200, easing: "spring" });
  tl.play();
  assert.equal(made.length, 1);
  const a = made[0];
  assert.equal(a.timing.delay, 100);
  assert.match(a.timing.easing, /^(linear\(|cubic-bezier)/, "spring runs natively");
  assert.deepEqual(a.frames.map((f) => f.offset), [0, 1]);
  assert.equal(a.playState, "running");
  assert.equal(el.style.getPropertyValue("will-change"), "opacity, transform");
  E.motion.config({ speed: 0.5 }); assert.equal(a.playbackRate, 0.5);
  E.motion.pauseAll(); assert.equal(a.playState, "paused");
  E.motion.resumeAll(); assert.equal(a.playState, "running");
  tl.seek(150); assert.equal(a.currentTime, 150);
  tl.playbackRate = 2; assert.equal(a.playbackRate, 1);
  tl.finish();
  assert.equal(el.style.getPropertyValue("will-change"), "", "will-change removed at the end");
  tl.cancel(); assert.ok(a.cancelled);
  // colors go native as oklab() (CSS then mixes in OKLab too)
  const el2 = document.createElement("div"); const m2 = fakeWaapi(el2);
  E.animate(el2, { backgroundColor: ["#f00", "#00f"] }, { duration: 100 });
  assert.match(m2[0].frames[0].backgroundColor, /^oklab\(/);
});

test("DOM without WAAPI: the clock writes CSSOM (no style attribute) and fill: none restores the inline value", () => {
  const el = document.createElement("div");
  el.style.setProperty("transform", "translateX(3px)");
  const p = E.animate(el, { transform: ["translateX(0px)", "translateX(100px)"] }, { duration: 100, easing: "linear", fill: "none" });
  run(50);
  assert.equal(el.style.getPropertyValue("transform"), "translateX(50px)");
  run(60);
  assert.equal(p.state, "finished");
  assert.equal(el.style.getPropertyValue("transform"), "translateX(3px)", "fill none: back to the inline value");
  assert.equal(el.getAttribute("style"), null);
});

test("canvas2d and webgl: fields animate in place, one draw per frame after all writes, colors become vec4", () => {
  let draws = 0;
  const fakeCtx = { canvas: { width: 10, height: 10 } };
  const scene = E.canvas2d(fakeCtx, () => { draws++; }, { phase: 0, amp: 10 });
  const calls = [];
  const gl = { canvas: {}, useProgram() {}, getUniformLocation: (_, n) => n, uniform1f: (l, v) => calls.push([l, v]), uniform4fv: (l, v) => calls.push([l, [...v].map((x) => Math.round(x * 100) / 100)]), uniform2fv() {}, uniform3fv() {} };
  let glDraws = 0;
  const sky = E.webgl(gl, {}, { state: { uTime: 0, uColor: "#000" }, draw: () => { glDraws++; } });
  const tl = E.timeline({ defaults: { duration: 100, easing: "linear" } })
    .add(scene, { phase: [0, 1], amp: [10, 20] }, { at: 0 })
    .add(sky, { uTime: [0, 1], uColor: ["#000", "#fff"] }, { at: 0 });
  tl.play();
  const before = draws;
  E.step(16);
  assert.equal(draws - before, 1, "one draw for two fields");
  assert.ok(near(scene.state.phase, 0.16 * (1 + 0), 0.02));
  run(100);
  assert.equal(scene.state.amp, 20);
  assert.ok(glDraws >= 2);
  const last = calls.filter((c) => c[0] === "uColor").pop();
  assert.deepEqual(last[1], [1, 1, 1, 1]);
  assert.ok(calls.some((c) => c[0] === "uTime" && c[1] === 1));
});

test("keyframes(), presets and keyframesCss(): one CSS file from the registrations", () => {
  E.installPresets();
  E.keyframes("testIn", { opacity: [0, 1], transform: ["translateY(8px)", "translateY(0px)"] }, { duration: 250, easing: "spring" });
  E.preset("testInSlow", "testIn", { duration: 900 });
  assert.equal(E.getKeyframes("testInSlow").defaults.duration, 900);
  const css = E.keyframesCss({ names: ["testIn", "testInSlow", "spin"] });
  assert.match(css, /@keyframes hm-testIn \{\n {2}0% \{ opacity: 0; transform: translateY\(8px\); \}\n {2}100% \{ opacity: 1; transform: translateY\(0px\); \}\n\}/);
  assert.match(css, /\.hm-anim-testIn \{ animation: hm-testIn 250ms cubic-bezier\([^)]*\) 0ms 1 normal both; animation-timing-function: linear\(/);
  assert.match(css, /\.hm-anim-testInSlow \{ animation: hm-testIn 900ms/);
  assert.match(css, /\.hm-anim-spin \{ animation: hm-spin 1000ms linear 0ms infinite/);
  assert.match(css, /:root\[data-hm-reduced\]/);
  const o = { opacity: 0 };
  E.animate(o, "fadeIn", { duration: 100, easing: "linear" });
  run(50); assert.ok(near(o.opacity, 0.5, 0.01));
  assert.throws(() => E.animate({}, "noSuchKeyframes"), /unknown keyframes/);
});

test("defineMotion and defineDriver extend the engine", () => {
  E.defineMotion({
    easings: { snappy: "cubic-bezier(.2,.9,.1,1)" },
    keyframes: { nudge: { frames: { x: [0, 4] }, defaults: { duration: 100, easing: "linear" } } },
    presets: { nudgeSlow: { use: "nudge", duration: 200 } },
    characters: { sleepy: { durationScale: 3 } },
  });
  assert.equal(E.ease("snappy").css, "cubic-bezier(0.2,0.9,0.1,1)");
  const o = { x: 0 }; E.animate(o, "nudgeSlow"); run(100); assert.ok(near(o.x, 2, 1e-9));
  E.motion.config({ character: "sleepy", duration: 100 });
  const p = E.animate({ y: 0 }, { y: [0, 1] }, { autoplay: false });
  assert.equal(p.duration, 300, "the character scales the default duration");
  E.motion.config({ character: "calm" });
  assert.equal(E.animate({ y: 0 }, { y: [0, 1] }, { autoplay: false }).items[0].node.ease, E.ease("in-out"));
  const seen = [];
  class Sprite { constructor() { this.x = 0; } }
  E.defineDriver("sprite", { supports: (t) => t instanceof Sprite, apply: (t, tr) => { t.x = tr.num(); seen.push(tr.prop); }, read: (t) => t.x });
  const s = new Sprite(); E.animate(s, { x: [0, 10] }, { duration: 100, easing: "linear" }); run(50);
  assert.equal(s.x, 5); assert.ok(seen.includes("x"));
});

test("CSS animations and transitions follow the global speed and pause (getAnimations)", () => {
  const css = { playbackRate: 1, playState: "running", effect: { getTiming: () => ({ iterations: Infinity }) }, play() { this.playState = "running"; }, pause() { this.playState = "paused"; }, updatePlaybackRate(r) { this.playbackRate = r; }, finish() {} };
  document.getAnimations = () => [css];
  document.documentElement.getAnimations = () => [css];
  E.installCssControl();
  E.motion.config({ speed: 0.25 }); assert.equal(css.playbackRate, 0.25);
  E.motion.pauseAll(); assert.equal(css.playState, "paused");
  E.motion.resumeAll(); assert.equal(css.playState, "running");
  const c = E.cssAnimations(document.documentElement); c.rate(2); assert.equal(css.playbackRate, 0.5);
  c.pause(); assert.equal(css.playState, "paused");
  delete document.getAnimations;
});

test("off-screen JS targets are not written; one-shot read / write phases run read before write", () => {
  const order = [];
  E.mutate(() => order.push("write"));
  E.measure(() => order.push("read"));
  E.step(16);
  assert.deepEqual(order, ["read", "write"]);
  assert.equal(E.isVisible(null), true);
});

test("performance: a 200-item stagger builds and starts without a long task, JS frames stay cheap and allocation-free", () => {
  const els = Array.from({ length: 200 }, () => { const el = document.createElement("div"); fakeWaapi(el); return el; });
  let t0 = performance.now();
  const tl = E.timeline().add(els, { opacity: [0, 1], transform: ["translateY(20px)", "translateY(0px)"] }, { duration: 400, stagger: E.stagger(5, { from: "center" }) });
  tl.play();
  const startMs = performance.now() - t0;
  assert.ok(startMs < 50, `200 native animations started in ${startMs.toFixed(1)} ms (long task line: 50 ms)`);
  assert.ok(els.every((el) => el.animate && tl.items.length === 200));
  // JS path: 200 objects × 3 tracks per frame
  const objs = Array.from({ length: 200 }, () => ({ x: 0, y: 0, c: "#000" }));
  E.timeline().add(objs, { x: [0, 100], y: [0, 50], c: ["#000", "#3366ff"] }, { duration: 1000, stagger: 2 }).play();
  const buf = E.timeline().add({ v: new Float32Array(3) }, { v: [new Float32Array([0, 0, 0]), new Float32Array([1, 1, 1])] }, { duration: 1000 });
  buf.play(); E.step(16);
  const outBefore = buf.items[0].node.tracks[0].out;
  const times = [];
  for (let i = 0; i < 30; i++) { t0 = performance.now(); E.step(16); times.push(performance.now() - t0); }
  times.sort((a, b) => a - b);
  const median = times[15];
  assert.ok(median < 8, `median JS frame for 200 targets: ${median.toFixed(2)} ms (budget 8 ms of a 16.7 ms frame)`);
  assert.equal(buf.items[0].node.tracks[0].out, outBefore, "same output buffer every frame");
  tl.cancel();
});

test("frameMonitor counts frames and dropped frames on the clock", () => {
  const m = E.frameMonitor();
  E.step(16); E.step(16);
  assert.ok(m.frames() >= 2);
  m.stop();
});
