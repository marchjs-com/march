// Behaviour of the image ops (colour, spatial, pixel), auto tone / white balance, looks and the on-demand registry.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const I = await import("../index.ts");
const { curves, CURVES } = await import("./curves.ts");
const { levels, LEVELS } = await import("./levels.ts");
const { hsl, HSL, HSL_BANDS } = await import("./hsl.ts");
const { colorBalance, COLOR_BALANCE } = await import("./color-balance.ts");
const { splitTone, SPLIT_TONE } = await import("./split-tone.ts");
const { bw } = await import("./bw.ts");
const { duotone } = await import("./duotone.ts");
const { gradientMap } = await import("./gradient-map.ts");
const { posterize } = await import("./posterize.ts");
const { threshold } = await import("./threshold.ts");
const { invert } = await import("./invert.ts");
const { lut, lutFromCube, LUT } = await import("./lut.ts");
const { clarity, CLARITY } = await import("./clarity.ts");
const { texture, TEXTURE } = await import("./texture.ts");
const { dehaze, DEHAZE } = await import("./dehaze.ts");
const { vignette, VIGNETTE } = await import("./vignette.ts");
const { grain, GRAIN } = await import("./grain.ts");
const { exposure } = await import("./exposure.ts");
const { autoTone } = await import("./auto-tone.ts");
const { autoWhiteBalance, whiteBalanceFrom } = await import("./auto-white-balance.ts");
const { LOOKS, look, randomLook } = await import("../looks.ts");
const { OP_TYPES } = await import("./index.ts");

const close = (a, b, eps = 1e-3) => Math.abs(a - b) <= eps;
const enc = (v) => I.toEncoded(Math.max(0, v));
/** A w×h test image from an encoded-colour function. */
const image = (w, h, f) => {
  const px = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const c = f(x, y); px.set([c[0], c[1], c[2], 255], (y * w + x) * 4); }
  return I.fromPixels({ width: w, height: h, data: px });
};
/** A colourful 32×32 test image: hue across, lightness down, plus fine checker detail. */
const photo = () => image(32, 32, (x, y) => {
  const h = (x / 32) * 6, l = 30 + (y / 31) * 200, k = (x + y) % 2 ? 12 : -12, t = h % 1;
  const seg = [[1, t, 0], [1 - t, 1, 0], [0, 1, t], [0, 1 - t, 1], [t, 0, 1], [1, 0, 1 - t]][Math.floor(h) % 6];
  return seg.map((s) => Math.max(0, Math.min(255, l * (0.45 + 0.55 * s) + k)));
});
/** One linear colour through a colour op directly (no LUT, no inert skipping). */
const colorOf = (def, params, rgb) => {
  const p = { ...def.defaults, ...params }, c = new Float32Array(rgb), data = def.prepare?.(p, { scale: 1, fullWidth: 1, fullHeight: 1 });
  if (def.colorWith) def.colorWith(c, p, data); else def.color(c, p);
  return [...c];
};
/** Run any op directly on a copy (identity checks must not rely on the pipeline skipping it). */
const direct = (def, params, src) => {
  const r = I.cloneRaster(src), p = { ...def.defaults, ...params }, ctx = { scale: 1, fullWidth: r.width, fullHeight: r.height };
  if (def.kind === "color") { for (let i = 0; i < r.data.length; i += 4) { const c = colorOf(def, params, r.data.subarray(i, i + 3)); r.data.set(c, i); } return r; }
  if (def.kind === "pixel") { const data = def.prepare?.(p, ctx); for (let y = 0, i = 0; y < r.height; y++) for (let x = 0; x < r.width; x++, i += 4) def.pixel(r.data, i, x, y, r.width, r.height, p, data); return r; }
  return def.run(r, p, ctx);
};
const maxDiff = (a, b) => { let m = 0; for (let i = 0; i < a.data.length; i++) m = Math.max(m, Math.abs(a.data[i] - b.data[i])); return m; };
const lstd = (r) => { const l = I.lightPlane(r); let s = 0, s2 = 0; for (const v of l) { s += v; s2 += v * v; } const m = s / l.length; return Math.sqrt(s2 / l.length - m * m); };
const chroma = (rgb) => { const o = [0, 0, 0]; I.linToOklab(Math.max(0, rgb[0]), Math.max(0, rgb[1]), Math.max(0, rgb[2]), o); return Math.hypot(o[1], o[2]); };
const RED = [I.toLinear(0.85), I.toLinear(0.15), I.toLinear(0.12)], BLUE = [I.toLinear(0.15), I.toLinear(0.25), I.toLinear(0.85)];
const grey = (e) => [I.toLinear(e), I.toLinear(e), I.toLinear(e)];

test("identity at defaults leaves pixels unchanged (run directly, not skipped)", () => {
  const src = photo();
  for (const def of [CURVES, LEVELS, HSL, COLOR_BALANCE, SPLIT_TONE, CLARITY, TEXTURE, DEHAZE, VIGNETTE, GRAIN, LUT]) {
    assert.ok(def.identity(def.defaults), `${def.type} defaults are identity`);
    if (def === LUT || def === DEHAZE) continue; // identity: the pipeline skips them (no table / amount 0)
    assert.ok(maxDiff(direct(def, {}, src), src) < 1e-3, `${def.type} changes nothing at defaults`);
  }
  assert.equal(DEHAZE.identity({ amount: 0 }), true);
});

test("curves: an S-curve darkens quarter tones and brightens three-quarter tones; per-channel curves act alone", () => {
  const S = { rgb: [[0, 0], [0.25, 0.18], [0.75, 0.82], [1, 1]] };
  assert.ok(enc(colorOf(CURVES, S, grey(0.25))[0]) < 0.2);
  assert.ok(enc(colorOf(CURVES, S, grey(0.75))[0]) > 0.8);
  const c = colorOf(CURVES, { r: [[0, 0], [0.5, 0.7], [1, 1]] }, grey(0.5));
  assert.ok(enc(c[0]) > 0.65 && close(enc(c[1]), 0.5, 2e-3) && close(enc(c[2]), 0.5, 2e-3));
});

test("levels: black point clips, gamma brightens midtones, one channel alone", () => {
  assert.ok(close(colorOf(LEVELS, { inBlack: 0.2 }, grey(0.15))[0], 0));
  assert.ok(enc(colorOf(LEVELS, { gamma: 1.5 }, grey(0.5))[0]) > 0.55);
  const c = colorOf(LEVELS, { channel: "b", outWhite: 0.5 }, grey(1));
  assert.ok(close(c[0], 1) && enc(c[2]) < 0.51);
});

test("hsl: band list; red band saturation −100 greys red and spares blue; luminance per band", () => {
  assert.equal(HSL_BANDS.length, 8);
  assert.deepEqual(HSL_BANDS.map((b) => b.id), ["red", "orange", "yellow", "green", "aqua", "blue", "purple", "magenta"]);
  const p = { saturation: [-100, 0, 0, 0, 0, 0, 0, 0] };
  assert.ok(chroma(colorOf(HSL, p, RED)) < chroma(RED) * 0.4, "red muted");
  assert.ok(close(chroma(colorOf(HSL, p, BLUE)), chroma(BLUE), 1e-3), "blue kept");
  const dark = colorOf(HSL, { luminance: [0, 0, 0, 0, 0, -100, 0, 0] }, BLUE);
  assert.ok(I.luminance(...dark) < I.luminance(...BLUE));
});

test("color-balance: redder highlights, luminance kept", () => {
  const src = grey(0.85), out = colorOf(COLOR_BALANCE, { highlights: [60, 0, 0] }, src);
  assert.ok(out[0] > out[2]);
  assert.ok(close(I.luminance(...out), I.luminance(...src), 1e-4));
});

test("split-tone: warm highlights, blue shadows", () => {
  const p = { highlightHue: 40, highlightSaturation: 100, shadowHue: 220, shadowSaturation: 100 };
  const hi = colorOf(SPLIT_TONE, p, grey(0.85)), lo = colorOf(SPLIT_TONE, p, grey(0.2));
  assert.ok(hi[0] > hi[2], "highlights warm");
  assert.ok(lo[2] > lo[0], "shadows blue");
});

test("bw: neutral grey out; the red weight brightens reds; tint colours it", () => {
  const r = I.render(image(1, 1, () => [220, 40, 30]), [bw()], { lutSize: 33 }).data;
  assert.ok(close(r[0], r[1], 2e-3) && close(r[1], r[2], 2e-3));
  const bright = I.render(image(1, 1, () => [220, 40, 30]), [bw({ red: 250 })], { lutSize: 33 }).data[0];
  const dark = I.render(image(1, 1, () => [220, 40, 30]), [bw({ red: 0 })], { lutSize: 33 }).data[0];
  assert.ok(bright > r[0] && dark < r[0]);
  const sepia = I.render(image(1, 1, () => [128, 128, 128]), [bw({ tintAmount: 80, tintHue: 35 })], { lutSize: 33 }).data;
  assert.ok(sepia[0] > sepia[2]);
});

test("duotone / gradient-map: black takes the first colour, white the last; tritone mid", () => {
  const src = image(3, 1, (x) => [[0, 0, 0], [255, 255, 255], [118, 118, 118]][x]);
  const out = I.toPixels(I.render(src, [duotone("#204080", "#ffe0a0")], { lutSize: 65 }));
  assert.ok(Math.abs(out[0] - 0x20) <= 3 && Math.abs(out[2] - 0x80) <= 3, `shadow ${[...out.slice(0, 3)]}`);
  assert.ok(Math.abs(out[4] - 0xff) <= 3 && Math.abs(out[6] - 0xa0) <= 3, `highlight ${[...out.slice(4, 7)]}`);
  const tri = I.toPixels(I.render(src, [duotone("#000000", "#ffffff", "#ff0000")], { lutSize: 65 }));
  assert.ok(tri[8] > tri[9] + 40, "mid is reddish");
  const g = I.toPixels(I.render(src, [gradientMap([{ at: 0, color: "#ff0000" }, { at: 1, color: "#0000ff" }])], { lutSize: 65 }));
  assert.ok(g[0] > 240 && g[6] > 240);
});

test("posterize, threshold, invert", () => {
  const p = I.toPixels(I.render(image(4, 1, (x) => [x * 70, x * 70, x * 70]), [posterize(2)], { lutSize: 65 }));
  for (let i = 0; i < 16; i += 4) assert.ok(p[i] < 3 || p[i] > 252, `posterized ${p[i]}`);
  const t = I.toPixels(I.render(image(2, 1, (x) => (x ? [140, 140, 140] : [90, 90, 90])), [threshold(0.45)], { lutSize: 65 }));
  assert.ok(t[0] < 3 && t[4] > 252);
  const src = photo(), twice = I.render(src, [invert(), invert()], { lutSize: 65 });
  assert.ok(maxDiff(twice, src) < 0.02);
  assert.ok(close(colorOf(I.getOp("invert"), {}, grey(0))[0], 1));
});

test("lut: a .cube round trip renders like the ops it came from; strength becomes mix", () => {
  const ops = [exposure(0.3), splitTone({ highlightHue: 30, highlightSaturation: 40 })];
  const cube = I.toCube(I.lutOf(ops, 33), "Test");
  const op = lutFromCube(cube, 0.5);
  assert.equal(op.mix, 0.5);
  assert.equal(op.params.title, "Test");
  const src = photo();
  // compared as display pixels: the .cube holds 0–1 values, the ops may leave the range before output clips
  const viaLut = I.toPixels(I.render(src, [lutFromCube(cube)], { lutSize: 33 })), viaOps = I.toPixels(I.render(src, ops, { lutSize: 33 }));
  let worst = 0; for (let i = 0; i < viaLut.length; i++) worst = Math.max(worst, Math.abs(viaLut[i] - viaOps[i]));
  assert.ok(worst <= 8, `lut ≈ ops (${worst} / 255)`);
  const json = JSON.parse(JSON.stringify(lut(I.parseCube(cube))));
  assert.equal(json.params.data.length, 33 ** 3 * 3);
});

test("clarity and texture add (+) or remove (−) local contrast", () => {
  const src = photo(), base = lstd(src);
  const big = image(64, 64, (x, y) => { const v = 60 + 120 * ((Math.floor(x / 8) + Math.floor(y / 8)) % 2) + ((x + y) % 2 ? 10 : -10); return [v, v * 0.9, v * 0.8]; });
  assert.ok(lstd(I.render(big, [clarity(80)])) > lstd(big));
  assert.ok(lstd(I.render(big, [clarity(-80)])) < lstd(big));
  assert.ok(lstd(I.render(src, [texture(100)])) > base);
  assert.ok(lstd(I.render(src, [texture(-100)])) < base);
});

test("dehaze removes a veil (+) and adds one (−)", () => {
  const scene = photo();
  const hazy = I.render(scene, [dehaze(-80)]);
  assert.ok(lstd(hazy) < lstd(scene), "haze flattens");
  const clear = I.render(hazy, [dehaze(100)]);
  assert.ok(lstd(clear) > lstd(hazy), "dehaze restores contrast");
  for (const v of clear.data) assert.ok(Number.isFinite(v));
});

test("vignette: corners darker, centre untouched; positive lightens", () => {
  const src = image(40, 20, () => [128, 128, 128]);
  const out = I.render(src, [vignette(-60)]);
  const at = (r, x, y) => r.data[(y * r.width + x) * 4];
  assert.ok(at(out, 0, 0) < at(src, 0, 0) * 0.8);
  assert.ok(close(at(out, 20, 10), at(src, 20, 10)));
  assert.ok(at(I.render(src, [vignette({ amount: 60, roundness: 100 })]), 0, 0) > at(src, 0, 0));
});

test("grain: deterministic per seed, keeps the mean, another seed another pattern", () => {
  const src = image(48, 48, () => [128, 128, 128]);
  const a = I.render(src, [grain(60)]), b = I.render(src, [grain(60)]), c = I.render(src, [grain({ amount: 60, seed: 9 })]);
  assert.deepEqual([...a.data], [...b.data]);
  assert.ok(maxDiff(a, src) > 0.01 && maxDiff(a, c) > 0.01);
  let s = 0; for (let i = 0; i < a.data.length; i += 4) s += a.data[i];
  assert.ok(close(s / (48 * 48), src.data[0], 0.02));
});

test("every op survives a JSON round trip and renders the same", () => {
  const src = photo();
  const all = [curves({ rgb: [[0, 0.1], [1, 0.9]] }), levels({ inBlack: 0.1, gamma: 1.2 }), hsl({ hue: [20, 0, 0, 0, 0, -30, 0, 0] }), colorBalance({ midtones: [10, -5, 20] }), splitTone({ highlightSaturation: 30 }),
    bw({ tintAmount: 20 }), duotone(), gradientMap(), posterize(5), threshold(0.5, 0.2), invert(), clarity(30), texture(30), dehaze(40), vignette(-40), grain(30)];
  for (const op of all) {
    const back = JSON.parse(JSON.stringify(op));
    assert.equal(back.type, op.type);
    assert.ok(maxDiff(I.render(src, [back]), I.render(src, [op])) < 1e-6, `${op.type} JSON renders the same`);
  }
});

test("autoTone widens a dull image's histogram", () => {
  const dull = image(32, 32, (x, y) => { const v = 100 + ((x * 3 + y * 5) % 50); return [v, v * 0.98, v * 0.95]; });
  const ops = autoTone(dull);
  assert.ok(ops.length > 0);
  assert.ok(ops.some((o) => o.type === "levels"));
  const before = I.histogram(dull), after = I.histogram(I.render(dull, ops));
  const spread = (h) => I.percentile(h.l, 0.99) - I.percentile(h.l, 0.01);
  assert.ok(spread(after) > spread(before) * 2, `${spread(before)} → ${spread(after)}`);
  for (const o of ops) assert.deepEqual(JSON.parse(JSON.stringify(o)).type, o.type);
});

test("white balance: a warm cast gives a cooler temperature; a picked neutral becomes grey", () => {
  const warm = image(16, 16, (x, y) => { const v = 40 + x * 10 + y * 3; return [Math.min(255, v * 1.25), v, v * 0.7]; });
  const [t] = autoWhiteBalance(warm);
  assert.equal(t.type, "temperature");
  assert.ok(t.params.amount < -5, `temperature ${t.params.amount}`);
  const picked = [0.5, 0.4, 0.3];
  const ops = whiteBalanceFrom(picked);
  const out = I.render(I.fromPixels({ width: 1, height: 1, data: new Uint8ClampedArray([...picked.map((v) => Math.round(I.toEncoded(v) * 255)), 255]) }), ops, { lutSize: 65 }).data;
  assert.ok(close(out[0], out[1], 0.02) && close(out[1], out[2], 0.02), `neutral ${[...out.slice(0, 3)]}`);
});

test("looks: every look renders without NaN, has ≤ 6 ops, strength becomes mix; random looks are repeatable", () => {
  const src = photo();
  const ids = ["vintage", "film", "sepia", "cool", "warm", "matte", "high-contrast", "cinematic", "night", "pastel", "faded", "drama", "noir"];
  assert.deepEqual(LOOKS.map((l) => l.id), ids);
  for (const l of LOOKS) {
    assert.ok(l.ops.length <= 6 && l.label);
    const out = I.render(src, look(l.id, 0.7));
    for (const v of out.data) assert.ok(Number.isFinite(v), `${l.id} renders finite values`);
    assert.ok(maxDiff(out, src) > 0.005, `${l.id} changes the image`);
  }
  assert.ok(look("film", 0.4).every((o) => close(o.mix, 0.4)));
  assert.ok(look("film").every((o) => o.mix === undefined));
  assert.deepEqual(look("nope"), []);
  assert.deepEqual(JSON.stringify(randomLook(42)), JSON.stringify(randomLook(42)));
  assert.notDeepEqual(JSON.stringify(randomLook(1)), JSON.stringify(randomLook(2)));
  for (const s of [1, 2, 3, 4, 5]) { const r = randomLook(s); assert.ok(r.ops.length <= 6); for (const v of I.render(src, r.ops).data) assert.ok(Number.isFinite(v)); }
});

test("ops/index registers every op module in src/image/ops/ for on-demand loading", async () => {
  const dir = fileURLToPath(new URL(".", import.meta.url));
  const modules = readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "index.ts" && !f.startsWith("auto-")).map((f) => f.slice(0, -3)).sort();
  assert.deepEqual([...OP_TYPES].sort(), modules);
  const src = readFileSync(new URL("./index.ts", import.meta.url), "utf8");
  for (const m of modules) {
    assert.ok(src.includes(`opLoader("${m}", () => import("./${m}.ts"))`), `${m} has a loader`);
    const mod = await import(`./${m}.ts`);
    assert.ok(Object.values(mod).some((v) => v && typeof v === "object" && v.type === m && v.kind), `${m}.ts defines the "${m}" op`);
  }
  await I.ensureOps(OP_TYPES.map((type) => ({ type, params: {} })));
  for (const t of OP_TYPES) assert.ok(I.getOp(t), `${t} registered`);
});
