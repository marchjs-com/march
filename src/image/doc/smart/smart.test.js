import { test } from "node:test";
import assert from "node:assert/strict";
const { ImageDocument, renderRegion, registerFilter, saveDocument, loadDocument } = await import("../index.ts");
const S = await import("./smart.ts");
const A = await import("./artboards.ts");
const { installTextRenderer, createPointText } = await import("../text/render.ts");
const { textEnv } = await import("../text/layout.ts");
const { installShapeRenderer } = await import("../shapes/render.ts");

S.installSmartRenderer();
installTextRenderer();
installShapeRenderer();
textEnv.forceFallback = true;

/** A document with a pattern of colored pixels in one layer. */
function patterned() {
  const doc = new ImageDocument({ width: 64, height: 48, background: "transparent" });
  doc.change("Layer", () => {
    const l = doc.add(doc.newPixelLayer("Art"));
    const r = { x: 8, y: 6, w: 40, h: 30 }, px = new Float32Array(r.w * r.h * 4);
    for (let y = 0; y < r.h; y++) for (let x = 0; x < r.w; x++) {
      const k = (y * r.w + x) * 4;
      px[k] = ((x * 37 + y * 11) % 256) / 255; px[k + 1] = ((x * 5 + y * 53) % 256) / 255; px[k + 2] = ((x * y) % 256) / 255; px[k + 3] = 1;
    }
    l.raster.write(r.x, r.y, r.w, r.h, px);
  });
  return doc;
}
const all = (doc) => renderRegion(doc, doc.bounds);
function maxDiff(a, b) { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; }

test("convert to smart object: same pixels, cropped source, one undo step", () => {
  const doc = patterned();
  const before = all(doc);
  const id = doc.active.id;
  const steps = doc.history.steps.length;
  const sm = S.convertToSmart(doc, [id]);
  assert.equal(doc.history.steps.length, steps + 1);
  assert.equal(sm.kind, "smart");
  assert.equal(sm.source.width, 40); assert.equal(sm.source.height, 30);
  assert.deepEqual(sm.matrix, [1, 0, 8, 0, 1, 6, 0, 0, 1]);
  assert.ok(maxDiff(all(doc), before) <= 1 / 255 + 1e-6);
  doc.undo();
  assert.equal(doc.active.kind, "pixel");
});

test("smart object scaled 50 % then 200 % equals the original (lossless re-render from the source)", () => {
  const doc = patterned();
  const before = all(doc);
  const sm = S.convertToSmart(doc, [doc.active.id]);
  S.scaleSmart(doc, sm.id, 0.5, 0.5, 8, 6);
  const half = all(doc);
  assert.ok(maxDiff(half, before) > 0.1, "the half-size render differs");
  S.scaleSmart(doc, sm.id, 2, 2, 8, 6);
  assert.deepEqual(doc.find(sm.id).matrix, [1, 0, 8, 0, 1, 6, 0, 0, 1]);
  assert.ok(maxDiff(all(doc), before) <= 1 / 255 + 1e-6);
  // a projective placement still renders inside the expected bounds
  S.setSmartMatrix(doc, sm.id, [1, 0.1, 4, 0, 1, 2, 0.001, 0, 1]);
  all(doc);
  assert.ok(doc.find(sm.id).raster.bounds());
});

test("smart filters run in order; toggling restores; filter mask limits them", () => {
  registerFilter({ id: "test-invert", label: "Invert", group: "adjust", params: [], apply(px) { for (let i = 0; i < px.data.length; i += 4) { px.data[i] = 1 - px.data[i]; px.data[i + 1] = 1 - px.data[i + 1]; px.data[i + 2] = 1 - px.data[i + 2]; } } });
  const doc = patterned();
  const before = all(doc);
  const sm = S.convertToSmart(doc, [doc.active.id]);
  S.addSmartFilter(doc, sm.id, { id: "test-invert", params: {} });
  const inv = all(doc);
  assert.ok(Math.abs(inv[(10 * 64 + 10) * 4] - (1 - before[(10 * 64 + 10) * 4])) < 2 / 255);
  S.setSmartFilter(doc, sm.id, 0, { enabled: false });
  assert.ok(maxDiff(all(doc), before) <= 1 / 255 + 1e-6, "off: back to the original");
  S.setSmartFilter(doc, sm.id, 0, { enabled: true });
  S.setSmartFiltersEnabled(doc, sm.id, false);
  assert.ok(maxDiff(all(doc), before) <= 1 / 255 + 1e-6);
  S.setSmartFiltersEnabled(doc, sm.id, true);
  // half opacity
  S.setSmartFilter(doc, sm.id, 0, { opacity: 0.5 });
  const k = (10 * 64 + 10) * 4, half = all(doc)[k];
  assert.ok(Math.abs(half - (before[k] + (1 - before[k])) / 2) < 2 / 255);
  // filter mask: hide the filter on the left half
  doc.change("Mask", () => { const m = doc.find(sm.id).filterMask; const d = m.writable(); for (let y = 0; y < 48; y++) for (let x = 0; x < 32; x++) d[y * 64 + x] = 0; });
  S.setSmartFilter(doc, sm.id, 0, { opacity: 1 });
  const masked = all(doc);
  assert.ok(Math.abs(masked[k] - before[k]) < 2 / 255, "masked part unfiltered");
  const k2 = (10 * 64 + 40) * 4;
  assert.ok(Math.abs(masked[k2] - (1 - before[k2])) < 2 / 255, "unmasked part filtered");
});

test("edit contents → commit is one step; via copy is independent; rasterize; export / replace; save and load", async () => {
  const doc = patterned();
  const sm = S.convertToSmart(doc, [doc.active.id]);
  const child = S.editContents(doc, sm.id);
  assert.equal(child.width, 40);
  child.change("Paint", () => child.layers[0].raster.fill({ x: 0, y: 0, w: 4, h: 4 }, [1, 0, 0, 1]));
  // the parent is unchanged until the commit
  assert.notDeepEqual([...renderRegion(doc, { x: 8, y: 6, w: 1, h: 1 })], [1, 0, 0, 1]);
  const steps = doc.history.steps.length;
  S.commitContents(doc, sm.id, child);
  assert.equal(doc.history.steps.length, steps + 1);
  assert.deepEqual([...renderRegion(doc, { x: 8, y: 6, w: 1, h: 1 })], [1, 0, 0, 1]);
  doc.undo();
  assert.notDeepEqual([...renderRegion(doc, { x: 8, y: 6, w: 1, h: 1 })], [1, 0, 0, 1]);
  doc.redo();
  const copy = S.newSmartViaCopy(doc, sm.id);
  const c2 = S.editContents(doc, copy.id);
  c2.change("Paint", () => c2.layers[0].raster.fill({ x: 0, y: 0, w: 4, h: 4 }, [0, 0, 1, 1]));
  S.commitContents(doc, copy.id, c2);
  const orig = doc.find(sm.id);
  assert.equal(S.renderSource(orig.source.doc)[3], 1);
  assert.equal(S.renderSource(orig.source.doc)[0], 1, "the original keeps its red");
  // save and load: the nested source travels in the .march-image
  const bytes = await saveDocument(doc);
  const back = await loadDocument(bytes);
  assert.ok(maxDiff(all(back), all(doc)) <= 1 / 255 + 1e-6);
  // export / replace contents
  const ex = await S.exportContents(doc.find(sm.id));
  await S.replaceContents(doc, copy.id, ex);
  assert.equal(doc.find(copy.id).source.width, 40);
  const px = S.rasterizeSmart(doc, sm.id);
  assert.equal(px.kind, "pixel");
});

test("smart object of a text layer re-renders text from its source; linked contents refresh", async () => {
  const doc = new ImageDocument({ width: 120, height: 60, background: "transparent" });
  const t = createPointText(doc, 10, 40, "Hi", { size: 20 });
  const sm = S.convertToSmart(doc, [t.id]);
  assert.equal(sm.source.doc.layers[0].kind, "text");
  renderRegion(doc, doc.bounds);
  assert.ok(doc.find(sm.id).raster.bounds());
  const linkedDoc = patterned();
  S.smartLoader.load = async () => linkedDoc;
  const l = await S.placeLinked(doc, "art.march-image");
  assert.equal(l.source.linked, "art.march-image");
  linkedDoc.change("Paint", () => linkedDoc.layers[0].raster.fill({ x: 0, y: 0, w: 64, h: 48 }, [0, 1, 0, 1]));
  assert.equal(await S.refreshLinked(doc), 1);
  assert.equal(S.renderSource(doc.find(l.id).source.doc)[1], 1);
});

test("artboards: presets, from layers, from selection, move in / out, auto-nest", async () => {
  const { select } = await import("../index.ts");
  const doc = new ImageDocument({ width: 2000, height: 1200, background: "transparent" });
  const a = A.createArtboard(doc, "phone");
  assert.deepEqual(a.rect, { x: 0, y: 0, w: 390, h: 844 });
  const b = A.createArtboard(doc, "post-square");
  assert.equal(b.rect.x, 490, "placed right of the first with a gap");
  doc.change("Layer", () => { const l = doc.add(doc.newPixelLayer("dot"), { index: doc.layers.length }); l.raster.fill({ x: 600, y: 100, w: 10, h: 10 }, [1, 0, 0, 1]); });
  const dot = doc.layers[doc.layers.length - 1];
  doc.change("Drop", () => A.autoNest(doc, dot.id));
  assert.equal(A.artboardOf(doc, dot.id)?.id, b.id, "dropped on the second artboard");
  doc.change("Move", () => { doc.find(dot.id).raster.ox = 1200; A.autoNest(doc, dot.id); });
  assert.equal(A.artboardOf(doc, dot.id), null, "moved outside: back at the root");
  A.moveToArtboard(doc, [dot.id], a.id);
  assert.equal(A.artboardOf(doc, dot.id)?.id, a.id);
  A.moveToArtboard(doc, [dot.id], null);
  assert.equal(A.artboardOf(doc, dot.id), null);
  const c = A.artboardFromLayers(doc, [dot.id]);
  assert.deepEqual(c.rect, { x: 1800, y: 100, w: 10, h: 10 });
  assert.equal(A.artboardOf(doc, dot.id)?.id, c.id);
  doc.change("Select", () => select.combine(doc, select.rectMask(doc, { x: 100, y: 900, w: 300, h: 200 }), "new"));
  const d = A.artboardFromSelection(doc);
  assert.deepEqual(d.rect, { x: 100, y: 900, w: 300, h: 200 });
  A.setArtboardRect(doc, c.id, { x: 1700, y: 100, w: 50, h: 50 });
  assert.equal(doc.find(dot.id).raster.ox, 1100, "contents move with the artboard");
  assert.ok(A.ARTBOARD_PRESETS.length >= 15);
});
