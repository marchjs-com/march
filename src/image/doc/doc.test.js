import { test } from "node:test";
import assert from "node:assert/strict";
const D = await import("./index.ts");
const { ImageDocument, TiledRaster, Mask, renderRegion, compositeInto, BLEND_MODES, blendColor, select, saveDocument, loadDocument, TILE } = D;

const near = (a, b, eps = 1e-3, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} ${a} ≉ ${b}`);
const px = (doc, x, y) => { const f = renderRegion(doc, { x, y, w: 1, h: 1 }); return [...f]; };

test("27 blend modes, each matches its reference formula on opaque pixels", () => {
  assert.equal(BLEND_MODES.length, 27);
  const b = [0.2, 0.5, 0.8], s = [0.6, 0.3, 0.9];
  // references written out independently of the kernel
  const ref = {
    normal: s, darken: [0.2, 0.3, 0.8], multiply: [0.12, 0.15, 0.72], "color-burn": [1 - Math.min(1, 0.8 / 0.6), 1 - Math.min(1, 0.5 / 0.3), 1 - 0.2 / 0.9],
    "linear-burn": [0, 0, 0.7], lighten: [0.6, 0.5, 0.9], screen: [0.68, 0.65, 0.98], "color-dodge": [0.5, 0.5 / 0.7, 1],
    "linear-dodge": [0.8, 0.8, 1], overlay: [0.24, 0.3, 1 - 2 * 0.2 * 0.1], "hard-light": [1 - 2 * 0.8 * 0.4, 0.3, 1 - 2 * 0.2 * 0.1],
    "soft-light": [0.2 + 0.2 * (Math.sqrt(0.2) - 0.2), 0.5 - 0.4 * 0.5 * 0.5, 0.8 + 0.8 * (Math.sqrt(0.8) - 0.8)],
    "linear-light": [0.4, 0.1, 1], "pin-light": [0.2, 0.5, 0.8], "hard-mix": [0, 0, 1], difference: [0.4, 0.2, 0.1],
    exclusion: [0.2 + 0.6 - 2 * 0.12, 0.5 + 0.3 - 2 * 0.15, 0.8 + 0.9 - 2 * 0.72], subtract: [0, 0.2, 0], divide: [1 / 3, 1, 0.8 / 0.9],
    "vivid-light": [Math.min(1, 0.2 / (1 - 2 * 0.1)), 1 - Math.min(1, 0.5 / 0.6), Math.min(1, 0.8 / (1 - 0.8))],
  };
  for (const [mode, want] of Object.entries(ref)) {
    const got = blendColor(mode, b, s);
    for (let i = 0; i < 3; i++) near(got[i], want[i], 1e-6, `${mode}[${i}]`);
  }
  // non-separable: luminosity keeps source luma, color keeps backdrop luma
  const lum = (c) => 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2];
  near(lum(blendColor("luminosity", b, s)), lum(s), 1e-6);
  near(lum(blendColor("color", b, s)), lum(b), 1e-6);
  near(lum(blendColor("hue", b, s)), lum(b), 1e-6);
  near(lum(blendColor("saturation", b, s)), lum(b), 1e-6);
  assert.deepEqual(blendColor("darker-color", b, s), lum(s) < lum(b) ? s : b);
  assert.deepEqual(blendColor("lighter-color", b, s), lum(s) > lum(b) ? s : b);
});

test("compositing: Porter-Duff over with opacity, fill, mask; special-eight fill mixes the result", () => {
  const dst = new Float32Array([0.5, 0, 0, 0.5]); // premultiplied 50 % red
  compositeInto(dst, new Float32Array([0, 0, 1, 1]), { mode: "normal", opacity: 0.5 });
  near(dst[3], 0.75); near(dst[2], 0.5); near(dst[0], 0.25);
  const d2 = new Float32Array([1, 1, 1, 1]);
  compositeInto(d2, new Float32Array([0.5, 0.5, 0.5, 1]), { mode: "multiply", opacity: 1, mask: new Float32Array([0.5]) });
  near(d2[0], 0.75);
  const d3 = new Float32Array([0.5, 0.5, 0.5, 1]);
  compositeInto(d3, new Float32Array([0.25, 0.25, 0.25, 1]), { mode: "linear-dodge", opacity: 1, fill: 0.5 });
  near(d3[0], 0.625, 1e-6, "fill mixes add result 0.75 halfway with 0.5");
  // dissolve: coverage is all-or-nothing per pixel, about the opacity on average
  const n = 4096, dd = new Float32Array(n * 4), src = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) src[i * 4 + 3] = 1;
  compositeInto(dd, src, { mode: "dissolve", opacity: 0.3, w: 64 });
  let on = 0;
  for (let i = 0; i < n; i++) { assert.ok(dd[i * 4 + 3] === 0 || dd[i * 4 + 3] === 1); on += dd[i * 4 + 3]; }
  near(on / n, 0.3, 0.05);
});

test("raster: tiles across borders, offsets, 16-bit and float, copy on write", () => {
  for (const depth of [8, 16, 32]) {
    const r = new TiledRaster(depth);
    r.fill({ x: TILE - 2, y: TILE - 2, w: 4, h: 4 }, [1, 0.5, 0, 1]);
    assert.equal(r.tiles.size, 4);
    const g = r.get(TILE + 1, TILE + 1);
    near(g[1], 0.5, depth === 8 ? 0.003 : 1e-4);
    assert.deepEqual(r.bounds(), { x: TILE - 2, y: TILE - 2, w: 4, h: 4 });
    r.ox = 10;
    assert.deepEqual(r.bounds(), { x: TILE + 8, y: TILE - 2, w: 4, h: 4 });
  }
  const a = new TiledRaster(8);
  a.set(1, 1, [1, 0, 0, 1]);
  const b = a.clone();
  b.set(1, 1, [0, 1, 0, 1]);
  assert.equal(a.get(1, 1)[0], 1, "the original keeps its pixel");
  assert.equal(b.get(1, 1)[1], 1);
});

test("history: every change is a step; undo / redo restore tiles and structure; snapshots revert", () => {
  const doc = new ImageDocument({ width: 300, height: 300 });
  const bg = doc.layers[0];
  doc.change("New Layer", () => doc.add(doc.newPixelLayer("A")));
  const a = doc.active;
  doc.change("Paint", () => a.raster.fill({ x: 0, y: 0, w: 10, h: 10 }, [1, 0, 0, 1]));
  doc.change("Opacity", () => doc.set(a.id, { opacity: 0.5 }));
  near(px(doc, 5, 5)[1], 0.5, 0.01);
  const snap = doc.history.snapshot("Snap 1");
  doc.undo();
  assert.equal(doc.find(a.id).opacity, 1);
  doc.undo();
  assert.equal(doc.find(a.id).raster.get(5, 5)[3], 0, "paint undone");
  doc.redo();
  assert.equal(doc.find(a.id).raster.get(5, 5)[0], 1, "paint redone");
  doc.undo(); doc.undo();
  assert.equal(doc.layers.length, 1);
  assert.equal(doc.layers[0], doc.layers[0]);
  assert.equal(doc.history.index, 0);
  doc.history.revert(snap.id);
  assert.equal(doc.layers.length, 2);
  near(px(doc, 5, 5)[1], 0.5, 0.01, "snapshot state back");
  assert.equal(doc.history.steps.at(-1).label, "Revert to Snap 1");
  // nothing changed → no step
  const before = doc.history.steps.length;
  doc.change("Nothing", () => {});
  assert.equal(doc.history.steps.length, before);
  // a failing change is rolled back
  assert.throws(() => doc.change("Boom", () => { doc.layers[1].raster.set(50, 50, [0, 0, 1, 1]); throw new Error("x"); }));
  assert.equal(doc.layers[1].raster.get(50, 50)[3], 0);
  void bg;
});

test("history: memory cap drops the oldest steps; jump goes to any state", () => {
  const doc = new ImageDocument({ width: 256, height: 256 });
  const l = doc.change("L", () => doc.add(doc.newPixelLayer("L")));
  for (let i = 0; i < 6; i++) doc.change(`P${i}`, () => l.raster.fill({ x: i, y: 0, w: 1, h: 1 }, [1, 1, 1, 1]));
  doc.history.jump(2);
  assert.equal(doc.find(l.id).raster.get(0, 0)[3], 1);
  assert.equal(doc.find(l.id).raster.get(1, 0)[3], 0);
  doc.history.jump(7);
  assert.equal(doc.find(l.id).raster.get(5, 0)[3], 1);
  doc.history.memoryCap = 1;
  doc.history.trim();
  assert.ok(doc.history.steps.length <= 2);
});

test("compositor: clipping mask, group pass-through vs isolated, layer mask with density, hidden layers", () => {
  const doc = new ImageDocument({ width: 4, height: 4, background: "white" });
  doc.change("setup", () => {
    const base = doc.add(doc.newPixelLayer("base"));
    base.raster.fill({ x: 0, y: 0, w: 2, h: 4 }, [0, 0, 1, 1]);
    const c = doc.add(doc.newPixelLayer("clip"));
    c.raster.fill({ x: 0, y: 0, w: 4, h: 4 }, [1, 0, 0, 1]);
    c.clip = true;
  });
  assert.deepEqual(px(doc, 0, 0).map(Math.round), [1, 0, 0, 1], "clipped red over the blue base");
  assert.deepEqual(px(doc, 3, 0).map(Math.round), [1, 1, 1, 1], "outside the base: white");
  // group: a multiply child over white inside a pass-through group darkens the backdrop; isolated it does not see it
  const d2 = new ImageDocument({ width: 2, height: 1, background: [0.5, 0.5, 0.5, 1] });
  d2.change("g", () => {
    const g = d2.add(d2.newGroup("g"));
    const m = d2.newPixelLayer("m");
    m.raster.fill({ x: 0, y: 0, w: 2, h: 1 }, [0.5, 0.5, 0.5, 1]);
    m.blend = "multiply";
    g.children.push(m);
  });
  near(px(d2, 0, 0)[0], 0.25, 0.01, "pass-through multiplies the backdrop");
  d2.change("iso", () => { d2.layers[1].blend = "normal"; });
  near(px(d2, 0, 0)[0], 0.5, 0.01, "isolated: multiply over transparency = the layer itself");
  // layer mask with density
  d2.change("mask", () => {
    const g = d2.layers[1];
    const mk = new Mask(2, 1);
    mk.data[0] = 0; mk.data[1] = 255;
    g.mask = { mask: mk, enabled: true, linked: true, density: 0.5, feather: 0 };
    g.children[0].raster.fill({ x: 0, y: 0, w: 2, h: 1 }, [0, 0, 0, 1]);
  });
  near(px(d2, 0, 0)[0], 0.25, 0.01, "density 50 %: hidden half way");
  near(px(d2, 1, 0)[0], 0, 0.01);
  d2.change("hide", () => { d2.layers[1].visible = false; });
  near(px(d2, 0, 0)[0], 0.5, 0.01);
});

test("adjustment layers run the image engine's ops in linear light; unknown ops pass through", async () => {
  const { defineOp } = await import("../op.ts");
  defineOp({ type: "test-invert", kind: "color", defaults: {}, color: (c) => { c[0] = 1 - c[0]; c[1] = 1 - c[1]; c[2] = 1 - c[2]; } });
  const { toLinear, toEncoded } = await import("../raster.ts");
  const doc = new ImageDocument({ width: 2, height: 2, background: [0.2, 0.2, 0.2, 1] });
  doc.change("adj", () => doc.add(doc.newAdjustment("test-invert", {})));
  const want = toEncoded(1 - toLinear(0.2));
  near(px(doc, 0, 0)[0], want, 2e-3);
  doc.change("op", () => { doc.active.opacity = 0.5; });
  near(px(doc, 0, 0)[0], 0.2 + (want - 0.2) * 0.5, 2e-3);
  doc.change("unknown", () => { doc.active.adjust = { id: "no-such-op", params: {} }; });
  near(px(doc, 0, 0)[0], 0.2, 1e-3, "unknown op: passes through");
  assert.equal(D.getFilter("test-invert").adjustment, true);
});

test("selection: shapes combine, modify, invert, wand, channels", () => {
  const doc = new ImageDocument({ width: 40, height: 40 });
  doc.change("sel", () => select.combine(doc, select.rectMask(doc, { x: 0, y: 0, w: 20, h: 20 }), "new"));
  assert.deepEqual(doc.selection.bounds(), { x: 0, y: 0, w: 20, h: 20 });
  doc.change("add", () => select.combine(doc, select.rectMask(doc, { x: 20, y: 0, w: 10, h: 10 }), "add"));
  assert.deepEqual(doc.selection.bounds(), { x: 0, y: 0, w: 30, h: 20 });
  doc.change("sub", () => select.combine(doc, select.rectMask(doc, { x: 0, y: 0, w: 40, h: 5 }), "subtract"));
  assert.equal(doc.selection.bounds().y, 5);
  doc.change("int", () => select.combine(doc, select.rectMask(doc, { x: 10, y: 10, w: 40, h: 40 }), "intersect"));
  assert.deepEqual(doc.selection.bounds(), { x: 10, y: 10, w: 10, h: 10 });
  doc.change("grow", () => select.expand(doc, 3));
  assert.deepEqual(doc.selection.bounds(), { x: 7, y: 7, w: 16, h: 16 });
  doc.change("shrink", () => select.contract(doc, 5));
  assert.deepEqual(doc.selection.bounds(), { x: 12, y: 12, w: 6, h: 6 });
  doc.change("inv", () => select.invert(doc));
  assert.equal(doc.selection.get(0, 0), 255);
  assert.equal(doc.selection.get(14, 14), 0);
  const ch = doc.change("save", () => select.saveToChannel(doc));
  doc.change("none", () => select.deselect(doc));
  assert.equal(doc.selection, null);
  doc.change("load", () => select.loadFromChannel(doc, ch.id));
  assert.equal(doc.selection.get(0, 0), 255);
  doc.undo(); doc.undo();
  assert.equal(doc.selection.get(14, 14), 0);
  // feather softens
  doc.change("rect", () => select.combine(doc, select.rectMask(doc, { x: 10, y: 10, w: 20, h: 20 }), "new"));
  doc.change("feather", () => select.feather(doc, 4));
  const edge = doc.selection.get(10, 20);
  assert.ok(edge > 40 && edge < 215, `soft edge ${edge}`);
  // marching ants: a square's outline is 4 runs
  const sq = select.rectMask(doc, { x: 5, y: 5, w: 10, h: 10 }, false);
  assert.equal(select.outline(sq).length, 4);
  // magic wand: contiguous stops at a different color
  const d2 = new ImageDocument({ width: 10, height: 10 });
  d2.change("paint", () => d2.layers[0].raster.fill({ x: 5, y: 0, w: 1, h: 10 }, [0, 0, 0, 1]));
  const w1 = select.wandMask(d2, 1, 1, { tolerance: 10, contiguous: true, sampleAll: true, antialias: false });
  assert.deepEqual(w1.bounds(), { x: 0, y: 0, w: 5, h: 10 });
  const w2 = select.wandMask(d2, 1, 1, { tolerance: 10, contiguous: false, sampleAll: true, antialias: false });
  assert.deepEqual(w2.bounds(), { x: 0, y: 0, w: 10, h: 10 });
});

test("layer tree: add, group / ungroup, arrange, duplicate (copy on write), remove", () => {
  const doc = new ImageDocument({ width: 20, height: 20 });
  const [a, b] = doc.change("two", () => [doc.add(doc.newPixelLayer("a")), doc.add(doc.newPixelLayer("b"))]);
  assert.deepEqual(doc.layers.map((l) => l.name), ["Background", "a", "b"]);
  const g = doc.change("group", () => doc.group([a.id, b.id]));
  assert.deepEqual(doc.layers.map((l) => l.name), ["Background", "Group"]);
  assert.deepEqual(g.children.map((l) => l.name), ["a", "b"]);
  doc.change("arr", () => doc.arrange(a.id, "top"));
  assert.deepEqual(doc.find(g.id).children.map((l) => l.name), ["b", "a"]);
  doc.change("ungroup", () => doc.ungroup(g.id));
  assert.deepEqual(doc.layers.map((l) => l.name), ["Background", "b", "a"]);
  doc.change("paint", () => doc.find(a.id).raster.set(1, 1, [1, 0, 0, 1]));
  const c = doc.change("dup", () => doc.duplicate(a.id));
  doc.change("paint2", () => c.raster.set(1, 1, [0, 0, 1, 1]));
  assert.equal(doc.find(a.id).raster.get(1, 1)[0], 1, "duplicate shares pixels until written");
  doc.change("rm", () => doc.remove([c.id]));
  assert.equal(doc.find(c.id), null);
  doc.undo();
  assert.ok(doc.find(c.id));
});

test(".march-image round trip keeps layers, pixels in every depth, masks, channels, paths", async () => {
  for (const depth of [8, 16, 32]) {
    const doc = new ImageDocument({ width: 300, height: 260, depth, name: "Round" });
    doc.change("x", () => {
      const l = doc.add(doc.newPixelLayer("paint"));
      l.raster.fill({ x: 250, y: 250, w: 20, h: 10 }, [0.25, 0.5, 0.75, 1]);
      l.blend = "screen"; l.opacity = 0.7;
      const mk = new Mask(300, 260, 255); mk.data[0] = 7;
      l.mask = { mask: mk, enabled: true, linked: true, density: 1, feather: 2 };
      select.combine(doc, select.rectMask(doc, { x: 1, y: 2, w: 3, h: 4 }), "new");
      select.saveToChannel(doc);
      doc.paths = [{ id: "p1", name: "Path 1", path: D.ellipsePath(50, 50, 20, 10) }];
    });
    const bytes = await saveDocument(doc);
    assert.ok(D.isMarchImage(bytes));
    const back = await loadDocument(bytes);
    assert.equal(back.name, "Round");
    assert.equal(back.depth, depth);
    const l = back.layers[1];
    assert.equal(l.blend, "screen");
    assert.equal(l.raster.depth, depth);
    near(l.raster.get(260, 255)[1], 0.5, depth === 8 ? 0.003 : 1e-4);
    assert.equal(l.mask.mask.data[0], 7);
    assert.equal(back.channels.length, 1);
    assert.deepEqual(back.selection.bounds(), { x: 1, y: 2, w: 3, h: 4 });
    assert.equal(back.paths[0].path.subpaths[0].anchors.length, 4);
    assert.deepEqual(D.validateDocument(back), []);
    const a = renderRegion(doc, doc.bounds), b = renderRegion(back, back.bounds);
    let maxd = 0;
    for (let i = 0; i < a.length; i++) maxd = Math.max(maxd, Math.abs(a[i] - b[i]));
    assert.ok(maxd < 1e-6, "renders the same");
  }
});

test("paths: rasterize a rectangle exactly, stroke, split keeps the curve", () => {
  const m = D.pathToMask(D.rectPath(2, 2, 4, 3), 10, 10);
  assert.deepEqual(m.bounds(), { x: 2, y: 2, w: 4, h: 3 });
  assert.equal(m.get(3, 3), 255);
  const half = D.pathToMask(D.rectPath(2.5, 2, 1, 1), 10, 10);
  assert.equal(half.get(2, 2), 128, "half-covered pixel");
  const e = D.ellipsePath(10, 10, 5, 5);
  const hit = D.hitPath(e, 15, 10);
  assert.ok(hit.dist < 0.2);
  const s = D.splitSegment(e, 0, 0, 0.5);
  assert.equal(s.subpaths[0].anchors.length, 5);
  const p1 = D.flatten(e.subpaths[0]), p2 = D.flatten(s.subpaths[0]);
  const r = (pts) => Math.max(...pts.map(([x, y]) => Math.abs(Math.hypot(x - 10, y - 10) - 5)));
  assert.ok(r(p1) < 0.05 && r(p2) < 0.05, "still a circle");
  const sp = D.strokePolygons([[0, 5], [10, 5]], false, 2, "butt");
  let area = 0;
  D.fillPolygons(sp, "nonzero", { x: -5, y: 0, w: 20, h: 10 }, (_x, _y, c) => { area += c; });
  near(area, 20, 0.5, "butt stroke: a 10 × 2 bar");
});
