import { test } from "node:test";
import assert from "node:assert/strict";
const { ImageDocument, renderRegion, plainText } = await import("../index.ts");
const { headlessContext, sample, drag, getTool } = await import("./tool.ts");
const { installVectorTools } = await import("./vector.ts");
const { penTool, directSelectTool, pathSelectTool, addAnchorTool, deleteAnchorTool, convertAnchorTool, curvaturePenTool, freeformPenTool, smoothAnchors } = await import("./pen.ts");
const { typeTool, typeMaskTool, verticalTypeTool, typeText } = await import("./type.ts");
const { rectangleTool, ellipseTool, lineTool, customShapeTool, shapeFromDrag } = await import("./shape.ts");
const { pathToSelection, fillPath, strokePath, makeVectorMask, pathFromSelection, savePath } = await import("./path-ops.ts");
const { textEnv } = await import("../text/layout.ts");

textEnv.forceFallback = true;
installVectorTools();

const click = (tool, ctx, x, y, extra = {}) => { tool.down?.(ctx, sample(x, y, extra)); tool.up?.(ctx, sample(x, y, extra)); };
const key = (tool, ctx, k, mods = {}) => tool.key_(ctx, { key: k, shift: false, alt: false, ctrl: false, meta: false, type: "down", ...mods });
const work = (doc) => doc.paths.find((p) => p.work).path;

test("installVectorTools registers type, pen, selection and shape tools", () => {
  for (const id of ["type", "type-vertical", "type-mask", "type-vertical-mask", "pen", "freeform-pen", "curvature-pen", "add-anchor", "delete-anchor", "convert-anchor", "path-select", "direct-select", "rectangle", "rounded-rectangle", "ellipse", "polygon", "line", "custom-shape"]) assert.ok(getTool(id), id);
});

test("pen: click corners, drag a smooth anchor, close on the first anchor; one step per click", () => {
  const doc = new ImageDocument({ width: 200, height: 200 });
  const ctx = headlessContext(doc, { mode: "path", rubberBand: true });
  click(penTool, ctx, 10, 10);
  drag(penTool, ctx, [[50, 10], [55, 15], [60, 20]]);
  click(penTool, ctx, 50, 80);
  assert.equal(penTool.pending(ctx), true);
  penTool.hover(ctx, sample(30, 90));
  assert.ok(penTool.overlay(ctx).some((o) => o.type === "polyline"), "rubber band");
  click(penTool, ctx, 11, 11); // on the first anchor: closes
  assert.equal(penTool.pending(ctx), false);
  const sp = work(doc).subpaths[0];
  assert.equal(sp.closed, true);
  assert.equal(sp.anchors.length, 3);
  assert.deepEqual(sp.anchors[0], { x: 10, y: 10, ix: 10, iy: 10, ox: 10, oy: 10, type: "corner" });
  assert.deepEqual(sp.anchors[1], { x: 50, y: 10, ix: 40, iy: 0, ox: 60, oy: 20, type: "symmetric" });
  assert.equal(sp.anchors[2].type, "corner");
  assert.equal(doc.history.steps.length, 4, "one step per click");
  doc.undo();
  assert.equal(work(doc).subpaths[0].closed, false);
  // Alt while dragging breaks the handles
  const ctx2 = headlessContext(doc, { mode: "path" });
  click(penTool, ctx2, 100, 100);
  drag(penTool, ctx2, [[150, 100], [160, 120]], { alt: true });
  const a = work(doc).subpaths[work(doc).subpaths.length - 1].anchors[1];
  assert.equal(a.type, "corner"); assert.equal(a.ox, 160); assert.equal(a.ix, 150, "incoming handle untouched");
  // Ctrl: direct selection while held (moves the anchor under the pointer)
  penTool.commit(ctx2);
  drag(penTool, ctx2, [[100, 100], [105, 103]], { ctrl: true });
  const moved = work(doc).subpaths[work(doc).subpaths.length - 1].anchors[0];
  assert.deepEqual([moved.x, moved.y], [105, 103]);
});

test("pen in shape mode makes a shape layer", () => {
  const doc = new ImageDocument({ width: 100, height: 100, background: "transparent" });
  const ctx = headlessContext(doc, { mode: "shape" });
  click(penTool, ctx, 10, 10); click(penTool, ctx, 90, 10); click(penTool, ctx, 50, 90); click(penTool, ctx, 10, 10);
  const l = doc.active;
  assert.equal(l.kind, "shape");
  assert.equal(l.path.subpaths[0].closed, true);
  assert.equal(renderRegion(doc, { x: 50, y: 30, w: 1, h: 1 })[3], 1);
});

test("direct selection moves a handle (the other stays in line), anchors and marquee", () => {
  const doc = new ImageDocument({ width: 200, height: 200 });
  const ctx = headlessContext(doc, { mode: "path" });
  click(penTool, ctx, 10, 100);
  drag(penTool, ctx, [[100, 100], [130, 100]]);
  click(penTool, ctx, 190, 100);
  penTool.commit(ctx);
  // select the middle anchor, then drag its outgoing handle
  click(directSelectTool, ctx, 100, 100);
  drag(directSelectTool, ctx, [[130, 100], [100, 130]]);
  let a = work(doc).subpaths[0].anchors[1];
  assert.deepEqual([a.ox, a.oy], [100, 130]);
  assert.ok(Math.abs(a.ix - 100) < 1e-9 && Math.abs(a.iy - 70) < 1e-9, "symmetric: mirrored");
  // Alt breaks: the incoming handle stays
  drag(directSelectTool, ctx, [[100, 130], [120, 130]], { alt: true });
  a = work(doc).subpaths[0].anchors[1];
  assert.equal(a.type, "corner"); assert.deepEqual([a.ix, a.iy], [100, 70]);
  // drag the anchor: its handles come along
  drag(directSelectTool, ctx, [[100, 100], [100, 110]]);
  a = work(doc).subpaths[0].anchors[1];
  assert.deepEqual([a.y, a.oy, a.iy], [110, 140, 80]);
  // marquee selects the two end anchors, moving them moves only those
  drag(directSelectTool, ctx, [[0, 0], [200, 105]]);
  drag(directSelectTool, ctx, [[10, 100], [10, 90]]);
  const s = work(doc).subpaths[0].anchors;
  assert.deepEqual([s[0].y, s[1].y, s[2].y], [90, 110, 90]);
});

test("path selection moves and Alt-duplicates whole subpaths; delete removes them", () => {
  const doc = new ImageDocument({ width: 200, height: 200 });
  const ctx = headlessContext(doc, { mode: "path", shape: "rect" });
  drag(rectangleTool, headlessContext(doc, { mode: "path" }), [[10, 10], [50, 50]]);
  assert.equal(work(doc).subpaths.length, 1);
  drag(pathSelectTool, ctx, [[30, 30], [40, 35]]);
  assert.deepEqual([work(doc).subpaths[0].anchors[0].x, work(doc).subpaths[0].anchors[0].y], [20, 15]);
  drag(pathSelectTool, ctx, [[30, 30], [130, 30]], { alt: true });
  assert.equal(work(doc).subpaths.length, 2);
  assert.equal(work(doc).subpaths[1].anchors[0].x, 120);
  assert.equal(work(doc).subpaths[0].anchors[0].x, 20, "the original stays");
  assert.equal(key(pathSelectTool, ctx, "Delete"), true);
  assert.equal(work(doc).subpaths.length, 1);
});

test("add / delete / convert anchor, curvature and freeform pen", () => {
  const doc = new ImageDocument({ width: 200, height: 200 });
  const ctx = headlessContext(doc, { mode: "path" });
  click(penTool, ctx, 10, 10); click(penTool, ctx, 110, 10);
  penTool.commit(ctx);
  click(addAnchorTool, ctx, 60, 10);
  assert.equal(work(doc).subpaths[0].anchors.length, 3);
  assert.equal(work(doc).subpaths[0].anchors[1].x, 60);
  drag(convertAnchorTool, ctx, [[60, 10], [80, 10]]);
  assert.equal(work(doc).subpaths[0].anchors[1].ox, 80);
  assert.equal(work(doc).subpaths[0].anchors[1].ix, 40);
  click(convertAnchorTool, ctx, 60, 10);
  assert.equal(work(doc).subpaths[0].anchors[1].ox, 60, "click: back to a corner");
  click(deleteAnchorTool, ctx, 60, 10);
  assert.equal(work(doc).subpaths[0].anchors.length, 2);
  // curvature pen: three points on a curve, smooth handles through them
  const c = headlessContext(doc, { mode: "path" });
  click(curvaturePenTool, c, 20, 150); click(curvaturePenTool, c, 100, 100); click(curvaturePenTool, c, 180, 150);
  const sp = work(doc).subpaths[work(doc).subpaths.length - 1];
  assert.equal(sp.anchors.length, 3);
  assert.ok(sp.anchors[1].ox > 100 && sp.anchors[1].ix < 100, "middle point has handles along the curve");
  curvaturePenTool.commit(c);
  // freeform: a drawn zig-zag becomes a simplified path
  const pts = [];
  for (let x = 0; x <= 100; x++) pts.push([x + 50, 50 + (x % 20 < 10 ? x % 10 : 10 - (x % 10))]);
  drag(freeformPenTool, headlessContext(doc, { mode: "path", curveFit: 1 }), pts);
  const ff = work(doc).subpaths[work(doc).subpaths.length - 1];
  assert.ok(ff.anchors.length >= 8 && ff.anchors.length < 40, `${ff.anchors.length} anchors`);
  assert.equal(smoothAnchors([{ x: 0, y: 0 }, { x: 10, y: 0, corner: true }, { x: 20, y: 0 }], false)[1].ox, 10);
});

test("shape tools: live shape layer, Shift / Alt constraints, path and pixel modes", () => {
  const doc = new ImageDocument({ width: 200, height: 200, background: "transparent" });
  const ctx = headlessContext(doc, { mode: "shape", strokeWidth: 2 });
  drag(rectangleTool, ctx, [[10, 10], [60, 40]]);
  const l = doc.active;
  assert.equal(l.kind, "shape");
  assert.deepEqual(l.live, { type: "rect", x: 10, y: 10, w: 50, h: 30, radius: [0, 0, 0, 0] });
  assert.equal(l.stroke.width, 2);
  drag(ellipseTool, ctx, [[100, 100], [130, 110]], { shift: true, alt: true });
  assert.deepEqual(doc.active.live, { type: "ellipse", cx: 100, cy: 100, rx: 30, ry: 30 });
  const ln = shapeFromDrag("line", [0, 0], [100, 10], { lineWidth: 3 }, true, false);
  assert.equal(ln.y2, 0, "Shift snaps the line to 0°");
  drag(customShapeTool, headlessContext(doc, { mode: "shape", customShape: "star-5" }), [[0, 100], [50, 150]]);
  assert.equal(doc.active.live.id, "star-5");
  drag(lineTool, headlessContext(doc, { mode: "path" }), [[0, 190], [100, 190]]);
  assert.equal(work(doc).subpaths.length, 1);
  doc.change("Layer", () => doc.add(doc.newPixelLayer("px")));
  drag(rectangleTool, headlessContext(doc, { mode: "pixels" }, {}), [[150, 10], [170, 30]]);
  assert.equal(doc.active.kind, "pixel");
  assert.equal(doc.active.raster.get(160, 20)[3], 1);
});

test("type tool: creates a text layer, one undo step per edit session", () => {
  const doc = new ImageDocument({ width: 300, height: 200, background: "transparent" });
  const ctx = headlessContext(doc, { size: 20 });
  const steps0 = doc.history.steps.length;
  click(typeTool, ctx, 20, 60);
  assert.equal(typeTool.pending(ctx), true);
  for (const ch of "Hello") key(typeTool, ctx, ch);
  key(typeTool, ctx, "Backspace");
  key(typeTool, ctx, "Enter");
  typeText(ctx, "you");
  typeTool.commit(ctx);
  assert.equal(doc.history.steps.length, steps0 + 1, "creating and typing is one step");
  const l = doc.active;
  assert.equal(l.kind, "text");
  assert.equal(plainText(l.text), "Hell\nyou");
  assert.equal(l.name, "Hell");
  assert.ok(renderRegion(doc, { x: 25, y: 55, w: 1, h: 1 })[3] > 0, "rendered");
  // edit again: click on the text, move to the end, type, commit → one more step
  click(typeTool, ctx, 22, 55);
  key(typeTool, ctx, "End", { ctrl: true });
  typeText(ctx, "!!");
  key(typeTool, ctx, "ArrowLeft", { shift: true });
  typeText(ctx, "?");
  key(typeTool, ctx, "Enter", { ctrl: true });
  assert.equal(doc.history.steps.length, steps0 + 2);
  assert.equal(plainText(doc.find(l.id).text), "Hell\nyou!?");
  doc.undo();
  assert.equal(plainText(doc.find(l.id).text), "Hell\nyou");
  doc.undo();
  assert.equal(doc.find(l.id), null, "the first undo step removes the layer");
  // Escape throws a session away; an empty new layer leaves no step
  click(typeTool, ctx, 50, 50);
  key(typeTool, ctx, "x");
  key(typeTool, ctx, "Escape");
  click(typeTool, ctx, 50, 50);
  typeTool.commit(ctx);
  assert.equal(doc.all().filter((x) => x.kind === "text").length, 0);
  // drag: box text; vertical tool
  drag(typeTool, ctx, [[10, 10], [110, 90]]);
  typeText(ctx, "box text here");
  typeTool.commit(ctx);
  assert.equal(doc.active.text.frame.type, "box");
  click(verticalTypeTool, ctx, 250, 20);
  typeText(ctx, "ab");
  verticalTypeTool.commit(ctx);
  assert.equal(doc.active.text.orientation, "vertical");
});

test("type mask tool makes a selection from the text", () => {
  const doc = new ImageDocument({ width: 200, height: 100 });
  const ctx = headlessContext(doc, { size: 30 });
  click(typeMaskTool, ctx, 10, 60);
  typeText(ctx, "MASK");
  typeMaskTool.commit(ctx);
  assert.ok(doc.selection);
  assert.equal(doc.selection.get(15, 55), 255);
  assert.equal(doc.selection.get(15, 65), 0);
  assert.equal(doc.all().filter((l) => l.kind === "text").length, 0, "no layer");
});

test("path operations: make selection, fill, stroke (plain and brush), vector mask, from selection, save", () => {
  const doc = new ImageDocument({ width: 100, height: 100 });
  const ctx = headlessContext(doc, { mode: "path" });
  drag(rectangleTool, ctx, [[10, 10], [50, 50]]);
  const p = work(doc);
  pathToSelection(doc, p, { feather: 0 });
  assert.equal(doc.selection.get(30, 30), 255);
  assert.equal(doc.selection.get(60, 60), 0);
  pathToSelection(doc, { subpaths: [{ ...p.subpaths[0] }] }, { op: "subtract" });
  assert.equal(doc.selection, null);
  doc.change("Layer", () => doc.add(doc.newPixelLayer("px")));
  fillPath(doc, p, { color: [1, 0, 0, 1] });
  assert.deepEqual(doc.active.raster.get(30, 30), [1, 0, 0, 1]);
  strokePath(ctx, p, { width: 4, color: [0, 0, 1, 1] });
  assert.deepEqual(doc.active.raster.get(10, 30), [0, 0, 1, 1]);
  const got = [];
  ctx.shared.strokeWithBrush = (pts) => got.push(pts);
  strokePath(ctx, p, { simulatePressure: true });
  assert.equal(got.length, 1);
  assert.ok(got[0][0].pressure < got[0][Math.floor(got[0].length / 2)].pressure);
  makeVectorMask(doc, doc.active.id, p);
  assert.ok(doc.active.vectorMask.enabled);
  assert.equal(renderRegion(doc, { x: 70, y: 70, w: 1, h: 1 })[0], 1, "outside the vector mask: the white background shows");
  pathToSelection(doc, p);
  const wp = pathFromSelection(doc, 1);
  assert.equal(wp.path.subpaths.length, 1);
  assert.equal(wp.path.subpaths[0].anchors.length, 4, "a rectangle traces to four corners");
  assert.equal(savePath(doc, "Box").name, "Box");
  assert.equal(doc.paths.some((x) => x.work), false);
});

test("magnetic freeform pen snaps to the strongest nearby edge", async () => {
  const { snapToEdge } = await import("./pen.ts");
  const doc = new ImageDocument({ width: 100, height: 100 });
  doc.change("Half", () => doc.layers[0].raster.fill({ x: 0, y: 0, w: 50, h: 100 }, [0, 0, 0, 1]));
  const [x] = snapToEdge(doc, 44, 50, 10, 0.1);
  assert.ok(Math.abs(x - 50) <= 1, `snapped to ${x}`);
  const flat = snapToEdge(doc, 20, 50, 5, 0.1);
  assert.deepEqual(flat, [20, 50], "no edge nearby: the point stays");
});
