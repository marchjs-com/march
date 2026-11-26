import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { signal, createRoot } = await import("../core/reactive.ts");
const E = await import("../motion/engine/clock.ts");
const { audioSource, loudness, kWeighting, lufs, LUFS_FLOOR } = await import("./index.ts");
E.manualClock(true);

/** A fake source: its waveform is a sine of `amp` at `hz` (left), the right channel `phase`-shifted or `rightAmp`. */
function fake({ amp = 0.5, hz = 1000, rate = 48000, right = 1, phase = 0 } = {}) {
  const subs = new Set();
  return {
    bins: 1024, sampleRate: () => rate,
    waveform(out, ch = 0) {
      for (let i = 0; i < out.length; i++) out[i] = (ch === 1 ? amp * right : amp) * Math.sin((2 * Math.PI * hz * i) / rate + (ch === 1 ? phase : 0));
      return out;
    },
    onUpdate(fn) { subs.add(fn); return () => subs.delete(fn); },
    tick() { for (const fn of subs) fn(this); },
  };
}

test("kWeighting: about 0 dB at 1 kHz, +4 dB high up, a cut in the deep bass", () => {
  const [s, p] = kWeighting(48000);
  const gain = (f, rate = 48000) => {
    const w = (2 * Math.PI * f) / rate, re = (b) => b[0] + b[1] * Math.cos(-w) + b[2] * Math.cos(-2 * w), im = (b) => b[1] * Math.sin(-w) + b[2] * Math.sin(-2 * w);
    const mag = (c) => { const num = Math.hypot(re([c[0], c[1], c[2]]), im([c[0], c[1], c[2]])), den = Math.hypot(re([1, c[3], c[4]]), im([1, c[3], c[4]])); return num / den; };
    return 20 * Math.log10(mag(s) * mag(p));
  };
  assert.ok(Math.abs(gain(1000)) < 0.8, `1 kHz ${gain(1000)}`);
  assert.ok(Math.abs(gain(10000) - 4) < 0.6, `10 kHz ${gain(10000)}`);
  assert.ok(gain(20) < -10, `20 Hz ${gain(20)}`);
  assert.equal(lufs(0), LUFS_FLOOR);
  assert.ok(Math.abs(lufs(1) + 0.691) < 1e-9);
});

test("loudness: a full-scale 1 kHz sine in both channels reads about 0 LUFS; −20 dB reads about −20; correlation +1", () => {
  createRoot((dispose) => {
    const src = fake({ amp: 1 });
    const lu = loudness(src);
    for (let i = 0; i < 10; i++) { E.step(16); src.tick(); }
    assert.ok(Math.abs(lu.momentary() - 0) < 1, `momentary ${lu.momentary()}`);
    assert.ok(Math.abs(lu.shortTerm() - lu.momentary()) < 0.2);
    assert.ok(Math.abs(lu.correlation() - 1) < 1e-6);
    dispose();
  });
  createRoot((dispose) => {
    const src = fake({ amp: 0.1 });
    const lu = loudness(src);
    for (let i = 0; i < 40; i++) { E.step(16); src.tick(); }
    assert.ok(Math.abs(lu.momentary() + 20) < 1, `momentary ${lu.momentary()}`);
    assert.ok(Math.abs(lu.integrated() + 20) < 1, `integrated ${lu.integrated()}`);
    dispose();
  });
});

test("loudness: out of phase reads −1, unrelated about 0; silence reads the floor; reset forgets", () => {
  createRoot((dispose) => {
    const src = fake({ amp: 0.5, phase: Math.PI });
    const lu = loudness(src);
    E.step(16); src.tick();
    assert.ok(lu.correlation() < -0.99);
    dispose();
  });
  createRoot((dispose) => {
    const src = fake({ amp: 0.5, phase: Math.PI / 2 });
    const lu = loudness(src);
    E.step(16); src.tick();
    assert.ok(Math.abs(lu.correlation()) < 0.05, `90° ${lu.correlation()}`);
    lu.reset();
    assert.equal(lu.momentary(), LUFS_FLOOR);
    assert.equal(lu.integrated(), LUFS_FLOOR);
    dispose();
  });
  createRoot((dispose) => {
    const src = fake({ amp: 0 });
    const lu = loudness(src);
    E.step(16); src.tick();
    assert.equal(lu.momentary(), LUFS_FLOOR);
    assert.equal(lu.correlation(), 0);
    dispose();
  });
});

test("loudness: the momentary window is 400 ms, the short-term one 3 s; a real number source works", () => {
  createRoot((dispose) => {
    const src = fake({ amp: 1 });
    const lu = loudness(src);
    for (let i = 0; i < 100; i++) { E.step(16); src.tick(); }
    src.waveform = (out) => out.fill(0);
    for (let i = 0; i < 30; i++) { E.step(16); src.tick(); }
    assert.equal(lu.momentary(), LUFS_FLOOR, "400 ms of silence empties the momentary window");
    assert.ok(lu.shortTerm() > -10, "the short-term window still hears the tone");
    dispose();
  });
  const v = signal(0.6);
  createRoot((dispose) => {
    const s = audioSource(() => v());
    const lu = loudness(s);
    s.use(document.createElement("div"));
    for (let i = 0; i < 10; i++) E.step(16);
    assert.ok(lu.momentary() > -12 && lu.momentary() < -4, `tone ${lu.momentary()}`);
    assert.ok(lu.correlation() > 0.99, "a number source is mono");
    v.set(0.06);
    for (let i = 0; i < 40; i++) E.step(16);
    assert.ok(lu.momentary() < -25, "20 dB quieter");
    dispose();
  });
});
