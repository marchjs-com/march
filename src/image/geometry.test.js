// Geometry ops: exact quarter turns and mirrors, crops, perspective, Lanczos resize, pad, seam carving, horizon
// detection and collages.
import { test } from "node:test";
import assert from "node:assert/strict";
const I = await import("./index.ts");
const G = await import("./geometry.ts");
const { crop, cropRaster, cropFromState } = await import("./ops/crop.ts");
const { rotate, rotateRaster } = await import("./ops/rotate.ts");
const { flip } = await import("./ops/flip.ts");
const { perspective, keystone } = await import("./ops/perspective.ts");
const { resize, resizeRaster } = await import("./ops/resize.ts");
const { pad } = await import("./ops/pad.ts");
const { seamCarve } = await import("./ops/seam-carve.ts");
const { detectHorizon, straighten } = await import("./ops/straighten.ts");
const { collage, collageCells, COLLAGE_TEMPLATES } = await import("./collage.ts");

const close = (a, b, eps = 1e-4) => Math.abs(a - b) <= eps;
/** A w × h raster whose pixel (x, y) is f(x, y) → [r, g, b, a?]. */
const make = (w, h, f) => {
  const r = I.raster(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const v = f(x, y), i = (y * w + x) * 4; r.data[i] = v[0]; r.data[i + 1] = v[1]; r.data[i + 2] = v[2]; r.data[i + 3] = v[3] ?? 1; }
  return r;
};
/** Distinct values per pixel. */
const pattern = (w, h) => make(w, h, (x, y) => [x / w, y / h, ((x * 7 + y * 13) % 17) / 17]);
const px = (r, x, y) => [...r.data.subarray((y * r.width + x) * 4, (y * r.width + x) * 4 + 4)];
const run = (src, op) => I.render(src, [op]);

test("rotate 90 is exact and swaps the size; four quarter turns are the identity", () => {
  const src = pattern(5, 3);
  const out = run(src, rotate(90));
  assert.equal(out.width, 3); assert.equal(out.height, 5);
  // clockwise: the top-left pixel ends at the top-right
  assert.deepEqual(px(out, 2, 0), px(src, 0, 0));
  assert.deepEqual(px(out, 0, 4), px(src, 4, 2));
  const back = I.render(src, [rotate(90), rotate(90), rotate(-180)]);
  assert.deepEqual([...back.data], [...src.data]);
  // the general path agrees with the exact one at a hair off 90°
  const near = rotateRaster(src, 90.0001, true);
  assert.equal(near.width, 4); // ceil of the rotated bounding box
});

test("rotate by an angle: expand grows the canvas with transparent corners, no-expand crops to the inner rectangle", () => {
  const src = make(40, 20, () => [0.5, 0.5, 0.5]);
  const big = rotateRaster(src, 30, true);
  assert.ok(big.width > 40 && big.height > 20);
  assert.equal(px(big, 0, 0)[3], 0, "corner transparent");
  assert.ok(close(px(big, big.width >> 1, big.height >> 1)[3], 1));
  const filledBg = rotateRaster(src, 30, true, "#ff0000");
  assert.equal(px(filledBg, 0, 0)[3], 1); assert.ok(close(px(filledBg, 0, 0)[0], 1));
  const inner = rotateRaster(src, 10, false);
  assert.ok(inner.width < 40 && inner.height < 20);
  for (let i = 3; i < inner.data.length; i += 4) assert.ok(close(inner.data[i], 1, 1e-3), "no transparent pixel inside");
});

test("flip twice is the identity; flip mirrors", () => {
  const src = pattern(6, 4);
  assert.deepEqual([...I.render(src, [flip(true, true), flip(true, true)]).data], [...src.data]);
  const h = run(src, flip());
  assert.deepEqual(px(h, 0, 1), px(src, 5, 1));
  const v = run(src, flip(false, true));
  assert.deepEqual(px(v, 2, 0), px(src, 2, 3));
});

test("crop of a known pattern; circle crops are transparent outside; ImageCropper state converts", () => {
  const src = pattern(10, 10);
  const out = run(src, crop({ x: 0.2, y: 0.3, w: 0.5, h: 0.4 }));
  assert.equal(out.width, 5); assert.equal(out.height, 4);
  for (let y = 0; y < 4; y++) for (let x = 0; x < 5; x++) px(out, x, y).forEach((v, k) => assert.ok(close(v, px(src, x + 2, y + 3)[k]), `(${x},${y})`));
  const circle = cropRaster(src, { x: 0, y: 0, w: 1, h: 1, angle: 0, shape: "circle", flip: false });
  assert.equal(px(circle, 0, 0)[3], 0); assert.equal(px(circle, 5, 5)[3], 1);
  // the default state (no pan, zoom 1, no turn) on a frame with the image's aspect covers the whole image
  const st = { zoom: 1, rotate: 0, flip: false, x: 0, y: 0, aspect: 2, w: 1, h: 1 };
  const p = cropFromState(st, 400, 400, 200, 100);
  assert.ok(close(p.x, 0) && close(p.y, 0) && close(p.w, 1) && close(p.h, 1), JSON.stringify(p));
  // zoom 2 keeps the centre half; a pan of +0.25 frame widths shows the left part
  const z = cropFromState({ ...st, zoom: 2, x: 0.25 }, 400, 400, 200, 100);
  assert.ok(close(z.w, 0.5) && close(z.h, 0.5) && close(z.x, 0.125) && close(z.y, 0.25), JSON.stringify(z));
});

test("perspective with identity corners is the identity; keystone makes a symmetric quad", () => {
  const src = pattern(8, 6);
  const out = G.warpHomography(src, 8, 6, G.solveHomography([[0, 0], [8, 0], [8, 6], [0, 6]], [[0, 0], [8, 0], [8, 6], [0, 6]]));
  out.data.forEach((v, i) => assert.ok(close(v, src.data[i], 1e-4)));
  assert.equal(I.inert(perspective()), true);
  const q = keystone(50, 0);
  const warped = run(src, perspective(q));
  assert.equal(warped.width, 8); assert.equal(warped.height, 6);
  assert.ok(q[0][0] > 0 && close(q[0][0], 1 - q[1][0]) && q[3][0] === 0);
});

test("Lanczos resize keeps a constant image constant and averages 2× down", () => {
  const flat = make(17, 11, () => [0.3, 0.6, 0.9]);
  for (const [w, h] of [[8, 5], [40, 23], [17, 11]]) {
    const out = resizeRaster(flat, w, h);
    assert.equal(out.width, w); assert.equal(out.height, h);
    for (let i = 0; i < out.data.length; i += 4) { assert.ok(close(out.data[i], 0.3) && close(out.data[i + 1], 0.6) && close(out.data[i + 2], 0.9) && close(out.data[i + 3], 1)); }
  }
  const stripes = make(32, 4, (x) => [x & 1, x & 1, x & 1]);
  const half = resizeRaster(stripes, 16, 4);
  for (let x = 3; x < 13; x++) assert.ok(close(half.data[(1 * 16 + x) * 4], 0.5, 1e-3), `${x}: ${half.data[(16 + x) * 4]}`);
  // transparent pixels do not darken their neighbours (premultiplied)
  const holes = make(16, 4, (x) => (x & 1 ? [1, 1, 1, 1] : [0, 0, 0, 0]));
  const h2 = resizeRaster(holes, 8, 4);
  assert.ok(close(h2.data[(8 + 4) * 4], 1, 1e-3) && close(h2.data[(8 + 4) * 4 + 3], 0.5, 1e-3));
  // the op: contain / cover / exact, and the preview scale
  const src = pattern(40, 20);
  const c = run(src, resize(10, 10, "contain")); assert.deepEqual([c.width, c.height], [10, 5]);
  const v = run(src, resize(10, 10, "cover")); assert.deepEqual([v.width, v.height], [10, 10]);
  const e = I.render(src, [resize(20, 30, "exact")], { scale: 0.5 }); assert.deepEqual([e.width, e.height], [10, 15]);
  const b = run(src, resize(10, 10, "cover", "bilinear")); assert.deepEqual([b.width, b.height], [10, 10]);
});

test("pad sizes, fill and target ratio", () => {
  const src = pattern(10, 6);
  const out = run(src, pad({ top: 1, right: 2, bottom: 3, left: 4, color: "#ffffff" }));
  assert.deepEqual([out.width, out.height], [16, 10]);
  assert.deepEqual(px(out, 0, 0), [1, 1, 1, 1]);
  assert.deepEqual(px(out, 4, 1), px(src, 0, 0));
  const pct = run(src, pad({ left: 10, right: 10, unit: "%" }));
  assert.deepEqual([pct.width, pct.height], [12, 6]);
  const sq = run(src, pad({ ratio: 1 }));
  assert.deepEqual([sq.width, sq.height], [10, 10]);
  assert.equal(px(sq, 0, 0)[3], 0, "transparent by default");
  assert.deepEqual(px(sq, 0, 2), px(src, 0, 0));
});

test("seam carving hits the target size and keeps a high-energy column", () => {
  const src = make(24, 16, (x) => (x === 15 ? [1, 1, 1] : [0.05, 0.05, 0.05]));
  const out = run(src, seamCarve(16, 0));
  assert.deepEqual([out.width, out.height], [16, 16]);
  for (let y = 0; y < 16; y++) { let bright = 0; for (let x = 0; x < 16; x++) if (px(out, x, y)[0] > 0.9) bright++; assert.equal(bright, 1, `row ${y}`); }
  const grown = run(src, seamCarve(30, 20));
  assert.deepEqual([grown.width, grown.height], [30, 20]);
  const tall = run(src, seamCarve(0, 10, { x: 0, y: 0, w: 1, h: 1 }));
  assert.deepEqual([tall.width, tall.height], [24, 10]);
});

test("detectHorizon finds a 5° tilted horizon within 1° and straighten levels it", () => {
  const W = 240, H = 160, t = Math.tan((5 * Math.PI) / 180);
  // y grows downwards: the horizon falls to the right (turned 5° clockwise); sky light, ground dark, anti-aliased
  const img = make(W, H, (x, y) => { const d = (y + 0.5 - (H / 2 + (x + 0.5 - W / 2) * t)) * Math.cos(Math.atan(t)); const k = Math.min(1, Math.max(0, d + 0.5)); const v = 0.8 - 0.7 * k; return [v, v, v]; });
  const a = detectHorizon(img);
  assert.ok(Math.abs(a + 5) < 1, `got ${a}`);
  const level = run(img, straighten(a));
  assert.ok(level.width < W && level.height < H);
  assert.ok(Math.abs(detectHorizon(level)) < 1, `after: ${detectHorizon(level)}`);
  assert.equal(detectHorizon(make(20, 20, () => [0.5, 0.5, 0.5])), 0, "flat image: no tilt");
});

test("collage: output size, every cell covered, gap and corners", () => {
  const red = make(30, 20, () => [1, 0, 0]), blue = make(20, 30, () => [0, 0, 1]);
  for (const t of COLLAGE_TEMPLATES) {
    const out = collage([red, blue], t.id, { width: 120, height: 90, gap: 4, radius: 6, background: "#000000" });
    assert.deepEqual([out.width, out.height], [120, 90]);
    collageCells(t.id, 120, 90, 4).forEach((c, i) => {
      const p = px(out, c.x + (c.w >> 1), c.y + (c.h >> 1));
      assert.ok(close(p[i % 2 ? 2 : 0], 1, 1e-3), `${t.id} cell ${i} filled`);
      assert.ok(px(out, c.x, c.y)[0] < 0.5 && px(out, c.x, c.y)[2] < 0.5, `${t.id} cell ${i} rounded corner`);
    });
    assert.deepEqual(px(out, 1, 1), [0, 0, 0, 1], "gap shows the background");
  }
  const grid = collageCells("grid-2x2", 100, 100, 10);
  assert.deepEqual(grid[0], { x: 10, y: 10, w: 35, h: 35 });
  assert.deepEqual(grid[3], { x: 55, y: 55, w: 35, h: 35 });
  assert.equal(collage([red], "2-up", { width: 40, height: 20, background: "transparent" }).data[3], 1);
});
