import { test } from "node:test";
import assert from "node:assert/strict";
const D = await import("./index.ts");
const S = await import("./styles-render.ts");
const { ImageDocument, renderRegion, renderHooks, builtinPatterns } = D;
const { renderStyles, installStyles, contourLut } = S;

const near = (a, b, eps = 1e-3, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} ${a} ≉ ${b}`);
const R = { x: 0, y: 0, w: 40, h: 40 };

/** A 40×40 document with a 20×20 square (10..29) on a layer; `bg` adds a white background. */
function setup(styles, { color = [1, 0, 0, 1], bg = "transparent", fill = 1 } = {}) {
  const doc = new ImageDocument({ width: 40, height: 40, background: bg });
  const l = doc.newPixelLayer("Square");
  l.raster.fill({ x: 10, y: 10, w: 20, h: 20 }, color);
  l.styles = { enabled: true, ...styles };
  l.fill = fill;
  doc.layers.push(l);
  return { doc, l };
}
const run = (doc, l) => renderStyles(doc, l, l.raster.read(R.x, R.y, R.w, R.h), R);
const at = (pass, x, y) => { const i = (y * R.w + x) * 4; return [...pass.px.subarray(i, i + 4)]; };
const alpha = (pass, x, y) => at(pass, x, y)[3];
const shadow = (o) => ({ enabled: true, blend: "normal", color: [0, 0, 0, 1], opacity: 1, angle: 90, distance: 5, spread: 0, size: 0, ...o });
const stroke = (o) => ({ enabled: true, size: 3, position: "outside", blend: "normal", opacity: 1, fill: { type: "color", color: [0, 0, 1, 1] }, ...o });
const bevel = (o) => ({ enabled: true, style: "inner", technique: "chisel-hard", depth: 1, direction: "up", size: 5, soften: 0, angle: 135, altitude: 30, highlight: { blend: "screen", color: [1, 1, 1, 1], opacity: 1 }, shadow: { blend: "multiply", color: [0, 0, 0, 1], opacity: 1 }, ...o });

test("effects off → no passes (style off, or every effect off)", () => {
  const { doc, l } = setup({ dropShadow: [shadow()], stroke: [stroke()] });
  l.styles.enabled = false;
  assert.deepEqual(run(doc, l), []);
  l.styles = { enabled: true, dropShadow: [shadow({ enabled: false })], stroke: [stroke({ enabled: false })], colorOverlay: [{ enabled: false, blend: "normal", opacity: 1, value: [0, 0, 1, 1] }] };
  assert.deepEqual(run(doc, l), []);
});

test("drop shadow: offset by distance along the light angle, under and outside the shape; several; global light; knockout", () => {
  const { doc, l } = setup({ dropShadow: [shadow({ angle: 90 })] });
  let p = run(doc, l);
  assert.equal(p.length, 1); assert.equal(p[0].place, "under");
  near(alpha(p[0], 20, 34), 1, 1e-6, "light from the top: shadow 5 px below");
  near(alpha(p[0], 20, 35), 0, 1e-6);
  near(alpha(p[0], 20, 12), 0, 1e-6, "top edge moved down");
  near(alpha(p[0], 33, 20), 0, 1e-6);
  l.styles.dropShadow = [shadow({ angle: 180 }), shadow({ angle: 90, color: [0, 1, 0, 1] })];
  p = run(doc, l);
  assert.equal(p.length, 2);
  // index 0 is on top → drawn last
  near(alpha(p[1], 34, 20), 1, 1e-6, "light from the left: shadow to the right");
  near(alpha(p[0], 20, 34), 1, 1e-6);
  assert.deepEqual(at(p[0], 20, 34).slice(0, 3), [0, 1, 0]);
  doc.globalLight = { angle: 0, altitude: 30 };
  l.styles.dropShadow = [shadow({ angle: 90, globalLight: true })];
  p = run(doc, l);
  near(alpha(p[0], 5, 20), 1, 1e-6, "global light from the right: shadow to the left");
  near(alpha(p[0], 20, 34), 0, 1e-6);
  // size blurs, spread hardens
  l.styles.dropShadow = [shadow({ size: 6, distance: 0 })];
  const soft = alpha(run(doc, l)[0], 31, 20);
  l.styles.dropShadow = [shadow({ size: 6, distance: 0, spread: 0.5 })];
  assert.ok(alpha(run(doc, l)[0], 31, 20) > soft && soft > 0.05 && soft < 0.6, `spread ${soft}`);
  // knockout clears the shadow under the layer; contour reshapes alpha
  l.styles.dropShadow = [shadow({ knockout: true })];
  near(alpha(run(doc, l)[0], 20, 20), 0, 1e-6);
  l.styles.dropShadow = [shadow({ contour: [[0, 1], [1, 0]] })];
  near(alpha(run(doc, l)[0], 20, 34), 0, 1e-6, "inverted contour");
  near(alpha(run(doc, l)[0], 2, 2), 1, 1e-6);
});

test("stroke: outside adds a ring of exactly size px; inside and center; gradient and pattern fills; scale", () => {
  const { doc, l } = setup({ stroke: [stroke({ size: 3 })] });
  let [p] = run(doc, l);
  assert.equal(p.place, "under");
  for (const x of [30, 31, 32]) near(alpha(p, x, 20), 1, 1e-6, `x=${x}`);
  near(alpha(p, 33, 20), 0, 1e-6);
  for (const y of [7, 8, 9]) near(alpha(p, 20, y), 1, 1e-6, `y=${y}`);
  near(alpha(p, 20, 6), 0, 1e-6);
  near(alpha(p, 20, 20), 0, 1e-6, "interior free");
  l.styles.stroke = [stroke({ size: 2, position: "inside" })];
  [p] = run(doc, l);
  assert.equal(p.place, "over");
  near(alpha(p, 10, 20), 1, 1e-6); near(alpha(p, 11, 20), 1, 1e-6); near(alpha(p, 12, 20), 0, 1e-6); near(alpha(p, 9, 20), 0, 1e-6);
  l.styles.stroke = [stroke({ size: 4, position: "center" })];
  [p] = run(doc, l);
  for (const x of [8, 9, 10, 11]) near(alpha(p, x, 20), 1, 1e-6, `center x=${x}`);
  near(alpha(p, 7, 20), 0, 1e-6); near(alpha(p, 12, 20), 0, 1e-6);
  l.styles.stroke = [stroke({ size: 2 })]; l.styles.scale = 2;
  [p] = run(doc, l);
  near(alpha(p, 33, 20), 1, 1e-6, "scale doubles the size"); near(alpha(p, 34, 20), 0, 1e-6);
  l.styles.scale = 1;
  l.styles.stroke = [stroke({ size: 3, fill: { type: "gradient", gradient: { type: "linear", stops: [{ at: 0, color: [0, 0, 0, 1] }, { at: 1, color: [1, 1, 1, 1] }], from: [0, 0], to: [1, 0], relative: true, method: "classic", smoothness: 0 } } })];
  [p] = run(doc, l);
  assert.ok(at(p, 31, 20)[0] > 0.9 && at(p, 8, 20)[0] < 0.05, "gradient relative to the layer bounds");
  near(alpha(p, 20, 20), 0, 1e-6);
  const pat = builtinPatterns()[0];
  l.styles.stroke = [stroke({ fill: { type: "pattern", pattern: pat, scale: 1 } })];
  [p] = run(doc, l);
  near(at(p, 31, 20)[0], pat.pixels[(4 * pat.width + 31 % pat.width) * 4], 1e-6);
});

test("color overlay recolors inside only; several stack (index 0 on top); fill opacity does not fade it", () => {
  const { doc, l } = setup({ colorOverlay: [{ enabled: true, blend: "normal", opacity: 1, value: [0, 0, 1, 1] }] });
  let p = run(doc, l);
  assert.equal(p.length, 1); assert.equal(p[0].place, "content");
  assert.deepEqual(at(p[0], 20, 20), [0, 0, 1, 1]);
  near(alpha(p[0], 5, 5), 0, 1e-6);
  near(alpha(p[0], 30, 20), 0, 1e-6);
  l.styles.colorOverlay = [{ enabled: true, blend: "normal", opacity: 0.5, value: [0, 1, 0, 1] }, { enabled: true, blend: "normal", opacity: 1, value: [0, 0, 1, 1] }];
  p = run(doc, l);
  const c = at(p[0], 20, 20);
  near(c[1], 0.5); near(c[2], 0.5); near(c[0], 0);
  // fill 0: the layer's pixels vanish, the overlay stays
  l.fill = 0;
  installStyles();
  try {
    const f = renderRegion(doc, { x: 20, y: 20, w: 1, h: 1 });
    near(f[3], 1); near(f[0], 0);
    l.styles.enabled = false;
    near(renderRegion(doc, { x: 20, y: 20, w: 1, h: 1 })[3], 0, 1e-6, "no effects: fill 0 hides the layer");
  } finally { delete renderHooks.styles; }
});

test("inner shadow darkens just inside the edge, on the side towards the light", () => {
  const { doc, l } = setup({ innerShadow: [shadow({ blend: "multiply", distance: 3, angle: 90, size: 0 })] });
  const [p] = run(doc, l);
  assert.equal(p.place, "content");
  near(at(p, 20, 10)[0], 0, 1e-6, "top inner edge in shadow");
  near(at(p, 20, 12)[0], 0, 1e-6);
  near(at(p, 20, 13)[0], 1, 1e-6);
  near(at(p, 20, 29)[0], 1, 1e-6, "bottom edge lit");
  near(at(p, 20, 20)[0], 1, 1e-6);
  near(alpha(p, 20, 5), 0, 1e-6, "nothing outside");
  l.styles.innerShadow = [shadow({ blend: "multiply", distance: 0, size: 4 })];
  const [q] = run(doc, l);
  assert.ok(at(q, 10, 20)[0] < 0.8 && at(q, 20, 20)[0] > 0.999, "blurred: edges darker than the middle");
});

test("bevel & emboss: lit side lighter than the shadow side; direction; outer, emboss, pillow, stroke; soften, texture", () => {
  const { doc, l } = setup({ bevel: bevel() }, { color: [0.5, 0.5, 0.5, 1] });
  let [p] = run(doc, l);
  const v = (x, y, q = p) => at(q, x, y)[0];
  assert.ok(v(12, 20) > 0.6 && v(27, 20) < 0.4, `left lit ${v(12, 20)}, right shaded ${v(27, 20)}`);
  assert.ok(v(20, 12) > 0.6 && v(20, 27) < 0.4, "top lit, bottom shaded");
  near(v(20, 20), 128 / 255, 1e-6, "flat middle untouched");
  l.styles.bevel = bevel({ direction: "down" });
  [p] = run(doc, l);
  assert.ok(v(12, 20) < 0.4 && v(27, 20) > 0.6, "down swaps the sides");
  l.styles.bevel = bevel({ technique: "smooth" });
  [p] = run(doc, l);
  assert.ok(v(12, 20) > 0.5 && v(27, 20) < 0.5, "smooth");
  l.styles.bevel = bevel({ technique: "chisel-soft", soften: 2 });
  [p] = run(doc, l);
  assert.ok(v(12, 20) > 0.5 && v(27, 20) < 0.5, "chisel soft + soften");
  // global light from the right flips it
  doc.globalLight = { angle: 0, altitude: 30 };
  l.styles.bevel = bevel({ globalLight: true });
  [p] = run(doc, l);
  assert.ok(v(27, 20) > 0.6 && v(12, 20) < 0.4, "global light");
  doc.globalLight = { angle: 120, altitude: 30 };
  // outer bevel: shading outside the shape, as under passes
  l.styles.bevel = bevel({ style: "outer" });
  let ps = run(doc, l);
  assert.deepEqual(ps.map((q) => q.place), ["under", "under"]);
  const [sh, hi] = ps;
  assert.ok(alpha(hi, 7, 20) > 0.3 && alpha(sh, 32, 20) > 0.3 && alpha(hi, 32, 20) === 0, "outer: the left outside slope faces the light");
  near(alpha(hi, 20, 20), 0, 1e-6);
  for (const style of ["emboss", "pillow"]) {
    l.styles.bevel = bevel({ style });
    ps = run(doc, l);
    assert.deepEqual(ps.map((q) => q.place), ["under", "under", "content"], style);
  }
  // stroke emboss: on the stroke only, over it
  l.styles.bevel = bevel({ style: "stroke", size: 2 });
  l.styles.stroke = [stroke({ size: 4, position: "inside" })];
  ps = run(doc, l);
  assert.deepEqual(ps.map((q) => q.place), ["over", "over", "over"]);
  assert.ok(alpha(ps[2], 10, 20) > 0.3, "lit left stroke edge");
  near(alpha(ps[2], 20, 20), 0, 1e-6);
  delete l.styles.stroke;
  // texture adds relief inside the flat part
  l.styles.bevel = bevel({ texture: { pattern: builtinPatterns()[0], scale: 1, depth: 1 } });
  [p] = run(doc, l);
  let changed = 0;
  for (let y = 16; y < 24; y++) for (let x = 16; x < 24; x++) if (Math.abs(v(x, y) - 128 / 255) > 0.01) changed++;
  assert.ok(changed > 0, "texture relief");
});

test("glows: outer (softer / precise, gradient, contour), inner (edge / center)", () => {
  const glow = (o) => ({ enabled: true, blend: "normal", color: [1, 1, 0, 1], opacity: 1, spread: 0, size: 4, technique: "precise", ...o });
  const { doc, l } = setup({ outerGlow: glow() });
  let [p] = run(doc, l);
  assert.equal(p.place, "under");
  near(alpha(p, 30, 20), 1, 1e-6); near(alpha(p, 32, 20), 0.5, 1e-6); near(alpha(p, 34, 20), 0, 1e-6);
  l.styles.outerGlow = glow({ technique: "softer" });
  [p] = run(doc, l);
  assert.ok(alpha(p, 30, 20) > alpha(p, 32, 20) && alpha(p, 32, 20) > 0, "softer falls off");
  l.styles.outerGlow = glow({ color: null, gradient: { type: "linear", stops: [{ at: 0, color: [1, 0, 0, 1] }, { at: 1, color: [0, 0, 1, 1] }], from: [0, 0], to: [1, 0], method: "classic", smoothness: 0 } });
  [p] = run(doc, l);
  assert.ok(at(p, 30, 20)[0] > 0.99 && at(p, 33, 20)[2] > 0.7, "gradient from the edge outwards");
  l.styles.outerGlow = glow({ contour: [[0, 0], [1, 0]] });
  near(alpha(run(doc, l)[0], 30, 20), 0, 1e-6, "contour");
  delete l.styles.outerGlow;
  l.styles.innerGlow = glow({ source: "edge" });
  [p] = run(doc, l);
  assert.equal(p.place, "content");
  assert.ok(at(p, 10, 20)[1] > 0.99 && at(p, 20, 20)[1] < 1e-6, "edge glow");
  l.styles.innerGlow = glow({ source: "center" });
  [p] = run(doc, l);
  assert.ok(at(p, 10, 20)[1] < 1e-6 && at(p, 20, 20)[1] > 0.99, "center glow");
  near(alpha(p, 5, 5), 0, 1e-6);
});

test("satin, gradient overlay (relative to the layer bounds), pattern overlay", () => {
  const { doc, l } = setup({ satin: { enabled: true, blend: "normal", color: [0, 0, 0, 1], opacity: 1, angle: 45, distance: 4, size: 2, invert: false } });
  let [p] = run(doc, l);
  const vals = new Set();
  for (let y = 10; y < 30; y++) for (let x = 10; x < 30; x++) vals.add(Math.round(at(p, x, y)[0] * 20));
  assert.ok(vals.size > 2, "satin varies inside");
  near(alpha(p, 5, 5), 0, 1e-6);
  const grad = { type: "linear", stops: [{ at: 0, color: [0, 0, 0, 1] }, { at: 1, color: [1, 1, 1, 1] }], from: [0, 0], to: [1, 0], relative: true, method: "classic", smoothness: 0 };
  l.styles = { enabled: true, gradientOverlay: [{ enabled: true, blend: "normal", opacity: 1, value: grad }] };
  [p] = run(doc, l);
  assert.ok(at(p, 10, 20)[0] < 0.05 && at(p, 29, 20)[0] > 0.95, "black at the left edge, white at the right");
  near(at(p, 20, 20)[0], 0.525, 0.03);
  const pat = builtinPatterns()[2];
  l.styles = { enabled: true, patternOverlay: { enabled: true, blend: "normal", opacity: 1, value: { pattern: pat, scale: 1 } } };
  [p] = run(doc, l);
  const pi = ((20 % pat.height) * pat.width + (15 % pat.width)) * 4;
  for (let c = 0; c < 3; c++) near(at(p, 15, 20)[c], pat.pixels[pi + c], 1e-6);
});

test("contourLut: linear when empty, interpolates points", () => {
  assert.equal(contourLut(undefined), null);
  const lut = contourLut([[0, 0], [0.5, 1], [1, 0]]);
  near(lut[0], 0); near(lut[255], 0); near(lut[128], 1, 0.01); near(lut[64], 0.5, 0.01);
});

test("full compositing through renderRegion: shadow under, stroke around, overlay inside", () => {
  installStyles();
  try {
    const { doc } = setup({
      dropShadow: [shadow({ angle: 90, distance: 6 })],
      stroke: [stroke({ size: 2, fill: { type: "color", color: [0, 1, 0, 1] } })],
      colorOverlay: [{ enabled: true, blend: "multiply", opacity: 1, value: [0.5, 1, 1, 1] }],
    }, { bg: "white" });
    const out = renderRegion(doc, doc.bounds);
    const pix = (x, y) => [...out.subarray((y * 40 + x) * 4, (y * 40 + x) * 4 + 4)].map((v) => Math.round(v * 1000) / 1000);
    assert.deepEqual(pix(20, 20), [0.5, 0, 0, 1], "red × multiply overlay");
    assert.deepEqual(pix(31, 20), [0, 1, 0, 1], "stroke outside");
    assert.deepEqual(pix(32, 20), [1, 1, 1, 1], "background past the stroke");
    assert.deepEqual(pix(20, 34), [0, 0, 0, 1], "shadow below");
    assert.deepEqual(pix(20, 37), [1, 1, 1, 1]);
    // tiled rendering matches the whole render (halo works)
    const part = renderRegion(doc, { x: 18, y: 28, w: 6, h: 9 });
    for (let y = 0; y < 9; y++) for (let x = 0; x < 6; x++) for (let c = 0; c < 4; c++) near(part[(y * 6 + x) * 4 + c], out[((28 + y) * 40 + 18 + x) * 4 + c], 1e-5);
    // opacity of the layer fades its effects too
    doc.layers[1].opacity = 0.5;
    near(renderRegion(doc, { x: 20, y: 34, w: 1, h: 1 })[0], 0.5, 1e-3);
  } finally { delete renderHooks.styles; }
});
