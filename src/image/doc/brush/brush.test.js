import { test } from "node:test";
import assert from "node:assert/strict";
const D = await import("../index.ts");
const E = await import("./engine.ts");
const T = await import("./tips.ts");
const P = await import("./presets.ts");
const A = await import("./abr.ts");
const { ImageDocument, Mask } = D;
const { BrushStroke, PaintSurface } = E;

const near = (a, b, eps = 1e-3, msg = "") => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≉ ${b}`);

/** A white document with an empty pixel layer on top (active). */
function setup(w = 200, h = 120) {
  const doc = new ImageDocument({ width: w, height: h, background: "white" });
  const layer = doc.newPixelLayer("Paint");
  doc.change("New Layer", () => doc.add(layer));
  return { doc, layer };
}

/** Paint one stroke (one history step) through the engine. */
function stroke(doc, layer, points, settings = {}, target = "layer") {
  doc.begin("Brush");
  const s = new BrushStroke(new PaintSurface(doc, layer, target), { preset: P.roundBrush(20, 1), seed: 7, ...settings });
  const [first, ...rest] = points;
  s.begin(first);
  for (const p of rest) s.move(p);
  s.end();
  doc.commit();
  return s;
}
const pt = (x, y, extra = {}) => ({ x, y, pressure: 1, pointerType: "mouse", ...extra });
const line = (x0, y0, x1, y1, n, extra = {}) => Array.from({ length: n + 1 }, (_, i) => pt(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, extra));

test("round tip: hardness profile (soft falls off with the cosine, hard is solid with a 1 px rim, 50 % keeps the inner half)", () => {
  const R = 30, r = { x: 0, y: 0, w: 61, h: 1 }, out = new Float32Array(61);
  const at = (h) => { T.rasterDab({ x: 30.5, y: 0.5, size: 2 * R, angle: 0, roundness: 1, flipX: false, flipY: false }, null, { hardness: h }, r, out); return [...out]; };
  const soft = at(0);
  near(soft[30], 1, 1e-6, "center");
  near(soft[45], 0.5, 0.02, "half radius");
  assert.ok(soft[59] < 0.01, "edge");
  for (let x = 31; x < 61; x++) assert.ok(soft[x] <= soft[x - 1] + 1e-6, "monotone");
  const hard = at(1);
  for (let x = 1; x < 60; x++) near(hard[x], 1, 1e-6, `hard ${x}`);
  near(T.roundFalloff(1, 1, R), 0.5, 1e-6, "rim");
  const half = at(0.5);
  for (let x = 16; x <= 45; x++) near(half[x], 1, 1e-6, "inner half solid");
  assert.ok(half[52] > 0 && half[52] < 1);
  // procedural and image tips sample at any size and angle
  const star = T.tipShape({ type: "procedural", gen: "star", seed: 1, res: 64 });
  const rr = { x: 0, y: 0, w: 40, h: 40 }, a = new Float32Array(1600);
  T.rasterDab({ x: 20, y: 20, size: 36, angle: 0.4, roundness: 1, flipX: true, flipY: false }, star, { hardness: 1 }, rr, a);
  assert.ok(a[20 * 40 + 20] > 0.9, "star center");
  assert.ok(a[1] === 0, "star corner");
  const spec = T.tipFromRGBA(2, 1, new Uint8Array([0, 0, 0, 255, 255, 255, 255, 255]));
  const img = T.tipShape(spec);
  near(img.alpha[0], 1); near(img.alpha[1], 0);
  assert.equal(JSON.parse(JSON.stringify(spec)).data, spec.data, "JSON-serializable");
});

test("spacing: a dab every spacing × size along the path, interpolated between samples", () => {
  const { doc, layer } = setup(300, 60);
  let dabs = 0;
  stroke(doc, layer, [pt(20, 30), pt(120, 30), pt(220, 30)], { preset: P.roundBrush(20, 1, { spacing: 0.25 }), collect: () => dabs++ });
  assert.equal(dabs, 1 + 200 / 5, "41 dabs over 200 px at 5 px");
  dabs = 0;
  const { doc: d2, layer: l2 } = setup(300, 60);
  stroke(d2, l2, [pt(20, 30), pt(220, 30)], { preset: P.roundBrush(20, 1, { spacing: 1 }), collect: () => dabs++ });
  assert.equal(dabs, 11);
});

test("pen pressure drives size (preset control) and the options-bar pressure switch", () => {
  const width = (pressure, settings) => {
    const { doc, layer } = setup(200, 100);
    stroke(doc, layer, [pt(100, 50, { pressure, pointerType: "pen" })], settings);
    let n = 0;
    for (let x = 0; x < 200; x++) if (layer.raster.get(x, 50)[3] > 0.5) n++;
    return n;
  };
  const preset = P.roundBrush(40, 1, { shape: { sizeControl: "pressure", minDiameter: 0 } });
  near(width(1, { preset }), 40, 1);
  near(width(0.25, { preset }), 10, 1);
  near(width(0.5, { preset: P.roundBrush(40, 1), pressureSize: true }), 20, 1);
  // a mouse has no pressure: full size
  const { doc, layer } = setup(200, 100);
  stroke(doc, layer, [pt(100, 50, { pressure: 0.5, pointerType: "mouse" })], { preset });
  let n = 0;
  for (let x = 0; x < 200; x++) if (layer.raster.get(x, 50)[3] > 0.5) n++;
  near(n, 40, 1);
});

test("symmetry: vertical mirrors across the center, radial repeats around it, mandala mirrors each segment", () => {
  const { doc, layer } = setup(200, 200);
  stroke(doc, layer, [pt(40, 60), pt(60, 70)], { fg: [1, 0, 0, 1], symmetry: { type: "vertical", cx: 100, cy: 100 } });
  for (const [x, y] of [[40, 60], [50, 65], [60, 70]]) assert.deepEqual(layer.raster.get(x, y), layer.raster.get(199 - x, y), `mirror of ${x},${y}`);
  assert.equal(layer.raster.get(100, 30)[3], 0);
  const b = setup(200, 200);
  stroke(b.doc, b.layer, [pt(100, 40)], { symmetry: { type: "radial", cx: 100, cy: 100, segments: 4 } });
  for (const [x, y] of [[100, 40], [160, 100], [100, 160], [40, 100]]) near(b.layer.raster.get(x, y)[3], 1, 1e-6, `radial ${x},${y}`);
  assert.equal(E.symmetryTransforms({ type: "mandala", cx: 0, cy: 0, segments: 6 }).length, 12);
  const c = setup(200, 200);
  stroke(c.doc, c.layer, [pt(60, 100)], { symmetry: { type: "both", cx: 100, cy: 100 } });
  near(c.layer.raster.get(140, 100)[3], 1, 1e-6);
});

test("opacity caps the stroke: overlapping dabs in one stroke never exceed it; flow builds up to it", () => {
  const { doc, layer } = setup(200, 80);
  const pts = [...line(20, 40, 180, 40, 16), ...line(180, 40, 20, 40, 16), ...line(20, 40, 180, 40, 16)];
  stroke(doc, layer, pts, { opacity: 0.5, flow: 1, fg: [0, 0, 1, 1], preset: P.roundBrush(30, 0, { spacing: 0.05 }) });
  let max = 0;
  for (let x = 0; x < 200; x++) for (let y = 0; y < 80; y++) max = Math.max(max, layer.raster.get(x, y)[3]);
  assert.ok(max <= 0.5 + 1 / 255, `max ${max}`);
  near(layer.raster.get(100, 40)[3], 0.5, 1 / 255);
  // a second stroke adds on top (the cap is per stroke)
  stroke(doc, layer, [pt(100, 40)], { opacity: 0.5, fg: [0, 0, 1, 1], preset: P.roundBrush(30, 1) });
  near(layer.raster.get(100, 40)[3], 0.75, 2 / 255);
  // low flow: one dab gives little, many dabs approach the opacity
  const f = setup(200, 80);
  stroke(f.doc, f.layer, [pt(100, 40)], { flow: 0.1, preset: P.roundBrush(30, 1) });
  near(f.layer.raster.get(100, 40)[3], 0.1, 1 / 255);
});

test("selection clips painting; transparency lock keeps alpha; pixels lock refuses; mask target paints the mask", () => {
  const { doc, layer } = setup(200, 80);
  doc.change("Select", () => { doc.selection = D.select.rectMask(doc, { x: 0, y: 0, w: 100, h: 80 }); });
  stroke(doc, layer, line(20, 40, 180, 40, 10), { fg: [1, 0, 0, 1] });
  near(layer.raster.get(60, 40)[3], 1, 1e-6);
  assert.equal(layer.raster.get(140, 40)[3], 0);

  const b = setup(200, 80);
  b.doc.change("Fill", () => b.layer.raster.fill({ x: 50, y: 20, w: 40, h: 40 }, [0, 1, 0, 1]));
  b.layer.locks.transparency = true;
  stroke(b.doc, b.layer, line(20, 40, 180, 40, 10), { fg: [1, 0, 0, 1] });
  assert.deepEqual(b.layer.raster.get(70, 40), [1, 0, 0, 1]);
  assert.equal(b.layer.raster.get(140, 40)[3], 0, "transparent stays transparent");
  b.layer.locks.transparency = false;
  b.layer.locks.pixels = true;
  assert.match(E.paintBlocker(b.doc, b.layer), /locked/);

  const c = setup(100, 60);
  c.doc.change("Mask", () => { c.layer.mask = { mask: new Mask(100, 60, 255), enabled: true, linked: true, density: 1, feather: 0 }; });
  stroke(c.doc, c.layer, [pt(50, 30)], { fg: [0, 0, 0, 1] }, "mask");
  assert.equal(c.layer.mask.mask.get(50, 30), 0, "black paints the mask");
  assert.equal(c.layer.mask.mask.get(5, 5), 255);
  assert.equal(c.layer.raster.get(50, 30)[3], 0, "the layer's pixels are untouched");
  c.doc.undo();
  assert.equal(c.layer.mask.mask.get(50, 30), 255);
});

test("one undo step per stroke, invalidation only over touched tiles", () => {
  const { doc, layer } = setup(600, 300);
  const before = doc.history.steps.length, rects = [];
  stroke(doc, layer, line(10, 10, 80, 20, 12), { invalidate: (r) => rects.push(r) });
  assert.equal(doc.history.steps.length, before + 1);
  assert.equal(doc.history.steps.at(-1).label, "Brush");
  assert.ok(rects.length > 0 && rects.every((r) => r.x + r.w <= 256 && r.y + r.h <= 256 && r.w <= 256));
  doc.undo();
  assert.equal(layer.raster.get(40, 15)[3], 0);
  doc.redo();
  assert.ok(layer.raster.get(40, 15)[3] > 0);
});

test("paint modes: multiply, behind, clear; the background layer erases to the background color", () => {
  const { doc, layer } = setup(100, 60);
  doc.change("Fill", () => layer.raster.fill({ x: 0, y: 0, w: 50, h: 60 }, [0.5, 0.5, 0.5, 1]));
  stroke(doc, layer, [pt(25, 30)], { mode: "multiply", fg: [0.5, 1, 1, 1] });
  near(layer.raster.get(25, 30)[0], 0.25, 1 / 255);
  near(layer.raster.get(25, 30)[1], 0.5, 1 / 255);
  stroke(doc, layer, [pt(50, 30), pt(70, 30)], { mode: "behind", fg: [1, 0, 0, 1] });
  assert.deepEqual(layer.raster.get(65, 30), [1, 0, 0, 1], "behind paints transparent pixels");
  near(layer.raster.get(45, 30)[0], 0.5, 1 / 255, "behind leaves opaque pixels");
  stroke(doc, layer, [pt(10, 10)], { mode: "clear" });
  assert.equal(layer.raster.get(10, 10)[3], 0);
  const bg = doc.layers[0];
  stroke(doc, bg, [pt(80, 50)], { mode: "clear", bg: [0, 0, 1, 1] });
  assert.deepEqual(bg.raster.get(80, 50), [0, 0, 1, 1]);
});

test("smoothing (average and pulled string) reduces jitter; catch-up ends at the pointer", () => {
  const jitter = (settings) => {
    const { doc, layer } = setup(400, 100);
    const ys = [];
    const pts = Array.from({ length: 60 }, (_, i) => pt(20 + i * 6, 50 + (i % 2 ? 6 : -6)));
    stroke(doc, layer, pts, { preset: P.roundBrush(4, 1, { spacing: 0.5 }), ...settings, collect: (r, a) => {
      let s = 0, w = 0;
      for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) { s += a[y * r.w + x] * (r.y + y + 0.5); w += a[y * r.w + x]; }
      if (w) ys.push(s / w);
    } });
    const mid = ys.slice(10, -10);
    return Math.sqrt(mid.reduce((s, y) => s + (y - 50) ** 2, 0) / mid.length);
  };
  const raw = jitter({ smoothing: 0 });
  const avg = jitter({ smoothing: 0.7, smoothingMode: "average" });
  const rope = jitter({ smoothing: 0.3, smoothingMode: "rope" });
  assert.ok(raw > 3, `raw ${raw}`);
  assert.ok(avg < raw / 2, `average ${avg} vs ${raw}`);
  assert.ok(rope < raw / 2, `rope ${rope} vs ${raw}`);
  const { doc, layer } = setup(400, 100);
  stroke(doc, layer, line(20, 50, 300, 50, 10), { smoothing: 0.5, smoothingMode: "rope" });
  assert.ok(layer.raster.get(299, 50)[3] > 0, "catch-up reaches the end");
});

test("airbrush builds up while held; texture, wet edges, scatter and color dynamics change the dabs", () => {
  const { doc, layer } = setup(100, 60);
  doc.begin("Airbrush");
  const s = new BrushStroke(new PaintSurface(doc, layer), { preset: P.roundBrush(20, 1, { airbrush: true }), flow: 0.1, seed: 1 });
  s.begin(pt(50, 30));
  const a0 = layer.raster.get(50, 30)[3];
  s.tick(500);
  const a1 = layer.raster.get(50, 30)[3];
  s.end();
  doc.commit();
  assert.ok(a1 > a0 * 3, `${a0} → ${a1}`);

  const t = setup(200, 100);
  stroke(t.doc, t.layer, [pt(100, 50)], { preset: P.roundBrush(80, 1, { texture: { pattern: "noise", depth: 1, mode: "multiply" } }) });
  const vals = new Set();
  for (let x = 80; x < 120; x++) vals.add(Math.round(t.layer.raster.get(x, 50)[3] * 255));
  assert.ok(vals.size > 5, "texture varies the coverage");

  const w = setup(200, 100);
  stroke(w.doc, w.layer, [pt(100, 50)], { preset: P.roundBrush(60, 1, { wetEdges: true }) });
  assert.ok(w.layer.raster.get(127, 50)[3] > w.layer.raster.get(100, 50)[3], "wet edges: rim darker than the center");

  const c = setup(300, 200);
  stroke(c.doc, c.layer, line(20, 100, 280, 100, 20), { preset: P.findBrush("leaves"), fg: [0, 0.6, 0, 1], bg: [0.8, 0.5, 0, 1], seed: 3 });
  const colors = new Set();
  let off = 0;
  for (let y = 0; y < 200; y++) for (let x = 0; x < 300; x++) { const p = c.layer.raster.get(x, y); if (p[3] > 0.9) { colors.add(p.slice(0, 3).map((v) => Math.round(v * 20)).join()); if (Math.abs(y - 100) > 40) off++; } }
  assert.ok(colors.size > 3, "color dynamics");
  assert.ok(off > 0, "scatter moves dabs off the path");
});

test("presets: ≥ 24 built-ins, JSON round trip, every tip renders", () => {
  assert.ok(P.BUILTIN_BRUSHES.length >= 24);
  const ids = new Set(P.BUILTIN_BRUSHES.map((b) => b.id));
  assert.equal(ids.size, P.BUILTIN_BRUSHES.length);
  for (const id of ["hard-round", "soft-round", "airbrush", "pencil", "ink", "marker", "chalk", "charcoal", "watercolor-wet-edge", "dry-brush", "spatter", "grass", "leaves", "stars", "clouds", "hair", "rake", "texture-noise", "calligraphy-flat", "mixer-wet", "smudge-stick", "eraser-soft"]) assert.ok(ids.has(id), id);
  for (const b of P.BUILTIN_BRUSHES) {
    assert.deepEqual(JSON.parse(JSON.stringify(b)), b);
    const { doc, layer } = setup(120, 120);
    stroke(doc, layer, line(30, 60, 90, 60, 4), { preset: b, size: 30 });
    assert.ok(layer.raster.bounds(), `${b.id} paints`);
  }
});

// ——— .abr ———

/** PackBits encoder (literal runs only plus repeats) for the synthetic files. */
function packBits(row) {
  const out = [];
  let i = 0;
  while (i < row.length) {
    let j = i;
    while (j < row.length - 1 && row[j + 1] === row[i] && j - i < 127) j++;
    if (j > i) { out.push((257 - (j - i + 1)) & 255, row[i]); i = j + 1; continue; }
    const start = i;
    while (i < row.length && i - start < 128 && !(i < row.length - 1 && row[i + 1] === row[i])) i++;
    out.push(i - start - 1, ...row.slice(start, i));
  }
  return out;
}
const be16 = (v) => [(v >> 8) & 255, v & 255];
const be32 = (v) => [(v >>> 24) & 255, (v >>> 16) & 255, (v >>> 8) & 255, v & 255];
const ascii = (s) => [...s].map((c) => c.charCodeAt(0));

function sampleV6(w, h, depth, compress, pixels) {
  const body = [...new Array(47).fill(0), ...be32(0), ...be32(0), ...be32(h), ...be32(w), ...be16(depth), compress];
  const bpp = depth / 8;
  if (!compress) body.push(...pixels);
  else {
    const rows = [];
    for (let y = 0; y < h; y++) rows.push(packBits(pixels.slice(y * w * bpp, (y + 1) * w * bpp)));
    for (const r of rows) body.push(...be16(r.length));
    for (const r of rows) body.push(...r);
  }
  const pad = (4 - (body.length % 4)) % 4;
  return [...be32(body.length), ...body, ...new Array(pad).fill(0)];
}

test(".abr v6: 8-bit RLE and 16-bit raw samples become image-tip presets; v2 sampled and v1 computed brushes", () => {
  const w = 5, h = 4, px8 = [];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) px8.push(x === 2 || y === 1 ? 255 : (x * 40) & 255);
  const px16 = [];
  for (let i = 0; i < 3 * 2; i++) px16.push(...be16(i * 13107)); // 0 … 65535
  const samp = [...sampleV6(w, h, 8, 1, px8), ...sampleV6(3, 2, 16, 0, px16)];
  const file = new Uint8Array([...be16(6), ...be16(1),
    ...ascii("8BIM"), ...ascii("desc"), ...be32(4), 0, 0, 0, 0,
    ...ascii("8BIM"), ...ascii("samp"), ...be32(samp.length), ...samp,
    ...ascii("8BIM"), ...ascii("patt"), ...be32(0)]);
  const presets = A.parseAbr(file, "Test.abr");
  assert.equal(presets.length, 2);
  const [a, b] = presets;
  assert.equal(a.tip.type, "image");
  assert.equal(a.tip.width, 5); assert.equal(a.tip.height, 4); assert.equal(a.size, 5);
  assert.deepEqual([...T.base64ToBytes(a.tip.data)], px8);
  assert.deepEqual([...T.base64ToBytes(b.tip.data)], [0, 51, 102, 153, 204, 255]);
  assert.equal(a.id, "abr-Test-0");
  // the imported tip paints
  const { doc, layer } = setup(60, 60);
  stroke(doc, layer, [pt(30, 30)], { preset: a, size: 40 });
  assert.ok(layer.raster.get(30, 30)[3] > 0.9);

  // v2: one computed and one sampled (named) brush
  const name = "Dot";
  const sampled = [...be32(0), ...be16(25), ...be32(name.length + 1), ...[...name].flatMap((c) => be16(c.charCodeAt(0))), ...be16(0), 1, ...new Array(8).fill(0), ...be32(0), ...be32(0), ...be32(2), ...be32(2), ...be16(8), 0, 9, 8, 7, 6];
  const computed = [...be32(0), ...be16(30), ...be16(19), ...be16(80), ...be16(45), ...be16(70)];
  const v2 = new Uint8Array([...be16(2), ...be16(2), ...be16(1), ...be32(computed.length), ...computed, ...be16(2), ...be32(sampled.length), ...sampled]);
  const [c, s2] = A.parseAbr(v2, "Old");
  assert.deepEqual([c.tip.type, c.size, c.spacing, c.roundness, c.angle, c.tip.hardness], ["round", 19, 0.3, 0.8, 45, 0.7]);
  assert.equal(s2.name, "Dot");
  assert.deepEqual([...T.base64ToBytes(s2.tip.data)], [9, 8, 7, 6]);
  assert.throws(() => A.parseAbr(new Uint8Array([0, 3, 0, 0])), /unsupported version/);
});
