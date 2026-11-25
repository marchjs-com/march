import { test } from "node:test";
import assert from "node:assert/strict";
const D = await import("../index.ts");
const TT = await import("./tool.ts");
const PT = await import("./paint-tools.ts");
const H = await import("./heal.ts");
const B = await import("./brush-tools.ts");
const { ImageDocument } = D;
const { headlessContext, drag, sample, toolDefaults, getTool } = TT;

const near = (a, b, eps = 1e-3, msg = "") => assert.ok(Math.abs(a - b) <= eps, `${msg} ${a} ≉ ${b}`);
const tool = (id) => PT.PAINT_TOOLS.find((t) => t.id === id);

/** A document with a background and one pixel layer (active), optionally filled. */
function setup(w = 160, h = 100, fill = null, bg = "white") {
  const doc = new ImageDocument({ width: w, height: h, background: bg });
  const layer = doc.newPixelLayer("Paint");
  doc.change("New Layer", () => { doc.add(layer); if (fill) layer.raster.fill({ x: 0, y: 0, w, h }, fill); });
  return { doc, layer };
}
const ctxFor = (doc, t, options = {}, extra = {}) => {
  const said = [];
  const ctx = headlessContext(doc, { ...toolDefaults(t), ...options }, { announce: (s) => said.push(s), ...extra });
  ctx.shared.seed = 5;
  ctx.said = said;
  return ctx;
};
const line = (x0, y0, x1, y1, n = 10) => Array.from({ length: n + 1 }, (_, i) => [x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n]);
const lum = (p) => 0.299 * p[0] + 0.587 * p[1] + 0.114 * p[2];

test("installPaintTools registers every tool with options and defaults", () => {
  const remove = PT.installPaintTools();
  const ids = ["brush", "pencil", "color-replacement", "mixer-brush", "eraser", "background-eraser", "magic-eraser", "history-brush", "art-history-brush", "clone-stamp", "pattern-stamp", "spot-healing", "healing-brush", "patch", "content-aware-move", "red-eye", "blur", "sharpen", "smudge", "dodge", "burn", "sponge", "paint-bucket", "gradient"];
  for (const id of ids) { const t = getTool(id); assert.ok(t, id); assert.ok(t.options?.length, `${id} options`); assert.ok(Object.keys(toolDefaults(t)).length > 0); }
  assert.equal(PT.PAINT_TOOLS.length, ids.length);
  remove();
  assert.equal(getTool("brush"), undefined);
});

test("brush: one history step per stroke, paints the foreground; [ ] change the size; locks refuse", () => {
  const { doc, layer } = setup();
  const t = tool("brush"), ctx = ctxFor(doc, t, { size: 20, hardness: 100, smoothing: 0 });
  ctx.fg = [1, 0, 0, 1];
  const steps = doc.history.steps.length;
  drag(t, ctx, line(20, 50, 140, 50));
  assert.equal(doc.history.steps.length, steps + 1);
  assert.deepEqual(layer.raster.get(80, 50), [1, 0, 0, 1]);
  assert.equal(layer.raster.get(80, 80)[3], 0);
  t.key_(ctx, { key: "]", shift: false, alt: false, ctrl: false, meta: false, type: "down" });
  assert.equal(ctx.options.size, 25);
  layer.locks.pixels = true;
  drag(t, ctx, line(20, 20, 140, 20));
  assert.equal(doc.history.steps.length, steps + 1);
  assert.match(ctx.said.at(-1), /locked/);
  // airbrush tick keeps building while held
  layer.locks.pixels = false;
  const a = setup(), ta = tool("brush"), c2 = ctxFor(a.doc, ta, { size: 20, hardness: 100, flow: 10, airbrush: true });
  ta.down(c2, sample(50, 50));
  const before = a.layer.raster.get(50, 50)[3];
  ta.tick(c2, 400);
  ta.up(c2, sample(50, 50));
  assert.ok(a.layer.raster.get(50, 50)[3] > before * 3);
});

test("pencil paints hard pixels; auto erase paints the background color over the foreground", () => {
  const { doc, layer } = setup();
  const t = tool("pencil"), ctx = ctxFor(doc, t, { size: 5, smoothing: 0 });
  drag(t, ctx, line(10, 10, 150, 90, 20));
  let painted = 0;
  for (let y = 0; y < 100; y++) for (let x = 0; x < 160; x++) { const a = layer.raster.get(x, y)[3]; assert.ok(a === 0 || a === 1, `aliased ${a}`); if (a) painted++; }
  assert.ok(painted > 300);
  const c2 = ctxFor(doc, t, { size: 5, smoothing: 0, autoErase: true });
  drag(t, c2, line(10, 10, 60, 10 + 80 * 50 / 140, 5));
  assert.deepEqual(layer.raster.get(30, Math.round(10 + 80 * 20 / 140)), [1, 1, 1, 1]);
});

test("color replacement changes hue where the sampled color matches, keeps other colors", () => {
  const { doc, layer } = setup(160, 100, [0.8, 0.1, 0.1, 1]);
  doc.change("Green", () => layer.raster.fill({ x: 100, y: 0, w: 60, h: 100 }, [0.1, 0.7, 0.1, 1]));
  const t = tool("color-replacement"), ctx = ctxFor(doc, t, { size: 30, tolerance: 20, limits: "discontiguous", sampling: "once" });
  ctx.fg = [0.1, 0.1, 0.9, 1];
  drag(t, ctx, line(60, 50, 120, 50, 10), { });
  const p = layer.raster.get(70, 50);
  assert.ok(p[2] > p[0], `now blue ${p}`);
  near(lum(p), lum([0.8, 0.1, 0.1]), 0.08, "luminosity kept");
  const g = layer.raster.get(115, 50);
  assert.ok(g[1] > 0.6 && g[2] < 0.2, `green kept ${g}`);
});

test("mixer brush loads the foreground, picks up and mixes canvas paint", () => {
  const { doc, layer } = setup(160, 100, [1, 1, 0, 1]);
  const t = tool("mixer-brush"), ctx = ctxFor(doc, t, { size: 30, wet: 60, load: 50, mix: 50 });
  ctx.fg = [0, 0, 1, 1];
  drag(t, ctx, line(20, 50, 140, 50, 30));
  const start = layer.raster.get(25, 50), end = layer.raster.get(135, 50);
  assert.ok(start[2] > 0.3, `blue laid down ${start}`);
  assert.ok(start[2] > end[2], `paint runs out / mixes ${start} → ${end}`);
  assert.ok(ctx.shared.mixer.color, "reservoir");
  B.mixerClean(ctx);
  assert.equal(ctx.shared.mixer.color, null);
});

test("eraser: brush, block, background color on the background layer, erase to history", () => {
  const { doc, layer } = setup(160, 100, [0, 0.5, 0, 1]);
  const t = tool("eraser"), ctx = ctxFor(doc, t, { size: 20, hardness: 100, smoothing: 0 });
  drag(t, ctx, line(20, 50, 140, 50));
  assert.equal(layer.raster.get(80, 50)[3], 0);
  assert.equal(layer.raster.get(80, 10)[3], 1);
  drag(t, ctxFor(doc, t, { eraserMode: "block" }), [[30, 20], [60, 20]]);
  assert.equal(layer.raster.get(45, 20)[3], 0);
  // erase to history: back to the filled state (step 1 = the new layer with its fill)
  doc.history.brushSource = { step: 1 };
  drag(t, ctxFor(doc, t, { size: 20, hardness: 100, smoothing: 0, toHistory: true }), line(20, 50, 140, 50));
  near(layer.raster.get(80, 50)[1], 0.5, 1 / 255); near(layer.raster.get(80, 50)[3], 1, 1e-6);
  // on the background: the background color
  doc.setActive(doc.layers[0].id);
  const c = ctxFor(doc, t, { size: 20, hardness: 100, smoothing: 0 });
  c.bg = [0.2, 0.2, 0.2, 1];
  drag(t, c, [[80, 90], [90, 90]]);
  near(doc.layers[0].raster.get(85, 90)[0], 0.2, 1 / 255);
  near(doc.layers[0].raster.get(85, 90)[3], 1, 1e-6);
});

test("background eraser erases the sampled color, keeps the rest; magic eraser clears a flood region", () => {
  const { doc, layer } = setup(160, 100, [0.9, 0.1, 0.1, 1]);
  doc.change("Half", () => layer.raster.fill({ x: 80, y: 0, w: 80, h: 100 }, [0.1, 0.1, 0.9, 1]));
  const t = tool("background-eraser"), ctx = ctxFor(doc, t, { size: 40, sampling: "once", limits: "discontiguous", tolerance: 30 });
  drag(t, ctx, line(50, 50, 110, 50, 12));
  near(layer.raster.get(70, 50)[3], 0, 1e-6, "red erased");
  near(layer.raster.get(95, 50)[3], 1, 1e-6, "blue kept");
  const m = setup(160, 100, [1, 1, 1, 1]);
  m.doc.change("Square", () => m.layer.raster.fill({ x: 60, y: 30, w: 40, h: 40 }, [1, 0, 0, 1]));
  const tm = tool("magic-eraser");
  drag(tm, ctxFor(m.doc, tm, { tolerance: 10 }), [[5, 5]]);
  assert.equal(m.layer.raster.get(5, 5)[3], 0);
  assert.equal(m.layer.raster.get(80, 50)[3], 1);
  assert.equal(m.doc.history.steps.at(-1).label, "Magic Eraser");
});

test("history brush paints a past state back; art history brush paints strokes in the source colors", () => {
  const { doc, layer } = setup(160, 100, [1, 0, 0, 1]);
  doc.change("Blue", () => layer.raster.fill({ x: 0, y: 0, w: 160, h: 100 }, [0, 0, 1, 1]));
  doc.history.brushSource = { step: 1 };
  const t = tool("history-brush");
  drag(t, ctxFor(doc, t, { size: 20, hardness: 100, smoothing: 0 }), line(20, 50, 140, 50));
  assert.deepEqual(layer.raster.get(80, 50), [1, 0, 0, 1]);
  assert.deepEqual(layer.raster.get(80, 10), [0, 0, 1, 1]);
  const ta = tool("art-history-brush"), ctx = ctxFor(doc, ta, { size: 4, area: 30, style: "loose-medium" });
  drag(ta, ctx, line(40, 20, 120, 20, 8));
  let reds = 0;
  for (let y = 0; y < 40; y++) for (let x = 0; x < 160; x++) if (layer.raster.get(x, y)[0] > 0.5) reds++;
  assert.ok(reds > 50, `art strokes ${reds}`);
  doc.history.brushSource = null; // opening state: the layer did not exist yet
  const c = ctxFor(doc, t);
  drag(t, c, [[10, 10], [20, 20]]);
  assert.match(c.said.at(-1), /history state/);
});

test("clone stamp: Alt+click source, aligned offset, sample all layers, overlay preview", () => {
  const { doc, layer } = setup(200, 100);
  doc.change("Dot", () => layer.raster.fill({ x: 20, y: 20, w: 20, h: 20 }, [0, 0.8, 0, 1]));
  const t = tool("clone-stamp"), ctx = ctxFor(doc, t, { size: 10, hardness: 100, smoothing: 0 });
  drag(t, ctx, [[120, 30]]);
  assert.match(ctx.said.at(-1), /source/);
  t.down(ctx, sample(30, 30, { alt: true }));
  drag(t, ctx, [[130, 30], [131, 30]]);
  assert.deepEqual(layer.raster.get(130, 30), [0, 0.8, 0, 1]);
  // aligned: the next stroke keeps the offset (source 100 px to the left)
  drag(t, ctx, [[135, 35]]);
  assert.deepEqual(layer.raster.get(135, 35), [0, 0.8, 0, 1]);
  t.hover(ctx, sample(130, 30));
  const ov = t.overlay(ctx);
  assert.ok(ov.some((s) => s.type === "image") && ov.some((s) => s.type === "crosshair" && s.x === 30));
  // sample all layers: the white background comes along
  const c2 = ctxFor(doc, t, { size: 10, hardness: 100, sample: "all", aligned: false });
  t.down(c2, sample(80, 80, { alt: true }));
  drag(t, c2, [[150, 80]]);
  assert.deepEqual(layer.raster.get(150, 80), [1, 1, 1, 1]);
});

test("pattern stamp paints the pattern", () => {
  const { doc, layer } = setup(160, 100);
  const t = tool("pattern-stamp");
  drag(t, ctxFor(doc, t, { size: 40, hardness: 100, pattern: "checker" }), line(30, 50, 130, 50));
  const vals = new Set();
  for (let x = 30; x < 130; x++) vals.add(layer.raster.get(x, 50)[0].toFixed(2));
  assert.deepEqual([...vals].sort(), ["0.80", "1.00"]);
});

/** A mid-gray textured layer (noise) with a dark blemish. */
function blemish(w = 160, h = 120) {
  const s = setup(w, h);
  s.doc.change("Texture", () => {
    const px = new Float32Array(w * h * 4);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = 0.5 + 0.04 * Math.sin(x * 0.9) * Math.cos(y * 1.3); px.set([v, v, v, 1], (y * w + x) * 4); }
    s.layer.raster.write(0, 0, w, h, px);
    s.layer.raster.fill({ x: 76, y: 56, w: 8, h: 8 }, [0.05, 0.05, 0.05, 1]);
  });
  return s;
}

test("spot healing removes a blemish (proximity, texture, content-aware fallback and hook)", () => {
  for (const type of ["proximity", "texture", "content-aware"]) {
    const { doc, layer } = blemish();
    const t = tool("spot-healing");
    drag(t, ctxFor(doc, t, { size: 16, type }), [[80, 60], [80.5, 60]]);
    near(lum(layer.raster.get(80, 60)), 0.5, 0.08, type);
    near(lum(layer.raster.get(10, 10)), lum([0.5 + 0.04 * Math.sin(9) * Math.cos(13)].flatMap((v) => [v, v, v])), 2 / 255, "outside untouched");
    assert.equal(doc.history.steps.at(-1).label, "Spot Healing Brush");
  }
  const { doc, layer } = blemish();
  const t = tool("spot-healing");
  let called = false;
  const ctx = ctxFor(doc, t, { size: 16, type: "content-aware" });
  ctx.shared.fill = { contentAware: ({ pixels, width, height }) => { called = true; const out = pixels.slice(); for (let i = 0; i < width * height; i++) out.set([1, 0, 1, 1], i * 4); return out; } };
  drag(t, ctx, [[80, 60]]);
  assert.ok(called);
  assert.deepEqual(layer.raster.get(80, 60), [1, 0, 1, 1]);
});

test("healing brush: the source's texture takes the destination's color (Laplace solve)", () => {
  const { doc, layer } = setup(200, 100);
  doc.change("Two areas", () => {
    const px = new Float32Array(200 * 100 * 4);
    for (let y = 0; y < 100; y++) for (let x = 0; x < 200; x++) {
      const v = x < 100 ? 0.3 + ((x + y) % 2) * 0.1 : 0.75;
      px.set([v, v, v, 1], (y * 200 + x) * 4);
    }
    layer.raster.write(0, 0, 200, 100, px);
  });
  const t = tool("healing-brush"), ctx = ctxFor(doc, t, { size: 20, hardness: 100 });
  t.down(ctx, sample(50, 50, { alt: true }));
  drag(t, ctx, line(140, 50, 160, 50, 4));
  let s = 0, n = 0, min = 1, max = 0;
  for (let x = 145; x < 156; x++) { const v = layer.raster.get(x, 50)[0]; s += v; n++; min = Math.min(min, v); max = Math.max(max, v); }
  near(s / n, 0.8, 0.06, "destination color");
  assert.ok(max - min > 0.05, "source texture carried over");
  // the solver alone: a flat source into a gradient destination matches the border
  const w = 20, h = 20, src = new Float32Array(w * h * 4), dst = new Float32Array(w * h * 4), m = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { const x = i % w; src.set([0, 0, 0, 1], i * 4); dst.set([x / w, x / w, x / w, 1], i * 4); const y = (i / w) | 0; m[i] = x > 3 && x < 16 && y > 3 && y < 16 ? 1 : 0; }
  const out = H.healBlend(src, dst, m, w, h);
  near(out[(10 * w + 10) * 4], 10 / w, 0.02, "harmonic interpolation of a linear border is linear");
});

test("patch tool: lasso makes a selection, dragging it replaces the blemish with healed texture", () => {
  const { doc, layer } = blemish();
  const t = tool("patch"), ctx = ctxFor(doc, t);
  drag(t, ctx, [[70, 50], [90, 50], [90, 70], [70, 70]]);
  assert.ok(doc.selection && doc.selection.get(80, 60) === 255);
  drag(t, ctx, [[80, 60], [80, 30], [80, 25]]);
  near(lum(layer.raster.get(80, 60)), 0.5, 0.06);
  assert.equal(doc.history.steps.at(-1).label, "Patch");
});

test("content-aware move: the content moves, the hole is filled, the selection follows", () => {
  const { doc, layer } = setup(200, 120, [0.5, 0.5, 0.5, 1]);
  doc.change("Red", () => layer.raster.fill({ x: 40, y: 50, w: 20, h: 20 }, [0.9, 0.1, 0.1, 1]));
  doc.change("Select", () => { doc.selection = D.select.rectMask(doc, { x: 36, y: 46, w: 28, h: 28 }); });
  const t = tool("content-aware-move"), ctx = ctxFor(doc, t, { structure: 7 });
  drag(t, ctx, [[50, 60], [110, 60], [130, 60]]);
  const moved = layer.raster.get(130, 60), hole = layer.raster.get(50, 60);
  assert.ok(moved[0] > 0.7 && moved[1] < 0.3, `moved ${moved}`);
  near(hole[0], 0.5, 0.06, "hole filled");
  assert.equal(doc.selection.get(130, 60), 255);
  assert.equal(doc.selection.get(45, 60), 0);
});

test("red eye finds the red pupil and neutralizes it", () => {
  const { doc, layer } = setup(120, 120, [0.75, 0.6, 0.5, 1]);
  doc.change("Eye", () => {
    for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) if (Math.hypot(x - 62, y - 58) < 7) layer.raster.set(x, y, [0.85, 0.1, 0.12, 1]);
  });
  const t = tool("red-eye");
  drag(t, ctxFor(doc, t), [[60, 60]]);
  const p = layer.raster.get(62, 58);
  assert.ok(p[0] < 0.2, `red removed ${p}`);
  const skin = layer.raster.get(20, 20);
  near(skin[0], 0.75, 1 / 255, "skin untouched");
  const c = ctxFor(doc, t);
  drag(t, c, [[20, 100]]);
  assert.match(c.said.at(-1), /No red eye/);
});

/** A high-frequency checker layer. */
function checker() {
  const s = setup(120, 80);
  s.doc.change("Checker", () => { for (let y = 0; y < 80; y++) for (let x = 0; x < 120; x++) s.layer.raster.set(x, y, (x + y) % 2 ? [1, 1, 1, 1] : [0, 0, 0, 1]); });
  return s;
}
const variance = (layer, x0, x1, y) => { const v = []; for (let x = x0; x < x1; x++) v.push(layer.raster.get(x, y)[0]); const m = v.reduce((a, b) => a + b) / v.length; return v.reduce((a, b) => a + (b - m) ** 2, 0) / v.length; };

test("blur, sharpen and smudge (with the filters hook and the local fallback)", () => {
  const { doc, layer } = checker();
  const t = tool("blur");
  const v0 = variance(layer, 40, 80, 40);
  drag(t, ctxFor(doc, t, { size: 30, strength: 100 }), line(30, 40, 90, 40, 12));
  assert.ok(variance(layer, 40, 80, 40) < v0 / 3, "blurred");
  const b = checker();
  let used = 0;
  const ctx = ctxFor(b.doc, t, { size: 30, strength: 100 });
  ctx.shared.filters = { blur: (px) => { used++; return px.data.fill(0.5); } };
  drag(t, ctx, [[60, 40]]);
  assert.ok(used > 0);
  near(b.layer.raster.get(60, 40)[0], 0.5, 1 / 255);

  const s = setup(120, 80);
  s.doc.change("Ramp", () => { for (let y = 0; y < 80; y++) for (let x = 0; x < 120; x++) { const v = x < 55 ? 0.3 : x > 65 ? 0.7 : 0.3 + (x - 55) * 0.04; s.layer.raster.set(x, y, [v, v, v, 1]); } });
  const ts = tool("sharpen"), edge0 = s.layer.raster.get(66, 40)[0] - s.layer.raster.get(54, 40)[0];
  drag(ts, ctxFor(s.doc, ts, { size: 40, strength: 100, protectDetail: false }), line(60, 30, 60, 50, 8));
  const after = [];
  for (let x = 50; x < 70; x++) after.push(s.layer.raster.get(x, 40)[0]);
  assert.ok(Math.max(...after) - Math.min(...after) > edge0 + 0.02, `sharper ${edge0} → ${Math.max(...after) - Math.min(...after)}`);

  const m = setup(160, 80, [1, 0, 0, 1]);
  m.doc.change("Blue", () => m.layer.raster.fill({ x: 80, y: 0, w: 80, h: 80 }, [0, 0, 1, 1]));
  const tm = tool("smudge");
  drag(tm, ctxFor(m.doc, tm, { size: 20, strength: 80 }), line(60, 40, 110, 40, 25));
  const p = m.layer.raster.get(90, 40);
  assert.ok(p[0] > 0.2, `red dragged into blue ${p}`);
  const f = setup(160, 80, [1, 1, 1, 1]), cf = ctxFor(f.doc, tm, { size: 20, strength: 80, fingerPainting: true });
  cf.fg = [0, 1, 0, 1];
  drag(tm, cf, line(40, 40, 80, 40, 10));
  assert.ok(f.layer.raster.get(42, 40)[0] < 0.9, "finger painting starts with the foreground");
});

test("dodge lightens, burn darkens (range, protect tones), sponge (de)saturates", () => {
  const { doc, layer } = setup(160, 80, [0.5, 0.4, 0.3, 1]);
  const dodge = tool("dodge"), burn = tool("burn");
  drag(dodge, ctxFor(doc, dodge, { size: 30, exposure: 30 }), line(20, 20, 140, 20));
  drag(burn, ctxFor(doc, burn, { size: 30, exposure: 30 }), line(20, 60, 140, 60));
  const d = layer.raster.get(80, 20), b = layer.raster.get(80, 60), o = layer.raster.get(80, 40);
  assert.ok(lum(d) > lum(o) + 0.05 && lum(b) < lum(o) - 0.05, `${lum(d)} ${lum(o)} ${lum(b)}`);
  near(d[0] / d[1], 0.5 / 0.4, 0.05, "protect tones keeps the hue");
  const hl = setup(160, 80, [0.1, 0.1, 0.1, 1]);
  drag(dodge, ctxFor(hl.doc, dodge, { size: 30, exposure: 100, range: "highlights" }), line(20, 40, 140, 40));
  assert.ok(hl.layer.raster.get(80, 40)[0] < 0.12, "highlights range leaves shadows alone");

  const s = setup(160, 80, [0.9, 0.2, 0.2, 1]), sp = tool("sponge");
  drag(sp, ctxFor(s.doc, sp, { size: 30, flow: 100, spongeMode: "desaturate" }), line(20, 40, 140, 40, 20));
  const g = s.layer.raster.get(80, 40);
  assert.ok(g[0] - g[1] < 0.6, `desaturated ${g}`);
  const s2 = setup(160, 80, [0.6, 0.4, 0.4, 1]);
  drag(sp, ctxFor(s2.doc, sp, { size: 30, flow: 100, spongeMode: "saturate", vibrance: false }), line(20, 40, 140, 40, 20));
  const q = s2.layer.raster.get(80, 40);
  assert.ok(q[0] - q[1] > 0.25, `saturated ${q}`);
});

test("paint bucket fills a contiguous region (color or pattern), gradient draws on drag with Shift snapping", () => {
  const { doc, layer } = setup(120, 80, [1, 1, 1, 1]);
  doc.change("Frame", () => {
    layer.raster.fill({ x: 20, y: 20, w: 80, h: 4 }, [0, 0, 0, 1]); layer.raster.fill({ x: 20, y: 56, w: 80, h: 4 }, [0, 0, 0, 1]);
    layer.raster.fill({ x: 20, y: 20, w: 4, h: 40 }, [0, 0, 0, 1]); layer.raster.fill({ x: 96, y: 20, w: 4, h: 40 }, [0, 0, 0, 1]);
  });
  const t = tool("paint-bucket"), ctx = ctxFor(doc, t, { antialias: false });
  ctx.fg = [0, 0, 1, 1];
  drag(t, ctx, [[60, 40]]);
  assert.deepEqual(layer.raster.get(60, 40), [0, 0, 1, 1]);
  assert.deepEqual(layer.raster.get(5, 5), [1, 1, 1, 1], "outside the frame untouched");
  assert.deepEqual(layer.raster.get(21, 21), [0, 0, 0, 1]);
  drag(t, ctxFor(doc, t, { fill: "pattern", pattern: "stripes", contiguous: false, tolerance: 0 }), [[5, 5]]);
  const v = new Set();
  for (let x = 0; x < 20; x++) v.add(layer.raster.get(x, 5).map((c) => c.toFixed(2)).join());
  assert.ok(v.size >= 2, "pattern");

  const g = setup(200, 60), tg = tool("gradient"), cg = ctxFor(g.doc, tg, { dither: false });
  cg.fg = [0, 0, 0, 1]; cg.bg = [1, 1, 1, 1];
  const steps = g.doc.history.steps.length;
  drag(tg, cg, [[0, 30], [100, 30], [200, 33]], { shift: true });
  assert.equal(g.doc.history.steps.length, steps + 1);
  const l = g.layer.raster.get(2, 10), r = g.layer.raster.get(197, 50), mid = g.layer.raster.get(100, 10);
  assert.ok(l[0] < 0.05 && r[0] > 0.95 && mid[0] > 0.3 && mid[0] < 0.7, `${l} ${mid} ${r}`);
  near(g.layer.raster.get(100, 5)[0], g.layer.raster.get(100, 55)[0], 1 / 255, "Shift snapped to horizontal");
});

test("every paint tool runs headless through drag() and changes pixels", () => {
  const skip = new Set(["patch", "content-aware-move", "clone-stamp", "healing-brush"]); // need a selection / source (tested above)
  for (const t of PT.PAINT_TOOLS) {
    if (skip.has(t.id)) continue;
    const { doc, layer } = blemish();
    doc.change("Red", () => { for (let y = 40; y < 80; y++) for (let x = 40; x < 60; x++) layer.raster.set(x, y, [0.85, 0.1, 0.1, 1]); });
    doc.change("Paint", () => layer.raster.fill({ x: 100, y: 0, w: 60, h: 120 }, [0.2, 0.5, 0.9, 1]));
    doc.history.brushSource = { step: 2 };
    const before = layer.raster.read(0, 0, 160, 120);
    const ctx = ctxFor(doc, t, { size: 24 });
    ctx.fg = [0.9, 0.8, 0.1, 1];
    drag(t, ctx, t.id === "red-eye" ? [[50, 60]] : t.id === "magic-eraser" || t.id === "paint-bucket" ? [[130, 60]] : line(30, 60, 130, 60, 16));
    const after = layer.raster.read(0, 0, 160, 120);
    let changed = 0;
    for (let i = 0; i < after.length; i++) if (Math.abs(after[i] - before[i]) > 1 / 255) changed++;
    assert.ok(changed > 20, `${t.id} changed ${changed}`);
  }
});
