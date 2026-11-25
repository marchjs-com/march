import { test } from "node:test";
import assert from "node:assert/strict";
const D = await import("../index.ts");
const T = await import("./tool.ts");
const S = await import("./select-tools.ts");
const MV = await import("./move.ts");
const ME = await import("./measure.ts");
const V = await import("./view.ts");
const QM = await import("./quick-mask.ts");
const X = await import("../select-extras.ts");
const { ImageDocument } = D;
const { headlessContext, drag, sample, toolDefaults } = T;

const tool = (id) => S.selectTools().find((t) => t.id === id);
const ctxFor = (doc, t, opts = {}, extra = {}) => headlessContext(doc, { ...toolDefaults(t), ...opts }, extra);
const sel = (doc, x, y) => (doc.selection ? doc.selection.data[y * doc.width + x] : 0);
const near = (a, b, eps, msg) => assert.ok(Math.abs(a - b) <= eps, `${msg ?? ""} ${a} ≉ ${b}`);
const key = (t, ctx, k, e = {}) => t.key_(ctx, { key: k, shift: false, alt: false, ctrl: false, meta: false, type: "down", ...e });
const click = (t, ctx, x, y, e = {}) => { t.down?.(ctx, sample(x, y, e)); t.up?.(ctx, sample(x, y, e)); };

/** A white document with a filled colored rectangle on the background. */
function docWith(w, h, paint) {
  const doc = new ImageDocument({ width: w, height: h });
  doc.change("paint", () => paint(doc.layers[0].raster));
  return doc;
}

test("installSelectTools registers every tool once, removable", () => {
  const off = S.installSelectTools();
  for (const id of ["move", "marquee-rect", "marquee-ellipse", "marquee-row", "marquee-column", "lasso", "lasso-polygon", "lasso-magnetic", "magic-wand", "quick-selection", "object-selection", "eyedropper", "color-sampler", "ruler", "note", "count", "hand", "rotate-view", "zoom"]) assert.ok(T.getTool(id), id);
  off();
  assert.equal(T.getTool("marquee-rect"), undefined);
});

test("rectangular marquee: new, Shift add, Alt subtract, Shift+Alt intersect, each one step; click deselects", () => {
  const doc = new ImageDocument({ width: 100, height: 100 });
  const t = tool("marquee-rect"), ctx = ctxFor(doc, t, { antialias: false });
  drag(t, ctx, [[10, 10], [30, 20], [50, 40]]);
  assert.deepEqual(doc.selection.bounds(), { x: 10, y: 10, w: 40, h: 30 });
  drag(t, ctx, [[60, 60], [80, 80]], { shift: true });
  assert.equal(sel(doc, 70, 70), 255); assert.equal(sel(doc, 20, 20), 255);
  drag(t, ctx, [[10, 10], [20, 50]], { alt: true });
  assert.equal(sel(doc, 15, 15), 0); assert.equal(sel(doc, 25, 15), 255);
  drag(t, ctx, [[0, 0], [40, 100]], { alt: true, shift: true });
  assert.equal(sel(doc, 30, 15), 255); assert.equal(sel(doc, 45, 15), 0); assert.equal(sel(doc, 70, 70), 0);
  assert.equal(doc.history.index, 4);
  click(t, ctx, 5, 5);
  assert.equal(doc.selection, null);
  doc.undo();
  assert.ok(doc.selection);
});

test("marquee styles: Shift square, Alt from center, fixed ratio, fixed size, feather, space moves while drawing", () => {
  const doc = new ImageDocument({ width: 100, height: 100 });
  const t = tool("marquee-rect"), ctx = ctxFor(doc, t, { antialias: false });
  drag(t, ctx, [[10, 10], [40, 20]], { shift: true });
  assert.deepEqual(doc.selection.bounds(), { x: 10, y: 10, w: 30, h: 30 }, "square");
  doc.change("d", () => D.select.deselect(doc));
  drag(t, ctx, [[50, 50], [60, 55]], { alt: true });
  assert.deepEqual(doc.selection.bounds(), { x: 40, y: 45, w: 20, h: 10 }, "from center");
  ctx.options = { ...ctx.options, style: "ratio", ratioW: 2, ratioH: 1 };
  drag(t, ctx, [[0, 0], [40, 5]]);
  assert.deepEqual(doc.selection.bounds(), { x: 0, y: 0, w: 40, h: 20 }, "2:1");
  ctx.options = { ...ctx.options, style: "fixed", width: 16, height: 8 };
  click(t, ctx, 30, 30);
  assert.deepEqual(doc.selection.bounds(), { x: 30, y: 30, w: 16, h: 8 }, "fixed size");
  // space: the anchor follows the pointer while held
  ctx.options = { ...ctx.options, style: "normal" };
  t.down(ctx, sample(10, 10));
  t.move(ctx, sample(20, 20));
  key(t, ctx, " ");
  t.move(ctx, sample(30, 30));
  t.key_(ctx, { key: " ", shift: false, alt: false, ctrl: false, meta: false, type: "up" });
  t.move(ctx, sample(40, 40));
  t.up(ctx, sample(40, 40));
  assert.deepEqual(doc.selection.bounds(), { x: 20, y: 20, w: 20, h: 20 }, "moved by space");
  // feather softens the edge
  ctx.options = { ...ctx.options, feather: 3 };
  drag(t, ctx, [[20, 20], [80, 80]]);
  assert.ok(sel(doc, 20, 50) > 40 && sel(doc, 20, 50) < 220, `feathered edge ${sel(doc, 20, 50)}`);
  assert.equal(sel(doc, 50, 50), 255);
});

test("elliptical marquee, single row and single column", () => {
  const doc = new ImageDocument({ width: 100, height: 100 });
  const e = tool("marquee-ellipse"), ctx = ctxFor(doc, e);
  drag(e, ctx, [[20, 20], [80, 80]]);
  assert.equal(sel(doc, 50, 50), 255); assert.equal(sel(doc, 22, 22), 0); assert.equal(sel(doc, 21, 50), 255);
  const row = tool("marquee-row"), rc = ctxFor(doc, row);
  click(row, rc, 5, 7);
  assert.deepEqual(doc.selection.bounds(), { x: 0, y: 7, w: 100, h: 1 });
  const col = tool("marquee-column");
  click(col, ctxFor(doc, col), 3, 9, { shift: true });
  assert.equal(sel(doc, 3, 50), 255); assert.equal(sel(doc, 50, 7), 255);
});

test("lasso and polygonal lasso: clicks, Backspace, Shift 45°, Enter / double click / click on start close", () => {
  const doc = new ImageDocument({ width: 100, height: 100 });
  const l = tool("lasso");
  drag(l, ctxFor(doc, l, { antialias: false }), [[10, 10], [90, 10], [90, 90], [10, 90]]);
  assert.deepEqual(doc.selection.bounds(), { x: 10, y: 10, w: 80, h: 80 });
  const p = tool("lasso-polygon"), ctx = ctxFor(doc, p, { antialias: false });
  click(p, ctx, 10, 10); click(p, ctx, 50, 10); click(p, ctx, 70, 70);
  key(p, ctx, "Backspace");
  click(p, ctx, 50, 50); click(p, ctx, 10, 50);
  assert.ok(p.pending(ctx));
  key(p, ctx, "Enter");
  assert.ok(!p.pending(ctx));
  assert.deepEqual(doc.selection.bounds(), { x: 10, y: 10, w: 40, h: 40 });
  // Shift snaps to 45°: from (10,10) a click at (40,38) lands on the diagonal (≈ 39, 39)
  click(p, ctx, 10, 10); click(p, ctx, 40, 38, { shift: true }); click(p, ctx, 10, 60);
  click(p, ctx, 10.5, 10.5); // on the start: closes
  assert.ok(!p.pending(ctx));
  assert.equal(sel(doc, 30, 31), 255);
  assert.equal(sel(doc, 30, 26), 0);
});

/** A dark disk on white (the edge the magnetic lasso follows). */
const diskDoc = (r = 30, cx = 60, cy = 60, size = 120) => docWith(size, size, (ras) => {
  const px = new Float32Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4, inside = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r;
    px[i] = px[i + 1] = px[i + 2] = inside ? 0.15 : 0.95; px[i + 3] = 1;
  }
  ras.write(0, 0, size, size, px);
});

test("magnetic lasso follows a synthetic edge (live wire) and closes into the disk", () => {
  const doc = diskDoc();
  const t = tool("lasso-magnetic"), ctx = ctxFor(doc, t, { width: 6, frequency: 0, antialias: false });
  // a sloppy hand path 3–5 px off the circle
  const pts = [];
  for (let i = 0; i <= 40; i++) { const a = (i / 40) * Math.PI * 1.9, rr = 30 + (i % 2 ? 4 : -3); pts.push([60 + Math.cos(a) * rr, 60 + Math.sin(a) * rr]); }
  t.down(ctx, sample(pts[0][0], pts[0][1]));
  for (const [i, [x, y]] of pts.entries()) { t.hover(ctx, sample(x, y)); if (i % 8 === 7) click(t, ctx, x, y); }
  // the live path hugs the edge: every point within 2 px of the circle
  const shapes = t.overlay(ctx).find((s) => s.type === "polyline");
  let worst = 0;
  for (const [x, y] of shapes.points) worst = Math.max(worst, Math.abs(Math.hypot(x - 60, y - 60) - 30));
  assert.ok(worst <= 2.2, `path stays on the edge (worst ${worst.toFixed(2)})`);
  key(t, ctx, "Enter");
  let inter = 0, union = 0;
  for (let y = 0; y < 120; y++) for (let x = 0; x < 120; x++) {
    const a = sel(doc, x, y) >= 128, b = Math.hypot(x + 0.5 - 60, y + 0.5 - 60) <= 30;
    if (a && b) inter++; if (a || b) union++;
  }
  assert.ok(inter / union > 0.93, `IoU ${(inter / union).toFixed(3)}`);
});

test("LiveWire: the path between two points on an edge runs along it", () => {
  const doc = diskDoc();
  const lum = S.sampleLuminance(doc, true), w = new S.LiveWire(lum, 120, 120, 0.05);
  w.seed(90, 60);
  const path = w.path(60, 90);
  for (const [x, y] of path) assert.ok(Math.abs(Math.hypot(x - 60, y - 60) - 30) <= 2, `${x},${y}`);
});

test("magic wand: tolerance, contiguous, add", () => {
  const doc = docWith(60, 40, (r) => { r.fill({ x: 0, y: 0, w: 20, h: 40 }, [1, 0, 0, 1]); r.fill({ x: 40, y: 0, w: 20, h: 40 }, [1, 0.05, 0, 1]); });
  const t = tool("magic-wand"), ctx = ctxFor(doc, t, { antialias: false });
  click(t, ctx, 5, 5);
  assert.deepEqual(doc.selection.bounds(), { x: 0, y: 0, w: 20, h: 40 }, "contiguous stops at white");
  ctx.options = { ...ctx.options, contiguous: false };
  click(t, ctx, 5, 5);
  assert.equal(sel(doc, 50, 10), 255, "non-contiguous within tolerance");
  ctx.options = { ...ctx.options, tolerance: 5 };
  click(t, ctx, 5, 5);
  assert.equal(sel(doc, 50, 10), 0, "outside tight tolerance");
  click(t, ctx, 30, 5, { shift: true });
  assert.equal(sel(doc, 30, 5), 255); assert.equal(sel(doc, 5, 5), 255);
});

test("quick selection grows over a region and stops at an edge; Alt subtracts", () => {
  // two equal gray halves (with noise) split by a 2 px dark line at x = 50
  const doc = docWith(100, 60, (r) => {
    const px = new Float32Array(100 * 60 * 4);
    for (let i = 0; i < 6000; i++) { const x = i % 100, v = x === 50 || x === 51 ? 0.05 : 0.5 + ((i * 7919) % 13) / 400; px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v; px[i * 4 + 3] = 1; }
    r.write(0, 0, 100, 60, px);
  });
  const t = tool("quick-selection"), ctx = ctxFor(doc, t, { size: 10 });
  drag(t, ctx, [[20, 30], [30, 30]]);
  assert.equal(doc.history.index, 2, "one step");
  assert.equal(sel(doc, 5, 5), 255, "grew to the far corner");
  assert.equal(sel(doc, 47, 30), 255);
  assert.equal(sel(doc, 53, 30), 0, "stopped at the line");
  assert.equal(sel(doc, 90, 50), 0);
  assert.equal(ctx.options.op, "add", "switches to add after the first stroke");
  drag(t, ctx, [[20, 30]], { alt: true });
  assert.equal(sel(doc, 20, 30), 0, "subtracted");
});

test("object selection: the hook gets the pixels and rect; the fallback finds a blob in the rectangle", async () => {
  const doc = docWith(100, 100, (r) => r.fill({ x: 40, y: 35, w: 20, h: 30 }, [0.1, 0.3, 0.9, 1]));
  const t = tool("object-selection");
  let got = null;
  const hookCtx = ctxFor(doc, t, {}, { shared: { ai: { selectObject: (px, rect) => { got = { w: px.width, rect }; const m = new Uint8Array(rect.w * rect.h).fill(255); return m; } } } });
  drag(t, hookCtx, [[10, 10], [30, 30]]);
  assert.deepEqual(got, { w: 100, rect: { x: 10, y: 10, w: 20, h: 20 } });
  assert.deepEqual(doc.selection.bounds(), { x: 10, y: 10, w: 20, h: 20 });
  const asyncCtx = ctxFor(doc, t, {}, { shared: { ai: { selectObject: async () => null } } });
  drag(t, asyncCtx, [[30, 25], [70, 75]]);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(doc.selection.bounds(), { x: 40, y: 35, w: 20, h: 30 }, "async null → fallback");
  doc.change("d", () => D.select.deselect(doc));
  drag(t, ctxFor(doc, t), [[30, 25], [70, 75]]);
  assert.deepEqual(doc.selection.bounds(), { x: 40, y: 35, w: 20, h: 30 }, "fallback");
});

test("eyedropper: point / averaged samples, current layer vs all, Alt sets the background", () => {
  const doc = docWith(40, 40, (r) => { r.fill({ x: 0, y: 0, w: 20, h: 40 }, [1, 0, 0, 1]); r.fill({ x: 20, y: 0, w: 20, h: 40 }, [0, 0, 1, 1]); });
  doc.change("layer", () => { const l = doc.add(doc.newPixelLayer("top")); l.raster.fill({ x: 0, y: 0, w: 5, h: 5 }, [0, 1, 0, 1]); });
  const t = tool("eyedropper"), ctx = ctxFor(doc, t);
  click(t, ctx, 10, 10);
  assert.deepEqual(ctx.fg, [1, 0, 0, 1]);
  click(t, ctx, 30, 10, { alt: true });
  assert.deepEqual(ctx.bg, [0, 0, 1, 1]);
  ctx.options = { ...ctx.options, sampleSize: "3" };
  click(t, ctx, 20, 10);
  near(ctx.fg[0], 1 / 3, 1e-6, "3×3 across the border: 1 red column, 2 blue"); near(ctx.fg[2], 2 / 3, 1e-6);
  ctx.options = { ...ctx.options, sampleSize: "1", sample: "current" };
  click(t, ctx, 10, 10);
  near(ctx.fg[0], 1 / 3, 1e-6, "a transparent pixel of the current layer does not change fg");
  click(t, ctx, 2, 2);
  assert.deepEqual(ctx.fg, [0, 1, 0, 1]);
  assert.deepEqual(ME.SAMPLE_SIZES, [1, 3, 5, 11, 31, 51, 101]);
});

test("color sampler: add up to 10, drag (one step), Alt deletes", () => {
  const doc = docWith(50, 50, (r) => r.fill({ x: 0, y: 0, w: 25, h: 50 }, [0, 0.5, 0, 1]));
  const t = tool("color-sampler"), ctx = ctxFor(doc, t);
  click(t, ctx, 5, 5);
  assert.equal(doc.samplers.length, 1);
  near(ME.readSampler(doc, doc.samplers[0])[1], 0.5, 0.003);
  drag(t, ctx, [[5.5, 5.5], [20, 20], [40, 40]]);
  assert.deepEqual([doc.samplers[0].x, doc.samplers[0].y], [39, 39]);
  assert.equal(ME.readSampler(doc, doc.samplers[0])[0], 1);
  for (let i = 0; i < 12; i++) click(t, ctx, 2 + (i % 6) * 8, 30 + Math.floor(i / 6) * 10);
  assert.equal(doc.samplers.length, 10);
  click(t, ctx, 39.5, 39.5, { alt: true });
  assert.equal(doc.samplers.length, 9);
  doc.undo();
  assert.equal(doc.samplers.length, 10);
});

test("ruler: W/H/A/L labels and straighten through the callback", () => {
  const doc = new ImageDocument({ width: 100, height: 100 });
  const t = tool("ruler");
  let got = null;
  const ctx = ctxFor(doc, t, {}, { shared: { straighten: (a) => { got = a; } } });
  drag(t, ctx, [[10, 50], [60, 45], [110, 40]]);
  const m = ME.measure(10, 50, 110, 40);
  near(m.angle, (Math.atan2(10, 100) * 180) / Math.PI, 1e-9); near(m.length, Math.hypot(100, 10), 1e-9);
  const label = t.overlay(ctx).find((s) => s.type === "label");
  assert.match(label.text, /W: 100\.0 {2}H: -10\.0 {2}A: 5\.7° {2}L1: 100\.50/);
  const a = t.straighten(ctx);
  near(a, 5.71, 0.01); near(got, a, 1e-12);
  assert.equal(ctx.shared.ruler, undefined);
  near(ME.straightenAngle(ME.measure(0, 0, 2, -100)), -1.15, 0.01, "near-vertical straightens to vertical");
});

test("note and count tools", () => {
  const doc = new ImageDocument({ width: 100, height: 100 });
  const n = tool("note"), nc = ctxFor(doc, n, { author: "Ada" });
  click(n, nc, 20, 30);
  assert.equal(doc.notes.length, 1); assert.equal(doc.notes[0].author, "Ada");
  drag(n, nc, [[20, 30], [50, 60]]);
  assert.deepEqual([doc.notes[0].x, doc.notes[0].y], [50, 60]);
  ME.setNoteText(doc, doc.notes[0].id, "fix the sky");
  assert.equal(doc.notes[0].text, "fix the sky");
  key(n, nc, "Delete");
  assert.equal(doc.notes.length, 0);
  const c = tool("count"), cc = ctxFor(doc, c);
  click(c, cc, 10, 10); click(c, cc, 20, 20); click(c, cc, 30, 30);
  assert.equal(doc.counts.length, 1); assert.equal(doc.counts[0].points.length, 3);
  assert.deepEqual(c.overlay(cc).map((s) => s.text), ["1", "2", "3"]);
  click(c, cc, 21, 21, { alt: true });
  assert.deepEqual(doc.counts[0].points, [[10, 10], [30, 30]]);
});

// ——— move ———

function layered() {
  const doc = new ImageDocument({ width: 200, height: 100 });
  let a, b;
  doc.change("layers", () => {
    a = doc.add(doc.newPixelLayer("A")); a.raster.fill({ x: 10, y: 10, w: 20, h: 20 }, [1, 0, 0, 1]);
    b = doc.add(doc.newPixelLayer("B")); b.raster.fill({ x: 100, y: 50, w: 30, h: 30 }, [0, 0, 1, 1]);
  });
  return { doc, a, b };
}

test("move: drags the active layer (one step), Shift constrains, Alt duplicates, undo restores", () => {
  const { doc, a, b } = layered();
  const t = tool("move"), ctx = ctxFor(doc, t, { snap: false });
  doc.setActive(a.id);
  drag(t, ctx, [[15, 15], [20, 18], [35, 23]]);
  assert.deepEqual(MV.layerBounds(doc, a), { x: 30, y: 18, w: 20, h: 20 });
  assert.equal(doc.history.steps.at(-1).label, "Move");
  doc.undo();
  assert.deepEqual(MV.layerBounds(doc, a), { x: 10, y: 10, w: 20, h: 20 });
  drag(t, ctx, [[15, 15], [45, 19]], { shift: true });
  assert.deepEqual(MV.layerBounds(doc, a), { x: 40, y: 10, w: 20, h: 20 }, "constrained horizontal");
  const n = doc.all().length;
  drag(t, ctx, [[45, 15], [45, 55]], { alt: true });
  assert.equal(doc.all().length, n + 1);
  assert.deepEqual(MV.layerBounds(doc, doc.active), { x: 40, y: 50, w: 20, h: 20 });
  assert.deepEqual(MV.layerBounds(doc, a), { x: 40, y: 10, w: 20, h: 20 }, "original stays");
  void b;
});

test("move: auto-select picks the topmost non-transparent pixel; group target; arrows nudge 1 / 10 px", () => {
  const { doc, a, b } = layered();
  const t = tool("move"), ctx = ctxFor(doc, t, { autoSelect: true, snap: false });
  doc.setActive(b.id);
  drag(t, ctx, [[15, 15], [16, 16]]);
  assert.equal(doc.activeId, a.id);
  assert.equal(MV.layerAt(doc, 150, 5).name, "Background");
  doc.change("group", () => doc.group([a.id]));
  assert.equal(MV.layerAt(doc, 16, 16, "group").kind, "group");
  doc.setActive(b.id);
  key(t, ctx, "ArrowRight"); key(t, ctx, "ArrowDown", { shift: true });
  assert.deepEqual(MV.layerBounds(doc, b), { x: 101, y: 60, w: 30, h: 30 });
});

test("move with a selection: cuts and floats the pixels (one step), selection moves along; Alt copies", () => {
  const doc = docWith(60, 40, (r) => r.fill({ x: 10, y: 10, w: 10, h: 10 }, [1, 0, 0, 1]));
  const t = tool("move"), ctx = ctxFor(doc, t, { snap: false });
  ctx.bg = [1, 1, 1, 1];
  doc.change("sel", () => D.select.combine(doc, D.select.rectMask(doc, { x: 10, y: 10, w: 10, h: 10 }), "new"));
  drag(t, ctx, [[12, 12], [22, 17], [32, 22]]);
  const px = (x, y) => doc.layers[0].raster.get(x, y);
  assert.deepEqual(px(35, 25), [1, 0, 0, 1], "moved");
  assert.deepEqual(px(12, 12), [1, 1, 1, 1], "background fills with the background color");
  assert.deepEqual(doc.selection.bounds(), { x: 30, y: 20, w: 10, h: 10 });
  assert.equal(doc.history.steps.at(-1).label, "Move Selection");
  doc.undo();
  assert.deepEqual(px(12, 12), [1, 0, 0, 1]);
  drag(t, ctx, [[12, 12], [42, 12]], { alt: true });
  assert.deepEqual(px(12, 12), [1, 0, 0, 1], "copy keeps the source");
  assert.deepEqual(px(45, 15), [1, 0, 0, 1]);
  // arrow keys move the selected pixels
  key(t, ctx, "ArrowLeft");
  assert.deepEqual(px(39, 15), [1, 0, 0, 1]);
  assert.deepEqual(doc.selection.bounds(), { x: 39, y: 10, w: 10, h: 10 });
});

test("smart guides snap to the document center and other layers, with lines and distance labels", () => {
  const { doc, a, b } = layered();
  const t = tool("move"), ctx = ctxFor(doc, t);
  doc.setActive(a.id);
  // A (10..30) dragged right by 67: its center 87 snaps to the doc center 100 within 6 px? no: to B's left edge 100 with its right edge
  const r = MV.snapRect(doc, { x: 77, y: 52, w: 20, h: 20 }, MV.snapTargets(doc, new Set([a.id])), { threshold: 6 });
  assert.equal(r.dx, 3, "right edge 97 → B's left 100"); assert.equal(r.dy, -2, "top 52 → B's top 50");
  assert.ok(r.overlay.some((s) => s.type === "line" && s.x1 === 100 && s.x2 === 100));
  const centered = MV.snapRect(doc, { x: 88, y: 0, w: 20, h: 20 }, [], { threshold: 6 });
  assert.equal(centered.dx, 2, "center 98 → 100");
  drag(t, ctx, [[15, 15], [82, 57]]);
  assert.deepEqual(MV.layerBounds(doc, a), { x: 80, y: 50, w: 20, h: 20 }, "snapped while dragging");
  const lbl = MV.snapRect(doc, { x: 60, y: 55, w: 20, h: 20 }, [{ x: 100, y: 50, w: 30, h: 30 }], { threshold: 1 }).overlay.find((s) => s.type === "label");
  assert.equal(lbl.text, "20 px");
  void b;
});

test("align and distribute layers (to layers, to the selection, spacing)", () => {
  const doc = new ImageDocument({ width: 300, height: 100 });
  const ls = [];
  doc.change("l", () => { for (const [x, w] of [[10, 10], [50, 30], [200, 20]]) { const l = doc.add(doc.newPixelLayer()); l.raster.fill({ x, y: 10 + x / 10, w, h: 10 }, [0, 0, 0, 1]); ls.push(l); } });
  const ids = ls.map((l) => l.id);
  MV.alignLayers(doc, ids, "top");
  assert.deepEqual(ls.map((l) => MV.layerBounds(doc, l).y), [11, 11, 11]);
  MV.distributeLayers(doc, ids, "hspace");
  const bx = ls.map((l) => MV.layerBounds(doc, l));
  assert.equal(bx[1].x - (bx[0].x + bx[0].w), bx[2].x - (bx[1].x + bx[1].w), "equal gaps");
  doc.change("s", () => D.select.combine(doc, D.select.rectMask(doc, { x: 100, y: 0, w: 100, h: 100 }), "new"));
  MV.alignLayers(doc, ids, "hcenter");
  for (const l of ls) { const b = MV.layerBounds(doc, l); assert.equal(b.x + b.w / 2, 150); }
  MV.distributeLayers(doc, ids, "vcenter");
  assert.equal(doc.history.steps.at(-1).label !== undefined, true);
});

// ——— view ———

test("view: screen ↔ document with rotation, zoom about a point, fit", () => {
  const v = { zoom: 2, panX: 30, panY: -10, angle: 30 };
  const [sx, sy] = V.docToScreen(v, 12, 34), [x, y] = V.screenToDoc(v, sx, sy);
  near(x, 12, 1e-9); near(y, 34, 1e-9);
  const z = V.zoomAt(v, 8, 100, 50);
  const a = V.screenToDoc(v, 100, 50), b = V.screenToDoc(z, 100, 50);
  near(a[0], b[0], 1e-9); near(a[1], b[1], 1e-9);
  assert.equal(V.stepZoom(1, 1), 2); assert.equal(V.stepZoom(1, -1), 2 / 3);
  const f = V.fitRect({ zoom: 1, panX: 0, panY: 0, angle: 0 }, { x: 0, y: 0, w: 400, h: 200 }, 200, 200, 1);
  near(f.zoom, 0.5, 1e-9);
  assert.deepEqual(V.docToScreen(f, 200, 100), [100, 100]);
  const vr = V.visibleDocRect({ zoom: 1, panX: 0, panY: 0, angle: 90 }, 100, 50);
  assert.deepEqual(vr, { x: 0, y: -100, w: 50, h: 100 });
});

test("hand, zoom (click / Alt / scrubby / marquee) and rotate view (Shift 15°, Esc resets) drive ctx.shared.view", () => {
  const doc = new ImageDocument({ width: 400, height: 300 });
  const ctx = headlessContext(doc, {}, { shared: { view: { zoom: 1, panX: 0, panY: 0, angle: 0 }, viewport: { w: 400, h: 300 } } });
  // UI-like drag: screen points converted with the live view
  const uiDrag = (t, screen, mods = {}) => {
    const at = (s) => V.screenToDoc(ctx.shared.view, s[0], s[1]);
    t.down(ctx, sample(...at(screen[0]), mods));
    for (const s of screen.slice(1)) t.move(ctx, sample(...at(s), mods));
    t.up(ctx, sample(...at(screen[screen.length - 1]), mods));
  };
  const hand = V.handTool();
  uiDrag(hand, [[100, 100], [120, 110], [150, 130]]);
  assert.deepEqual([ctx.shared.view.panX, ctx.shared.view.panY], [50, 30]);
  const zoom = V.zoomTool();
  ctx.options = { scrubby: true };
  uiDrag(zoom, [[200, 150]]);
  assert.equal(ctx.shared.view.zoom, 2);
  uiDrag(zoom, [[200, 150]], { alt: true });
  assert.equal(ctx.shared.view.zoom, 1);
  uiDrag(zoom, [[200, 150], [250, 150], [300, 150]]);
  near(ctx.shared.view.zoom, 2, 1e-9, "scrubby: +100 px doubles");
  ctx.options = { scrubby: false };
  ctx.shared.view = { zoom: 1, panX: 0, panY: 0, angle: 0 };
  uiDrag(zoom, [[0, 0], [100, 75], [200, 150]]);
  near(ctx.shared.view.zoom, 2, 1e-9, "marquee fits 200×150 into 400×300");
  const rot = V.rotateViewTool();
  ctx.shared.view = { zoom: 1, panX: 0, panY: 0, angle: 0 };
  uiDrag(rot, [[300, 150], [290, 180], [280, 190]], { shift: true });
  assert.equal(ctx.shared.view.angle % 15, 0);
  assert.ok(ctx.shared.view.angle > 0);
  key(rot, ctx, "Escape");
  assert.equal(ctx.shared.view.angle, 0);
});

// ——— quick mask ———

test("quick mask: selection → editable overlay channel → selection; masked vs selected areas", () => {
  const doc = new ImageDocument({ width: 50, height: 50 });
  doc.change("s", () => D.select.combine(doc, D.select.rectMask(doc, { x: 10, y: 10, w: 20, h: 20 }), "new"));
  const ctx = headlessContext(doc);
  QM.enterQuickMask(doc, {}, ctx);
  assert.ok(doc.quickMask); assert.equal(doc.selection, null); assert.equal(ctx.shared.target, "quickmask");
  const ch = QM.quickMaskChannel(doc);
  assert.equal(ch.mask.get(15, 15), 0); assert.equal(ch.mask.get(5, 5), 255, "overlay on masked areas");
  // a brush paints white (removes the mask) at (40, 40)
  const t = QM.paintTarget(doc, ctx);
  assert.ok(t.invert);
  doc.change("paint", () => { const d = t.mask.writable(); d[40 * 50 + 40] = 0; });
  const ov = QM.quickMaskOverlay(doc, { x: 0, y: 0, w: 50, h: 50 });
  near(ov.alpha[5 * 50 + 5], 0.5, 1e-6);
  QM.exitQuickMask(doc, ctx);
  assert.ok(!doc.quickMask); assert.equal(QM.quickMaskChannel(doc), null);
  assert.equal(sel(doc, 15, 15), 255); assert.equal(sel(doc, 40, 40), 255); assert.equal(sel(doc, 5, 5), 0);
  QM.enterQuickMask(doc, { indicates: "selected", opacity: 0.3 });
  assert.equal(QM.quickMaskChannel(doc).mask.get(15, 15), 255);
  QM.setQuickMaskOptions(doc, { indicates: "masked" });
  assert.equal(QM.quickMaskChannel(doc).mask.get(15, 15), 0);
  QM.toggleQuickMask(doc);
  assert.equal(sel(doc, 15, 15), 255);
  doc.undo(); doc.undo();
  assert.ok(doc.quickMask, "each toggle is one step");
});

// ——— select extras ———

test("select subject (fallback saliency), sky, focus area", async () => {
  const doc = docWith(120, 90, (r) => {
    const px = new Float32Array(120 * 90 * 4);
    for (let i = 0; i < 120 * 90; i++) { const x = i % 120, y = (i / 120) | 0; px[i * 4] = 0.4; px[i * 4 + 1] = 0.6; px[i * 4 + 2] = 0.85; if (y > 60) { px[i * 4] = 0.35; px[i * 4 + 1] = 0.3; px[i * 4 + 2] = 0.2 + ((x * 31 + y * 17) % 7) / 20; } px[i * 4 + 3] = 1; }
    r.write(0, 0, 120, 90, px);
    r.fill({ x: 45, y: 30, w: 30, h: 25 }, [0.9, 0.2, 0.1, 1]);
  });
  X.selectSubject(doc);
  const b = doc.selection.bounds();
  assert.ok(Math.abs(b.x - 45) <= 3 && Math.abs(b.y - 30) <= 3 && Math.abs(b.w - 30) <= 6 && Math.abs(b.h - 25) <= 6, JSON.stringify(b));
  // hook wins (async)
  await X.selectSubject(doc, { ai: { selectSubject: async () => new Uint8Array(120 * 90).fill(255) } });
  assert.deepEqual(doc.selection.bounds(), { x: 0, y: 0, w: 120, h: 90 });
  X.selectSky(doc);
  assert.equal(sel(doc, 10, 10), 255, "sky top-left"); assert.equal(sel(doc, 10, 80), 0, "ground"); assert.equal(sel(doc, 60, 40), 0, "object");
  const fa = X.focusAreaMask(doc, { range: 0.97 });
  assert.ok(fa.get(60, 75) > fa.get(10, 10), "the textured ground is sharper than the flat sky");
});

test("select and mask: band refinement, outputs, decontaminate; modify wrappers; transform selection; find layers", () => {
  // a soft-edged object: a 0→1 ramp between x = 40 and 50
  const doc = docWith(100, 40, (r) => {
    const px = new Float32Array(100 * 40 * 4);
    for (let i = 0; i < 4000; i++) { const x = i % 100, t = Math.max(0, Math.min(1, (x - 40) / 10)); px[i * 4] = t; px[i * 4 + 1] = 0; px[i * 4 + 2] = 1 - t; px[i * 4 + 3] = 1; }
    r.write(0, 0, 100, 40, px);
  });
  doc.change("s", () => D.select.combine(doc, D.select.rectMask(doc, { x: 45, y: 0, w: 55, h: 40 }, false), "new"));
  const { alpha } = X.refineMatte(doc, { radius: 8 });
  near(alpha[20 * 100 + 42], 0.2, 0.15, "alpha follows the color ramp"); near(alpha[20 * 100 + 48], 0.8, 0.15);
  assert.equal(alpha[20 * 100 + 90], 1); assert.equal(alpha[20 * 100 + 5], 0);
  X.selectAndMask(doc, { radius: 8, output: "selection" });
  assert.ok(sel(doc, 42, 20) > 0 && sel(doc, 42, 20) < 128);
  const n = doc.all().length;
  const made = X.selectAndMask(doc, { radius: 8, output: "layer-mask", decontaminate: 1 });
  assert.equal(doc.all().length, n + 1); assert.ok(made.mask); assert.equal(doc.layers[0].visible, false);
  doc.undo();
  doc.change("s", () => D.select.combine(doc, D.select.rectMask(doc, { x: 10, y: 10, w: 20, h: 10 }, false), "new"));
  X.modifyExpand(doc, 2);
  assert.deepEqual(doc.selection.bounds(), { x: 8, y: 8, w: 24, h: 14 });
  X.modifyContract(doc, 2);
  X.transformSelection(doc, { scaleX: 2, scaleY: 2 });
  assert.deepEqual(doc.selection.bounds(), { x: 0, y: 5, w: 40, h: 20 });
  X.transformSelection(doc, { dx: 5 });
  assert.deepEqual(doc.selection.bounds(), { x: 5, y: 5, w: 40, h: 20 });
  doc.change("l", () => { doc.add(doc.newPixelLayer("Sky A")); doc.add(doc.newPixelLayer("Tree")); doc.add(doc.newGroup("Sky group")); });
  assert.deepEqual(X.findLayers(doc, { name: "sky" }).map((l) => l.name), ["Sky A", "Sky group"]);
  assert.deepEqual(X.findLayers(doc, { kind: "group" }).map((l) => l.name), ["Sky group"]);
  X.selectAllLayers(doc);
  assert.equal(doc.selected.length, doc.all().length - 1);
  doc.setActive(doc.find(X.findLayers(doc, { name: "Tree" })[0].id).id);
  X.selectSimilarLayers(doc);
  assert.ok(doc.selected.every((id) => doc.find(id).kind === "pixel"));
});
