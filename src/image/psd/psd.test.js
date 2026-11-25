import { test } from "node:test";
import assert from "node:assert/strict";
const D = await import("../doc/index.ts");
const P = await import("./index.ts");
const { ImageDocument, Mask, BLEND_MODES, rectPath, ellipsePath, textData, FX_DEFAULTS } = D;
const { readPsd, writePsd, PsdReader, PsdWriter, readDescriptor, writeDescriptor, parseEngineData, writeEngineData } = P;

const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} ${a} ≉ ${b}`);
const byName = (doc, name) => doc.all().find((l) => l.name === name);

/** A document with a bit of everything; rasters hold exact 8 / 16-bit values. */
function sample(depth = 8) {
  const doc = new ImageDocument({ width: 64, height: 48, depth, name: "sample" });
  doc.change("build", () => {
    const max = depth === 8 ? 255 : 65535;
    const a = doc.newPixelLayer("Çiçek ğüşiöı");
    for (let y = 0; y < 20; y++) for (let x = 0; x < 30; x++) a.raster.set(x + 3, y + 4, [((x * 7) % 256) / 255, ((y * 11) % 256) / 255, ((x * y) % 256) / 255, ((x + y * 3) % 200 + 55) / 255]);
    if (depth === 16) a.raster.set(10, 10, [12345 / max, 54321 / max, 1 / max, 40000 / max]);
    a.blend = "color-dodge"; a.opacity = 0.6; a.fill = 0.4; a.color = "green"; a.locks.position = true;
    doc.add(a);
    const g = doc.newGroup("Group A");
    g.blend = "pass-through"; g.collapsed = true;
    doc.add(g);
    const b = doc.newPixelLayer("Clipped");
    b.raster.fill({ x: 10, y: 10, w: 20, h: 10 }, [0, 0.5, 1, 1]);
    b.clip = true; b.visible = false; b.blend = "luminosity";
    const m = new Mask(64, 48, 255); m.outside = 255;
    for (let y = 12; y < 18; y++) for (let x = 0; x < 64; x++) m.data[y * 64 + x] = (x * 4) & 255;
    b.mask = { mask: m, enabled: true, linked: true, density: 0.8, feather: 2 };
    const inner = doc.newGroup("Inner");
    inner.blend = "multiply";
    const c = doc.newPixelLayer("Vector");
    c.raster.fill({ x: 0, y: 0, w: 64, h: 48 }, [1, 0, 0, 1]);
    c.vectorMask = { path: ellipsePath(32, 24, 20, 12), enabled: true, linked: false, density: 1, feather: 0 };
    c.styles = { enabled: true, dropShadow: [{ ...FX_DEFAULTS.dropShadow(), color: [0.2, 0.4, 0.6, 1], opacity: 0.55, angle: 135, distance: 9, size: 13, spread: 0.1, blend: "overlay" }], stroke: [FX_DEFAULTS.stroke()] };
    inner.children = [c];
    g.children = [b, inner];
  });
  return doc;
}

test("PSD round trip (no March block): names, blend modes, opacity, fill, clipping, visibility, groups, masks, vector mask, drop shadow, 8-bit pixels", async () => {
  const doc = sample(8);
  const bytes = await writePsd(doc, { marchData: false });
  assert.equal(String.fromCharCode(...bytes.subarray(0, 4)), "8BPS");
  const back = await readPsd(bytes);
  assert.deepEqual(back.meta.psd.warnings, []);
  assert.deepEqual(back.all().map((l) => [l.name, l.kind]), doc.all().map((l) => [l.name, l.kind]));
  const a = byName(back, "Çiçek ğüşiöı"), a0 = byName(doc, "Çiçek ğüşiöı");
  assert.equal(a.blend, "color-dodge");
  near(a.opacity, 0.6, 1 / 255); near(a.fill, 0.4, 1 / 255);
  assert.equal(a.color, "green"); assert.equal(a.locks.position, true);
  const src = a0.raster.read(0, 0, 64, 48), got = a.raster.read(0, 0, 64, 48);
  for (let i = 0; i < src.length; i++) assert.equal(Math.round(got[i] * 255), Math.round(src[i] * 255), `pixel byte ${i}`);
  const g = byName(back, "Group A");
  assert.equal(g.kind, "group"); assert.equal(g.blend, "pass-through"); assert.equal(g.collapsed, true);
  assert.deepEqual(g.children.map((l) => l.name), ["Clipped", "Inner"]);
  const b = byName(back, "Clipped");
  assert.equal(b.clip, true); assert.equal(b.visible, false); assert.equal(b.blend, "luminosity");
  assert.ok(b.mask);
  assert.deepEqual([...b.mask.mask.data], [...byName(doc, "Clipped").mask.mask.data], "mask pixel-exact");
  assert.equal(b.mask.mask.outside, 255);
  near(b.mask.density, 0.8, 1 / 255); assert.equal(b.mask.feather, 2); assert.equal(b.mask.linked, true);
  assert.equal(byName(back, "Inner").blend, "multiply");
  const c = byName(back, "Vector"), c0 = byName(doc, "Vector");
  assert.equal(c.vectorMask.linked, false); assert.equal(c.vectorMask.enabled, true);
  const pa = c.vectorMask.path.subpaths[0].anchors, pb = c0.vectorMask.path.subpaths[0].anchors;
  assert.equal(pa.length, pb.length);
  for (let i = 0; i < pa.length; i++) for (const k of ["x", "y", "ix", "iy", "ox", "oy"]) near(pa[i][k], pb[i][k], 1e-4, `anchor ${i}.${k}`);
  assert.equal(c.vectorMask.path.subpaths[0].closed, true);
  const ds = c.styles.dropShadow[0];
  assert.equal(ds.blend, "overlay"); near(ds.opacity, 0.55, 1e-9); assert.equal(ds.angle, 135); assert.equal(ds.distance, 9); assert.equal(ds.size, 13); near(ds.spread, 0.1, 1e-9);
  for (let i = 0; i < 3; i++) near(ds.color[i], [0.2, 0.4, 0.6][i], 1e-9);
  assert.equal(c.styles.stroke[0].size, 3); assert.equal(c.styles.stroke[0].position, "outside");
});

test("PSD: every blend mode key survives", async () => {
  const doc = new ImageDocument({ width: 4, height: 4, background: "transparent" });
  doc.change("x", () => { for (const m of BLEND_MODES) { const l = doc.newPixelLayer(m); l.blend = m; doc.add(l); } });
  const back = await readPsd(await writePsd(doc, { marchData: false }));
  assert.deepEqual(back.layers.map((l) => l.blend), BLEND_MODES);
});

test("PSD 16-bit and 32-bit layers round trip exactly (Lr16 / Lr32); PSB too", async () => {
  const doc = sample(16);
  const back = await readPsd(await writePsd(doc));
  assert.equal(back.depth, 16);
  const a = byName(back, "Çiçek ğüşiöı").raster, a0 = byName(doc, "Çiçek ğüşiöı").raster;
  assert.equal(a.depth, 16);
  const t0 = [...a0.tiles.values()][0], t1 = [...a.tiles.values()][0];
  assert.deepEqual([...t1], [...t0]);
  assert.deepEqual(a.get(10, 10).map((v) => Math.round(v * 65535)), [12345, 54321, 1, 40000]);

  const f = new ImageDocument({ width: 8, height: 8, depth: 32, background: "transparent" });
  f.change("x", () => { const l = f.newPixelLayer("hdr"); l.raster.set(2, 3, [2.5, 0.125, 0, 1]); l.raster.set(4, 4, [0.3333, 0.6666, 1e-5, 0.5]); f.add(l); });
  const fb = await readPsd(await writePsd(f, { psb: true }));
  assert.equal(fb.meta.psd.version, 2);
  assert.deepEqual(fb.layers[0].raster.get(2, 3), [2.5, 0.125, 0, 1]);
  assert.deepEqual(fb.layers[0].raster.get(4, 4), [...new Float32Array([0.3333, 0.6666, 1e-5, 0.5])]);
});

test("PSD with the March block: March-only fields come back exactly", async () => {
  const doc = sample(8);
  doc.change("x", () => {
    const l = byName(doc, "Clipped");
    l.blendIf = { channel: "gray", thisLayer: [0, 10, 240, 255], underlying: [5, 5, 250, 250] };
    l.comments = [{ id: "c1", author: "Ada", text: "güzel", at: 1 }];
    l.data = { note: "kept" };
  });
  const back = await readPsd(await writePsd(doc));
  const l = byName(back, "Clipped");
  assert.deepEqual(l.blendIf, { channel: "gray", thisLayer: [0, 10, 240, 255], underlying: [5, 5, 250, 250] });
  assert.equal(l.comments[0].text, "güzel");
  assert.equal(l.data.note, "kept");
  assert.equal(back.name, "sample");
});

test("PSD text, fill, shape and adjustment layers", async () => {
  const doc = new ImageDocument({ width: 100, height: 60 });
  doc.change("x", () => {
    const t = doc.newText(textData("Merhaba\nDünya", { type: "point", x: 10, y: 40 }, { font: "Inter-Bold", size: 24, color: [1, 0.5, 0, 1] }, { align: "center" }), "Title");
    t.raster.fill({ x: 10, y: 20, w: 40, h: 20 }, [1, 0.5, 0, 1]);
    doc.add(t);
    doc.add(doc.newFillLayer({ type: "solid", color: [0.2, 0.4, 0.8, 1] }, "Blue fill"));
    doc.add(doc.newFillLayer({ type: "gradient", gradient: { type: "linear", relative: true, from: [0, 0.5], to: [1, 0.5], stops: [{ at: 0, color: [0, 0, 0, 1] }, { at: 1, color: [1, 1, 1, 1] }] } }, "Ramp"));
    const s = doc.newShape(rectPath(10, 10, 30, 20), { type: "solid", color: [0, 1, 0, 1] }, "Box");
    s.raster.fill({ x: 10, y: 10, w: 30, h: 20 }, [0, 1, 0, 1]);
    doc.add(s);
    doc.add(doc.newAdjustment("levels", { inBlack: 10 / 255, inWhite: 240 / 255, outBlack: 0, outWhite: 1, gamma: 1.2 }, "Levels 1"));
    doc.add(doc.newAdjustment("exposure", { amount: 0.5, offset: 0, gamma: 1 }, "Exposure 1"));
    doc.add(doc.newAdjustment("invert", {}, "Invert 1"));
  });
  const back = await readPsd(await writePsd(doc, { marchData: false }));
  const t = byName(back, "Title");
  assert.equal(t.kind, "text");
  assert.equal(D.plainText(t.text), "Merhaba\nDünya");
  assert.equal(t.text.char.font, "Inter-Bold"); assert.equal(t.text.char.size, 24); assert.equal(t.text.para.align, "center");
  assert.deepEqual(t.text.char.color.map((v) => Math.round(v * 100)), [100, 50, 0, 100]);
  assert.equal(t.text.frame.x, 10); assert.equal(t.text.frame.y, 40);
  assert.deepEqual(t.raster.get(12, 22).map((v) => Math.round(v * 255)), [255, 128, 0, 255]);
  const f = byName(back, "Blue fill");
  assert.equal(f.kind, "fill"); assert.equal(f.paint.type, "solid");
  for (let i = 0; i < 3; i++) near(f.paint.color[i], [0.2, 0.4, 0.8][i], 1e-9);
  const r = byName(back, "Ramp");
  assert.equal(r.paint.type, "gradient"); assert.equal(r.paint.gradient.stops.length, 2);
  near(r.paint.gradient.from[0], 0, 1e-6); near(r.paint.gradient.to[0], 1, 1e-6); near(r.paint.gradient.from[1], 0.5, 1e-6);
  const s = byName(back, "Box");
  assert.equal(s.kind, "shape"); assert.equal(s.fillPaint.type, "solid");
  near(s.path.subpaths[0].anchors[2].x, 40, 1e-4); near(s.path.subpaths[0].anchors[2].y, 30, 1e-4);
  const lv = byName(back, "Levels 1");
  assert.equal(lv.kind, "adjustment"); assert.equal(lv.adjust.id, "levels");
  near(lv.adjust.params.inBlack, 10 / 255, 1e-9); near(lv.adjust.params.gamma, 1.2, 1e-9);
  assert.equal(byName(back, "Exposure 1").adjust.id, "exposure"); near(byName(back, "Exposure 1").adjust.params.amount, 0.5, 1e-6);
  assert.equal(byName(back, "Invert 1").adjust.id, "invert");
  // unchanged adjustment blocks are written back byte for byte
  const again = await readPsd(await writePsd(back, { marchData: false }));
  assert.deepEqual([...byName(again, "Levels 1").data.psd.adjustment.bytes], [...lv.data.psd.adjustment.bytes]);
});

test("PSD: unknown layer blocks are kept and written back", async () => {
  const doc = new ImageDocument({ width: 8, height: 8 });
  doc.change("x", () => { doc.layers[0].data = { ...doc.layers[0].data, psd: { blocks: [{ key: "zZzZ", bytes: new Uint8Array([1, 2, 3, 4]) }] } }; });
  const back = await readPsd(await writePsd(doc, { marchData: false }));
  assert.deepEqual(back.layers[0].data.psd.blocks, [{ key: "zZzZ", bytes: new Uint8Array([1, 2, 3, 4]) }]);
});

test("PSD resources: resolution, guides, slices, alpha channels, paths", async () => {
  const doc = new ImageDocument({ width: 40, height: 30, dpi: 300 });
  doc.change("x", () => {
    doc.guides = [{ id: "g1", axis: "x", pos: 12.5 }, { id: "g2", axis: "y", pos: 20 }];
    doc.slices = [{ id: "s1", name: "button", rect: { x: 5, y: 5, w: 10, h: 8 }, kind: "user", url: "https://example.com", alt: "Düğme" }];
    const m = new Mask(40, 30); m.data[5] = 200;
    doc.channels = [{ id: "c1", name: "Alfa ş", mask: m, visible: false, color: [1, 0, 0, 1], opacity: 0.5 }];
    doc.paths = [{ id: "p1", name: "Outline", path: rectPath(2, 2, 10, 10) }];
  });
  const back = await readPsd(await writePsd(doc, { marchData: false }));
  assert.equal(back.dpi, 300);
  assert.deepEqual(back.guides.map((g) => [g.axis, g.pos]), [["x", 12.5], ["y", 20]]);
  assert.equal(back.slices.length, 1);
  assert.deepEqual(back.slices[0].rect, { x: 5, y: 5, w: 10, h: 8 });
  assert.equal(back.slices[0].url, "https://example.com"); assert.equal(back.slices[0].alt, "Düğme");
  assert.equal(back.channels.length, 1); assert.equal(back.channels[0].name, "Alfa ş"); assert.equal(back.channels[0].mask.data[5], 200);
  assert.equal(back.paths[0].name, "Outline");
  near(back.paths[0].path.subpaths[0].anchors[1].x, 12, 1e-4);
});

/** Build bytes with the PSD writer helpers. */
function psdBytes(fn) { const w = new PsdWriter(64); fn(w); return w.done(); }

test("read a minimal hand-built PSD (flat RGB, raw) and a grayscale RLE one", async () => {
  const rgb = psdBytes((w) => {
    w.sig("8BPS"); w.u16(1); w.zeros(6); w.u16(3); w.u32(1); w.u32(2); w.u16(8); w.u16(3);
    w.u32(0); w.u32(0); w.u32(0);
    w.u16(0); // raw
    w.bytes(new Uint8Array([255, 0])); w.bytes(new Uint8Array([0, 255])); w.bytes(new Uint8Array([0, 0]));
  });
  const d = await readPsd(rgb);
  assert.equal(d.width, 2); assert.equal(d.height, 1); assert.equal(d.layers.length, 1);
  assert.deepEqual(d.layers[0].raster.get(0, 0), [1, 0, 0, 1]);
  assert.deepEqual(d.layers[0].raster.get(1, 0), [0, 1, 0, 1]);
  assert.equal(d.layers[0].data.background, true);

  const gray = psdBytes((w) => {
    w.sig("8BPS"); w.u16(1); w.zeros(6); w.u16(1); w.u32(2); w.u32(3); w.u16(8); w.u16(1);
    w.u32(0); w.u32(0); w.u32(0);
    w.u16(1); w.u16(2); w.u16(4); // RLE, row byte counts
    w.bytes(new Uint8Array([254, 128])); // row 0: 3 × 128
    w.bytes(new Uint8Array([2, 0, 64, 255])); // row 1: literal 0, 64, 255
  });
  const g = await readPsd(gray);
  assert.equal(g.mode, "gray");
  assert.deepEqual(g.layers[0].raster.get(1, 0).map((v) => Math.round(v * 255)), [128, 128, 128, 255]);
  assert.deepEqual(g.layers[0].raster.get(1, 1).map((v) => Math.round(v * 255)), [64, 64, 64, 255]);

  const cmyk = psdBytes((w) => {
    w.sig("8BPS"); w.u16(1); w.zeros(6); w.u16(4); w.u32(1); w.u32(1); w.u16(8); w.u16(4);
    w.u32(0); w.u32(0); w.u32(0); w.u16(0);
    w.bytes(new Uint8Array([255, 0, 0, 255])); // no cyan, full magenta, full yellow, no black: red
  });
  const c = await readPsd(cmyk);
  assert.deepEqual(c.layers[0].raster.get(0, 0), [1, 0, 0, 1]);
  assert.ok(c.meta.psd.warnings.some((w) => /CMYK/.test(w)));
});

test("descriptor writer and reader round trip byte for byte", () => {
  const d = { name: "", classId: "null", items: {
    "Nm  ": { t: "TEXT", v: "Ölçek" }, Opct: { t: "UntF", unit: "#Prc", v: 55 }, enab: { t: "bool", v: true }, Cnt: { t: "long", v: -3 },
    Md: { t: "enum", type: "BlnM", v: "linearBurn" }, Lst: { t: "VlLs", v: [{ t: "doub", v: 1.5 }, { t: "Objc", v: { name: "", classId: "RGBC", items: { "Rd  ": { t: "doub", v: 10 } } } }] },
    raw: { t: "tdta", v: new Uint8Array([9, 8, 7]) }, big: { t: "comp", v: 12345678901n },
  } };
  const w = new PsdWriter(64); writeDescriptor(w, d);
  const bytes = w.done();
  const back = readDescriptor(new PsdReader(bytes));
  assert.deepEqual(back, d);
  const w2 = new PsdWriter(64); writeDescriptor(w2, back);
  assert.deepEqual([...w2.done()], [...bytes]);
});

test("EngineData parser and writer", () => {
  const src = new TextEncoder().encode("\n\n<<\n\t/EngineDict\n\t<<\n\t\t/Editor << /Text (þÿX) >>\n\t\t/N [ 1 .5 -2 true /Name ]\n\t>>\n>>");
  // the UTF-16 string above is not valid as typed; build one properly
  const bytes = [...src];
  const i = bytes.indexOf(0xc3); // TextEncoder wrote þÿ as UTF-8; replace with the BOM bytes + "Hi"
  bytes.splice(i, 5, 0xfe, 0xff, 0, 0x48, 0, 0x69);
  const d = parseEngineData(new Uint8Array(bytes));
  assert.equal(d.EngineDict.Editor.Text, "Hi");
  assert.deepEqual(d.EngineDict.N, [1, 0.5, -2, true, { name: "Name" }]);
  const again = parseEngineData(writeEngineData(d));
  assert.deepEqual(again, d);
  const tricky = { T: "a(b)c\\d ğ" };
  assert.deepEqual(parseEngineData(writeEngineData(tricky)), tricky);
});

test("PSD smart objects: SoLd + embedded file (lnk2) come back with their placement; March smart layers via the March block", async () => {
  const { writeVersioned } = P;
  const so = new PsdWriter(256);
  so.sig("soLD"); so.u32(4);
  const q = [10, 5, 30, 5, 30, 25, 10, 25].map((v) => ({ t: "doub", v }));
  writeVersioned(so, { name: "", classId: "null", items: { Idnt: { t: "TEXT", v: "uuid-1" }, Trnf: { t: "VlLs", v: q }, "Sz  ": { t: "Objc", v: { name: "", classId: "Pnt ", items: { Wdth: { t: "doub", v: 40 }, Hght: { t: "doub", v: 40 } } } } } });
  const embedded = new Uint8Array([137, 80, 78, 71, 1, 2, 3]);
  const doc = new ImageDocument({ width: 50, height: 40 });
  doc.change("x", () => {
    const s = doc.newSmart({ doc: { format: "embedded", id: "uuid-1", bytes: embedded, fileName: "logo.png", fileType: "png" }, width: 40, height: 40 }, [0.5, 0, 10, 0, 0.5, 5, 0, 0, 1], "Logo");
    s.raster.fill({ x: 10, y: 5, w: 20, h: 20 }, [0, 0, 1, 1]);
    s.data = { psd: { smart: [{ key: "SoLd", bytes: so.done() }] } };
    doc.add(s);
    const n = doc.newSmart({ doc: { native: true }, width: 4, height: 4 }, [1, 0, 0, 0, 1, 0, 0, 0, 1], "Native");
    doc.add(n);
  });
  const back = await readPsd(await writePsd(doc, { marchData: false }));
  const s = byName(back, "Logo");
  assert.equal(s.kind, "smart");
  assert.deepEqual([...s.source.doc.bytes], [...embedded]);
  assert.equal(s.source.doc.fileName, "logo.png");
  [0.5, 0, 10, 0, 0.5, 5, 0, 0, 1].forEach((v, i) => near(s.matrix[i], v, 1e-9, `matrix ${i}`));
  assert.deepEqual(s.raster.get(12, 7), [0, 0, 1, 1]);
  assert.equal(byName(back, "Native").kind, "pixel", "without the March block a March smart layer is pixels");
  const withMarch = await readPsd(await writePsd(doc));
  assert.deepEqual(byName(withMarch, "Native").source.doc, { native: true });
  assert.equal(byName(withMarch, "Native").kind, "smart");
});
