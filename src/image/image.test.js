import { test } from "node:test";
import assert from "node:assert/strict";
const I = await import("./index.ts");
const { exposure } = await import("./ops/exposure.ts");
const { contrast } = await import("./ops/contrast.ts");
const { saturation } = await import("./ops/saturation.ts");
const { temperature } = await import("./ops/temperature.ts");

const close = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;
/** A 4×1 raster: black, mid grey, white, saturated red (8-bit encoded input). */
const sample = () => I.fromPixels({ width: 4, height: 1, data: new Uint8ClampedArray([0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255, 220, 40, 30, 255]) });

test("raster: encoded ↔ linear round trip is exact at 8 bits", () => {
  const px = new Uint8ClampedArray(256 * 4);
  for (let i = 0; i < 256; i++) px.set([i, 255 - i, (i * 7) & 255, 255], i * 4);
  const back = I.toPixels(I.fromPixels({ width: 256, height: 1, data: px }));
  assert.deepEqual([...back], [...px]);
});

test("ops are plain JSON values that carry their implementation", () => {
  const op = exposure(1);
  assert.deepEqual(JSON.parse(JSON.stringify(op)), { type: "exposure", params: { amount: 1 } });
  assert.equal(I.defOf(op).kind, "color");
  assert.equal(I.inert(exposure(0)), true, "0 EV changes nothing");
  assert.equal(I.inert({ ...exposure(1), on: false }), true, "switched off");
});

test("pipeline: one stop doubles linear light; the source is not changed; colour ops fuse into one LUT", () => {
  const src = sample();
  const before = src.data.slice();
  const out = I.render(src, [exposure(1)], { lutSize: 65 });
  assert.deepEqual([...src.data], [...before], "non-destructive");
  assert.ok(close(out.data[4], Math.min(1, src.data[4] * 2), 0.01), `grey ×2 (${out.data[4]} vs ${src.data[4] * 2})`);
  const stages = I.plan([exposure(1), contrast(20), saturation(-100)], { scale: 1, fullWidth: 4, fullHeight: 1 });
  assert.equal(stages.length, 1);
  assert.equal(stages[0].kind, "lut");
});

test("saturation −100 gives neutral greys; temperature keeps luminance", () => {
  const out = I.render(sample(), [saturation(-100)], { lutSize: 65 });
  const [r, g, b] = out.data.slice(12, 15);
  assert.ok(close(r, g, 0.01) && close(g, b, 0.01), `red became grey (${r} ${g} ${b})`);
  const warm = I.render(sample(), [temperature(60)], { lutSize: 65 });
  const y = (d, i) => I.luminance(d[i], d[i + 1], d[i + 2]);
  assert.ok(close(y(warm.data, 4), y(sample().data, 4), 0.01), "grey keeps its luminance");
  assert.ok(warm.data[4] > warm.data[6], "warmer: more red than blue");
});

test("mix blends an op with the image before it", () => {
  const half = I.render(sample(), [{ ...exposure(1), mix: 0.5 }], { lutSize: 65 });
  const full = I.render(sample(), [exposure(1)], { lutSize: 65 });
  const src = sample();
  assert.ok(close(half.data[4], (src.data[4] + full.data[4]) / 2, 0.01));
});

test("imageDoc: add, set merges a drag into one undo step, toggle, move, JSON, undo / redo", async () => {
  const doc = I.imageDoc();
  doc.set("exposure", { amount: 0.2 }, { merge: true, make: () => exposure() });
  doc.set("exposure", { amount: 0.4 }, { merge: true });
  doc.set("exposure", { amount: 0.6 }, { merge: true });
  assert.equal(doc.ops().length, 1);
  assert.equal(doc.find("exposure").params.amount, 0.6);
  assert.equal(I.defOf(doc.ops()[0]).type, "exposure", "keeps the implementation");
  const id = doc.add(contrast(10));
  doc.move(id, 0);
  assert.deepEqual(doc.ops().map((o) => o.type), ["contrast", "exposure"]);
  doc.toggle(id);
  assert.equal(doc.ops()[0].on, false);
  const json = doc.toJSON();
  assert.equal(json.version, 1);
  assert.equal(JSON.stringify(json).includes("march.image"), false);
  await doc.undo(); await doc.undo(); await doc.undo();
  assert.deepEqual(doc.ops().map((o) => [o.type, o.params.amount]), [["exposure", 0.6]], "three drags were one step");
  await doc.redo();
  assert.equal(doc.ops().length, 2);
});

test("presets: encode / decode a short shareable string", () => {
  const code = I.encodePreset([exposure(0.333333), { ...contrast(12), mix: 0.5 }], "Morning");
  assert.match(code, /^m1\.[A-Za-z0-9_-]+$/);
  const back = I.decodePreset(code);
  assert.equal(back.name, "Morning");
  assert.deepEqual(back.ops, [{ type: "exposure", params: { amount: 0.333 } }, { type: "contrast", params: { amount: 12 }, mix: 0.5 }]);
  assert.throws(() => I.decodePreset("hello"));
});

test(".cube: write and read back a LUT", () => {
  const lut = I.lutOf([contrast(30)], 9);
  const again = I.parseCube(I.toCube(lut, "C"));
  assert.equal(again.size, 9);
  assert.equal(again.title, "C");
  for (let i = 0; i < lut.data.length; i++) assert.ok(close(lut.data[i], again.data[i], 2e-4));
  assert.throws(() => I.parseCube("LUT_3D_SIZE 2\n0 0 0\n"));
});

test("histogram: counts, clipping, percentiles", () => {
  const h = I.histogram(sample());
  assert.equal(h.total, 4);
  assert.equal(h.l[0], 1);
  assert.equal(h.l[255], 1);
  assert.equal(h.clipLow, 0.25);
  assert.equal(I.percentile(h.l, 1), 255);
});

test("monotone curve table: passes through its points, never overshoots", () => {
  const t = I.curveTable([[0, 0], [0.25, 0.4], [0.5, 0.5], [1, 1]], 101);
  assert.ok(close(t[25], 0.4, 1e-3) && close(t[50], 0.5, 1e-3));
  for (let i = 1; i < t.length; i++) assert.ok(t[i] >= t[i - 1] - 1e-6, "monotone");
});

test("gl: half floats", async () => {
  const { toHalf } = await import("./gl.ts");
  assert.equal(toHalf(1), 0x3c00);
  assert.equal(toHalf(0), 0);
  assert.equal(toHalf(-2), 0xc000);
  assert.equal(toHalf(65504), 0x7bff);
});
