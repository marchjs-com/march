import { test } from "node:test";
import assert from "node:assert/strict";
const { ImageDocument, renderRegion } = await import("../index.ts");
const { renderShapePixels, pathCoverage, installShapeRenderer, addShapeLayer, setLiveShape, liveShapePath, strokeOutline, dashPolyline, rasterizeShape } = await import("./render.ts");
const { customShapes, customShapePath, parsePathNotation } = await import("./custom.ts");

installShapeRenderer();
const black = { type: "solid", color: [0, 0, 0, 1] };
const rect = { type: "rect", x: 20, y: 20, w: 60, h: 60, radius: [0, 0, 0, 0] };

/** Alpha along row y from x0 to x1 of a shape rendered over 0..100. */
function row(shape, y, x0, x1) {
  const r = { x: 0, y: 0, w: 100, h: 100 }, px = renderShapePixels(shape, r), out = [];
  for (let x = x0; x <= x1; x++) out.push(Math.round(px[(y * 100 + x) * 4 + 3] * 100) / 100);
  return out;
}

test("stroke align: inside, center and outside widths", () => {
  const path = liveShapePath(rect);
  const st = (align) => ({ paint: black, width: 4, align, cap: "butt", join: "miter" });
  // the left edge is x = 20: inside covers 20..24, outside 16..20, center 18..22
  assert.deepEqual(row({ path, fillPaint: null, stroke: st("inside") }, 50, 14, 26), [0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0]);
  assert.deepEqual(row({ path, fillPaint: null, stroke: st("outside") }, 50, 14, 26), [0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0]);
  assert.deepEqual(row({ path, fillPaint: null, stroke: st("center") }, 50, 14, 26), [0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0, 0]);
  // a filled shape with an outside stroke: fill to the edge, stroke beyond
  assert.deepEqual(row({ path, fillPaint: { type: "solid", color: [1, 0, 0, 1] }, stroke: st("outside") }, 50, 15, 22), [0, 1, 1, 1, 1, 1, 1, 1]);
  // miter corner reaches the corner point; bevel cuts it
  const corner = (join) => renderShapePixels({ path, fillPaint: null, stroke: { paint: black, width: 6, align: "outside", cap: "butt", join } }, { x: 0, y: 0, w: 100, h: 100 })[(15 * 100 + 15) * 4 + 3];
  assert.equal(corner("miter"), 1);
  assert.equal(corner("bevel"), 0);
});

test("caps, joins and dashes", () => {
  const pts = [[10, 50], [90, 50]];
  const butt = strokeOutline(pts, false, 10, "butt"), sq = strokeOutline(pts, false, 10, "square"), round = strokeOutline(pts, false, 10, "round");
  const xs = (polys) => polys.flat().map((p) => p[0]);
  assert.equal(Math.min(...xs(butt)), 10);
  assert.equal(Math.min(...xs(sq)), 5);
  assert.ok(Math.abs(Math.min(...xs(round)) - 5) < 0.01);
  const d = dashPolyline(pts, false, [10, 10]);
  assert.equal(d.length, 4);
  assert.deepEqual(d[1], [[30, 50], [40, 50]]);
  const path = { subpaths: [{ closed: false, anchors: pts.map(([x, y]) => ({ x, y, ix: x, iy: y, ox: x, oy: y, type: "corner" })) }] };
  // dash pattern in multiples of the stroke width (2 → [4 px on, 4 px off])
  const r = row({ path, fillPaint: null, stroke: { paint: black, width: 2, align: "center", cap: "butt", join: "miter", dash: [2, 2] } }, 50, 10, 25);
  assert.deepEqual(r, [1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0, 0]);
});

test("live shapes: changing the rectangle radius regenerates the path (one step, undoable)", () => {
  const doc = new ImageDocument({ width: 100, height: 100, background: "transparent" });
  const l = addShapeLayer(doc, rect, black);
  assert.equal(l.path.subpaths[0].anchors.length, 4);
  const a = (x, y) => renderRegion(doc, { x, y, w: 1, h: 1 })[3];
  assert.equal(a(20, 20), 1, "square corner filled");
  setLiveShape(doc, l.id, { radius: [15, 15, 15, 15] });
  const s = doc.find(l.id);
  assert.equal(s.path.subpaths[0].anchors.length, 8);
  assert.deepEqual(s.live.radius, [15, 15, 15, 15]);
  assert.equal(a(20, 20), 0, "rounded corner is empty");
  assert.equal(a(50, 20), 1);
  doc.undo();
  assert.equal(doc.find(l.id).path.subpaths[0].anchors.length, 4);
  assert.equal(a(20, 20), 1, "undo re-renders the square");
  // polygon with smooth corners and a star; line with arrow heads
  const star = liveShapePath({ type: "polygon", cx: 50, cy: 50, r: 40, sides: 5, star: 0.5, angle: 0 });
  assert.equal(star.subpaths[0].anchors.length, 10);
  const smooth = liveShapePath({ type: "polygon", cx: 50, cy: 50, r: 40, sides: 6, angle: 0, smooth: 0.5 });
  assert.equal(smooth.subpaths[0].anchors.length, 12);
  const line = liveShapePath({ type: "line", x1: 10, y1: 50, x2: 90, y2: 50, width: 2, arrows: [false, true] });
  assert.equal(line.subpaths.length, 2);
  const cov = pathCoverage(line, { x: 0, y: 0, w: 100, h: 100 });
  assert.ok(cov[47 * 100 + 75] > 0.5, "the arrow head is wider than the line");
  assert.equal(cov[47 * 100 + 40], 0);
  const px = rasterizeShape(doc, l.id);
  assert.equal(px.kind, "pixel");
});

test("boolean subpath ops: subtract, intersect, exclude", () => {
  const sq = (x, y, w, op) => ({ closed: true, op, anchors: [[x, y], [x + w, y], [x + w, y + w], [x, y + w]].map(([a, b]) => ({ x: a, y: b, ix: a, iy: b, ox: a, oy: b, type: "corner" })) });
  const r = { x: 0, y: 0, w: 100, h: 100 }, at = (c, x, y) => c[y * 100 + x];
  const sub = pathCoverage({ subpaths: [sq(10, 10, 60), sq(40, 40, 60, "subtract")] }, r);
  assert.equal(at(sub, 20, 20), 1); assert.equal(at(sub, 50, 50), 0); assert.equal(at(sub, 80, 80), 0);
  const inter = pathCoverage({ subpaths: [sq(10, 10, 60), sq(40, 40, 60, "intersect")] }, r);
  assert.equal(at(inter, 20, 20), 0); assert.equal(at(inter, 50, 50), 1);
  const ex = pathCoverage({ subpaths: [sq(10, 10, 60), sq(40, 40, 60, "exclude")] }, r);
  assert.equal(at(ex, 20, 20), 1); assert.equal(at(ex, 50, 50), 0); assert.equal(at(ex, 80, 80), 1);
});

test("custom shapes: at least 30, every one rasterizes non-empty in its box", () => {
  const all = customShapes();
  assert.ok(all.length >= 30, `${all.length} shapes`);
  assert.equal(new Set(all.map((s) => s.id)).size, all.length, "unique ids");
  for (const s of all) {
    const p = customShapePath(s.id, 0, 0, 100, 100);
    const c = pathCoverage(p, { x: 0, y: 0, w: 100, h: 100 });
    let sum = 0;
    for (const v of c) sum += v;
    assert.ok(sum > 400 && sum < 10000, `${s.id}: coverage ${sum}`);
  }
  assert.equal(new Set(all.map((s) => s.category)).size, 9, "all categories present");
  const p = parsePathNotation("M0 0 L10 0 Q10 10 0 10 Z");
  assert.equal(p[0].anchors.length, 3);
  assert.equal(p[0].closed, true);
  // a heart with a hole (evenodd) has an empty middle
  const h = pathCoverage(customShapePath("heart-outline", 0, 0, 100, 100), { x: 0, y: 0, w: 100, h: 100 });
  assert.equal(h[45 * 100 + 50], 0);
  // the crescent's subtract op works
  const m = pathCoverage(customShapePath("moon", 0, 0, 100, 100), { x: 0, y: 0, w: 100, h: 100 });
  assert.equal(m[40 * 100 + 66], 0);
  assert.equal(m[50 * 100 + 8], 1);
});

test("a moved shape layer (raster offset) does not re-render, and the offset bakes into the path", async () => {
  const { bakeShapeOffset } = await import("./render.ts");
  const doc = new ImageDocument({ width: 100, height: 100, background: "transparent" });
  const l = addShapeLayer(doc, { type: "rect", x: 10, y: 10, w: 20, h: 20, radius: [0, 0, 0, 0] }, black);
  const a = (x, y) => renderRegion(doc, { x, y, w: 1, h: 1 })[3];
  doc.change("Move", () => { l.raster.ox = 30; });
  assert.equal(a(45, 15), 1); assert.equal(a(15, 15), 0);
  doc.change("Bake", () => bakeShapeOffset(doc.find(l.id)));
  const s = doc.find(l.id);
  assert.equal(s.raster.ox, 0);
  assert.equal(s.live.x, 40);
  assert.equal(a(45, 15), 1); assert.equal(a(15, 15), 0);
});
