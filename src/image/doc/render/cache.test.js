import { test } from "node:test";
import assert from "node:assert/strict";
const D = await import("../index.ts");
const R = await import("./cache.ts");
const W = await import("./worker.ts");
const P = await import("./scratch.ts");
const { ImageDocument, renderRegion, TILE, tileKey } = D;

/** A document with mixed blend modes and a few layers above an active pixel layer. */
function mixed(w = 600, h = 500) {
  const doc = new ImageDocument({ width: w, height: h });
  const ids = {};
  doc.change("build", () => {
    const g = doc.layers[0].raster, px = new Float32Array(w * h * 4);
    for (let i = 0; i < w * h; i++) { const x = i % w, y = (i / w) | 0; px[i * 4] = x / w; px[i * 4 + 1] = y / h; px[i * 4 + 2] = 0.5; px[i * 4 + 3] = 1; }
    g.write(0, 0, w, h, px);
    const m = doc.add(doc.newPixelLayer("multiply")); m.blend = "multiply"; m.raster.fill({ x: 50, y: 40, w: 300, h: 200 }, [0.8, 0.4, 0.2, 1]);
    const s = doc.add(doc.newPixelLayer("screen")); s.blend = "screen"; s.opacity = 0.7; s.raster.fill({ x: 200, y: 150, w: 300, h: 300 }, [0.2, 0.3, 0.9, 0.8]);
    const o = doc.add(doc.newPixelLayer("overlay")); o.blend = "overlay"; o.raster.fill({ x: 0, y: 300, w: 600, h: 100 }, [0.9, 0.9, 0.1, 1]);
    const a = doc.add(doc.newPixelLayer("active")); a.raster.fill({ x: 270, y: 270, w: 60, h: 60 }, [0, 1, 0, 1]); ids.active = a.id;
    const t1 = doc.add(doc.newPixelLayer("top1")); t1.opacity = 0.5; t1.raster.fill({ x: 100, y: 100, w: 400, h: 50 }, [1, 0, 1, 1]);
    const t2 = doc.add(doc.newPixelLayer("top2")); t2.raster.fill({ x: 520, y: 0, w: 80, h: 500 }, [0, 0, 0, 0.5]);
    doc.setActive(a.id);
  });
  return { doc, ids };
}

const maxDiff = (a, b) => { let m = 0; for (let i = 0; i < a.length; i++) m = Math.max(m, Math.abs(a[i] - b[i])); return m; };

test("cache: identical pixels to renderRegion; invalidates exactly the dirty tiles", () => {
  const { doc, ids } = mixed();
  const cache = new R.TileCache(doc);
  assert.deepEqual(cache.region(doc.bounds), renderRegion(doc, doc.bounds));
  assert.equal(cache.stats.renders, 6, "3 × 2 tiles");
  // paint inside tile (1, 1)
  doc.change("paint", () => doc.find(ids.active).raster.fill({ x: 280, y: 280, w: 10, h: 10 }, [1, 0, 0, 1]));
  assert.deepEqual(cache.lastInvalidated, [tileKey(1, 1)]);
  for (const [tx, ty] of [[0, 0], [1, 0], [2, 0], [0, 1], [2, 1]]) assert.ok(cache.has(tx, ty), `${tx},${ty} kept`);
  assert.ok(!cache.has(1, 1));
  assert.deepEqual(cache.region(doc.bounds), renderRegion(doc, doc.bounds));
  assert.equal(cache.stats.renders, 7);
  // a selection change redraws nothing
  doc.change("select", () => D.select.selectAll(doc));
  assert.deepEqual(cache.lastInvalidated, []);
  assert.ok(cache.has(1, 1));
  // undo of the paint: the same tile
  doc.undo(); doc.undo();
  assert.deepEqual(cache.lastInvalidated, [tileKey(1, 1)]);
  assert.deepEqual(cache.region(doc.bounds), renderRegion(doc, doc.bounds));
  // a property change: everything
  doc.change("opacity", () => doc.set(ids.active, { opacity: 0.5 }));
  assert.equal(cache.lastInvalidated.length, 6);
  // live invalidation of a region spanning two tiles
  cache.region(doc.bounds);
  doc.invalidate({ x: 250, y: 10, w: 20, h: 20 }, false, true);
  assert.deepEqual(cache.lastInvalidated.sort(), [tileKey(0, 0), tileKey(1, 0)].sort());
  // display bytes and edge tiles
  const b = cache.bytes(2, 1);
  assert.equal(b.length, (600 - 512) * (500 - 256) * 4);
  assert.deepEqual(b, D.renderRegionBytes(doc, { x: 512, y: 256, w: 88, h: 244 }));
  cache.dispose();
});

test("focus mode: below + flattened above caches, 2 composites per dirty tile, same pixels", () => {
  const { doc, ids } = mixed();
  const cache = new R.TileCache(doc);
  assert.ok(cache.focus(ids.active));
  assert.ok(cache.flattenedAbove);
  const ref = renderRegion(doc, doc.bounds);
  assert.ok(maxDiff(cache.region(doc.bounds), ref) < 1e-5);
  const before = { ...cache.stats };
  doc.change("paint", () => doc.find(ids.active).raster.fill({ x: 280, y: 280, w: 10, h: 10 }, [1, 0, 0, 1]));
  assert.deepEqual(cache.lastInvalidated, [tileKey(1, 1)]);
  cache.tile(1, 1);
  assert.equal(cache.stats.renders, before.renders, "below and above came from the cache");
  assert.equal(cache.stats.focusRenders, before.focusRenders + 1);
  assert.ok(maxDiff(cache.region(doc.bounds), renderRegion(doc, doc.bounds)) < 1e-5);
  // a change in a layer below drops the below cache for that tile
  doc.change("paint below", () => doc.layers[1].raster.fill({ x: 60, y: 50, w: 5, h: 5 }, [0, 0, 0, 1]));
  cache.tile(0, 0);
  assert.equal(cache.stats.renders, before.renders + 2, "below and above re-rendered for the tile");
  assert.ok(maxDiff(cache.region(doc.bounds), renderRegion(doc, doc.bounds)) < 1e-5);
  // a non-normal layer above: no flattening, still exact
  doc.change("mode", () => doc.set(doc.layers[doc.layers.length - 1].id, { blend: "difference" }));
  cache.focus(ids.active);
  assert.ok(!cache.flattenedAbove);
  assert.ok(maxDiff(cache.region(doc.bounds), renderRegion(doc, doc.bounds)) < 1e-5);
  assert.ok(!cache.focus(doc.layers[0].id) || cache.focused === doc.layers[0].id);
  cache.dispose();
});

test("mip pyramid: box-filtered levels, rebuilt for dirty tiles only", () => {
  const { doc, ids } = mixed();
  const cache = new R.TileCache(doc);
  const m1 = cache.mip(1, 0, 0);
  assert.equal(m1.w, 256); assert.equal(m1.h, 250);
  const full = renderRegion(doc, { x: 100, y: 60, w: 2, h: 2 });
  for (let c = 0; c < 4; c++) assert.ok(Math.abs(m1.px[(30 * 256 + 50) * 4 + c] - (full[c] + full[4 + c] + full[8 + c] + full[12 + c]) / 4) < 1e-6);
  const m5 = cache.mip(5, 0, 0);
  assert.equal(m5.w, 19); assert.equal(m5.h, 16);
  assert.equal(cache.mip(1, 2, 0), null);
  assert.equal(R.TileCache.levelFor(1), 0); assert.equal(R.TileCache.levelFor(0.3), 1); assert.equal(R.TileCache.levelFor(0.01), 5);
  doc.change("paint", () => doc.find(ids.active).raster.fill({ x: 280, y: 280, w: 4, h: 4 }, [1, 0, 0, 1]));
  assert.notEqual(cache.mip(1, 0, 0).px, m1.px, "the mip over the dirty tile was rebuilt");
  cache.dispose();
});

test("worker pool: snapshots carry only the needed tiles; inline and message-passing workers render the same", async () => {
  const { doc } = mixed();
  const r = { x: 256, y: 256, w: 256, h: 244 };
  const { snapshot, transfer } = W.snapshotDoc(doc, r);
  for (const ras of snapshot.rasters) for (const [k] of ras.tiles) { const tx = D.keyTx(k), ty = D.keyTy(k); assert.ok(tx >= 1 && ty >= 1, "only tiles over the rect"); }
  assert.ok(transfer.length > 0);
  const ref = renderRegion(doc, r);
  assert.deepEqual(W.renderInWorker(snapshot, r), ref);
  const inline = new W.WorkerPool();
  assert.ok(inline.inline);
  assert.deepEqual(await inline.render(doc, r), ref);
  // a fake worker: structured clone both ways, workerMain on the other side
  const pool = new W.WorkerPool({ size: 2, create: () => {
    const scope = { onmessage: null, postMessage: (m) => queueMicrotask(() => w.onmessage({ data: structuredClone(m) })) };
    const w = { onmessage: null, postMessage: (m) => queueMicrotask(() => scope.onmessage({ data: structuredClone(m) })), terminate() {} };
    W.workerMain(scope);
    return w;
  } });
  const out = new Float32Array(doc.width * doc.height * 4);
  await pool.renderTiles(doc, doc.bounds, (tr, px) => { for (let y = 0; y < tr.h; y++) out.set(px.subarray(y * tr.w * 4, (y + 1) * tr.w * 4), ((tr.y + y) * doc.width + tr.x) * 4); });
  assert.deepEqual(out, renderRegion(doc, doc.bounds));
  pool.dispose();
});

test("scratch pager: pages out hidden / least recently used tiles over budget and faults them back on read", async () => {
  const { doc, ids } = mixed();
  const ref = renderRegion(doc, doc.bounds);
  const hidden = doc.layers[2];
  doc.change("hide", () => doc.set(hidden.id, { visible: false }));
  const refHidden = renderRegion(doc, doc.bounds);
  const store = new P.MemoryScratch();
  const pager = new P.Pager(doc, store, { budget: 1 });
  const before = pager.resident();
  pager.budget = before - 1;
  const freed = pager.check();
  assert.ok(freed > 0 && pager.resident() < before);
  assert.ok(store.size > 0);
  assert.ok(hidden.raster.tiles instanceof P.PagedTiles && hidden.raster.tiles.paged.size > 0, "the hidden layer went first");
  assert.equal(doc.find(ids.active).raster.tiles instanceof P.PagedTiles, false, "the active layer stays");
  assert.deepEqual(renderRegion(doc, doc.bounds), refHidden, "renders the same");
  doc.change("show", () => doc.set(hidden.id, { visible: true }));
  assert.deepEqual(renderRegion(doc, doc.bounds), ref, "faulted back on read");
  // a big squeeze pages inactive visible layers too (synchronous store), reads still exact
  pager.budget = 1; pager.target = 0;
  pager.check();
  assert.deepEqual(renderRegion(doc, doc.bounds), ref);
  await pager.restoreAll();
  assert.equal(store.size, 0);
  pager.dispose();
});

test("benchmark: 3840×2160, 50 layers (mixed modes): one dirty tile in focus mode repaints in < 4 ms", () => {
  const W4 = 3840, H4 = 2160;
  const doc = new ImageDocument({ width: W4, height: H4 });
  const modes = ["normal", "multiply", "screen", "overlay", "soft-light", "darken", "lighten", "color-dodge", "difference", "luminosity"];
  let active;
  doc.change("build", () => {
    // one textured raster shared copy-on-write by every layer (memory stays small), at different offsets
    const base = new D.TiledRaster(8), px = new Float32Array(1024 * 1024 * 4);
    for (let i = 0; i < 1024 * 1024; i++) { const x = i & 1023, y = i >> 10; px[i * 4] = (x ^ y) / 1024; px[i * 4 + 1] = x / 1024; px[i * 4 + 2] = y / 1024; px[i * 4 + 3] = (x + y) % 3 ? 1 : 0.6; }
    base.write(0, 0, 1024, 1024, px);
    const bg = doc.layers[0].raster;
    bg.fill({ x: 0, y: 0, w: W4, h: H4 }, [0.5, 0.5, 0.5, 1]);
    for (let i = 0; i < 49; i++) {
      const l = doc.add(doc.newPixelLayer(`L${i}`));
      l.raster = base.clone();
      l.raster.ox = (i * 397) % (W4 - 1024); l.raster.oy = (i * 211) % (H4 - 1024);
      if (i < 44) { l.blend = modes[i % modes.length]; l.opacity = 0.6 + (i % 4) / 10; }
      if (i === 44) { active = l; l.raster = new D.TiledRaster(8); l.raster.fill({ x: 1000, y: 1000, w: 600, h: 600 }, [0.1, 0.8, 0.3, 1]); }
    }
    doc.setActive(active.id);
  });
  assert.equal(doc.all().length, 50);
  const cache = new R.TileCache(doc);
  cache.focus(active.id);
  assert.ok(cache.flattenedAbove);
  const t0 = performance.now();
  const cols = Math.ceil(W4 / TILE), rows = Math.ceil(H4 / TILE);
  for (let ty = 0; ty < rows; ty++) for (let tx = 0; tx < cols; tx++) cache.tile(tx, ty);
  const first = performance.now() - t0;
  // exact against the compositor on a sample tile
  const tr = cache.tileRect(5, 5);
  assert.ok(maxDiff(cache.tile(5, 5), renderRegion(doc, tr)) < 1e-5);
  const times = [];
  for (let i = 0; i < 25; i++) {
    doc.change("dab", () => active.raster.fill({ x: 1100 + i, y: 1100, w: 8, h: 8 }, [1, 0, 0, 1]));
    assert.equal(cache.lastInvalidated.length, 1);
    const s = performance.now();
    cache.tile(4, 4);
    if (i >= 5) times.push(performance.now() - s); // the first repaints warm the JIT up
  }
  assert.ok(maxDiff(cache.tile(4, 4), renderRegion(doc, cache.tileRect(4, 4))) < 1e-5, "the repainted tile is exact");
  times.sort((a, b) => a - b);
  const median = times[times.length >> 1];
  console.log(`# 4K × 50 layers: first full render ${first.toFixed(0)} ms (${cols * rows} tiles), focus repaint of one tile: median ${median.toFixed(2)} ms, min ${times[0].toFixed(2)} ms`);
  assert.ok(median < 4, `focus repaint ${median.toFixed(2)} ms`);
  cache.dispose();
});
