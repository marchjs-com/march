import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { signal, createRoot } = await import("../core/reactive.ts");
const E = await import("../motion/engine/clock.ts");
const { setReducedOverride } = await import("../motion/engine/prefs.ts");
const { audioSource, toAudioSource, isAudioSource } = await import("./index.ts");
E.manualClock(true);

test("audioSource: a number input gives level, bands, channels, waveform and spectrum while used", () => {
  const v = signal(0.5);
  createRoot((dispose) => {
    const s = audioSource(() => v(), { smoothing: 0 });
    assert.ok(isAudioSource(s));
    assert.equal(s.active(), true, "a number needs no start");
    const el = document.createElement("div"); document.body.append(el);
    let updates = 0; s.onUpdate(() => updates++);
    E.step(16);
    assert.equal(updates, 0, "nothing reads until something uses it");
    s.use(el);
    E.step(16);
    assert.equal(updates, 1);
    assert.ok(Math.abs(s.level() - 0.5) < 1e-9);
    assert.deepEqual([...s.channels()], [0.5, 0.5]);
    const w = s.waveform(); assert.equal(w.length, 2048);
    assert.ok(Math.max(...w) > 0.3 && Math.min(...w) < -0.3, "a shape, as loud as the number");
    const sp = s.spectrum(); assert.equal(sp.length, s.bins);
    const peakBin = sp.indexOf(Math.max(...sp));
    assert.ok(Math.abs((peakBin * s.sampleRate()) / 2048 - 220) < 50, "the tone is at 220 Hz");
    assert.ok(s.bands().bass > s.bands().treble);
    v.set(1); E.step(16);
    assert.equal(s.level(), 1);
    dispose();
  });
});

test("audioSource: smoothing falls slowly, rises at once; peak is unsmoothed; stop zeroes", () => {
  const v = signal(1);
  createRoot((dispose) => {
    const s = audioSource(() => v(), { smoothing: 0.5 });
    const el = document.createElement("div"); s.use(el);
    E.step(16); assert.equal(s.level(), 1);
    v.set(0); E.step(16);
    assert.equal(s.level(), 0.5, "halfway down");
    assert.equal(s.peak(), 0);
    v.set(1); E.step(16); assert.equal(s.level(), 1, "up at once");
    s.stop();
    assert.equal(s.level(), 0); assert.equal(s.active(), false);
    dispose();
  });
});

test("audioSource: reduced motion reads twice a second; releasing every user stops the readings", () => {
  const v = signal(0.2);
  createRoot((dispose) => {
    const s = audioSource(() => v());
    let n = 0; s.onUpdate(() => n++);
    const release = s.use(document.createElement("div"));
    setReducedOverride(true);
    for (let i = 0; i < 60; i++) E.step(16); // ~1 s
    assert.ok(n >= 1 && n <= 3, `about two readings (${n})`);
    setReducedOverride(null);
    release(); const before = n;
    E.step(16); E.step(16);
    assert.equal(n, before);
    dispose();
  });
});

test("audioSource: without Web Audio a real input reports unsupported instead of throwing", async () => {
  await createRoot(async (dispose) => {
    const s = audioSource("demo");
    assert.equal(s.active(), false);
    await s.start();
    assert.equal(s.error(), "unsupported");
    assert.equal(s.level(), 0);
    dispose();
  });
});

test("toAudioSource: keeps a source, makes one from an input and stops it with the owner", () => {
  createRoot((dispose) => {
    const a = audioSource(() => 0.3);
    assert.equal(toAudioSource(a), a);
    const b = toAudioSource(() => 0.3);
    assert.ok(isAudioSource(b) && b !== a);
    assert.equal(b.active(), true);
    dispose();
    assert.equal(b.active(), false, "stopped with the owner");
  });
});
