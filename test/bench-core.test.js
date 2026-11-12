// Comparative render benchmark (showcase › Hız › Karşılaştırma): the measurement core — rows, operations, statistics
// and the share-link codec.
import { test } from "node:test";
import assert from "node:assert/strict";
import { rng, rowSource, OPS, stats, t95, factor, rank, encodeResult, decodeResult } from "../examples/showcase/src/bench/core.ts";

test("seeded rows: same seed, same labels; ids keep counting", () => {
  const a = rowSource(7), b = rowSource(7);
  assert.deepEqual(a(5), b(5));
  const next = a(3);
  assert.deepEqual(next.map((r) => r.id), [6, 7, 8]);
  assert.match(next[0].label, /^\w+ \w+ \w+$/);
  const r = rng(1);
  for (let i = 0; i < 1000; i++) { const x = r(); assert.ok(x >= 0 && x < 1); }
});

test("stats: median, sample sd and the 95% interval of the mean", () => {
  const s = stats([5, 1, 3, 2, 4]);
  assert.equal(s.median, 3);
  assert.equal(s.mean, 3);
  assert.equal(s.min, 1);
  assert.equal(s.max, 5);
  assert.ok(Math.abs(s.sd - Math.sqrt(2.5)) < 1e-12);
  const h = t95(4) * Math.sqrt(2.5) / Math.sqrt(5);
  assert.ok(Math.abs(s.ci[0] - (3 - h)) < 1e-12 && Math.abs(s.ci[1] - (3 + h)) < 1e-12);
  assert.equal(stats([4, 2]).median, 3);
  assert.deepEqual(stats([7]).ci, [7, 7]);
  assert.equal(stats([]).n, 0);
  assert.equal(t95(100), 1.96);
});

test("factor and rank: against the baseline, failures last", () => {
  assert.equal(factor(30, 10), 3);
  assert.ok(Number.isNaN(factor(5, 0)));
  const list = [{ id: "a", stats: stats([9]) }, { id: "b", stats: stats([2]), error: "x" }, { id: "c", stats: stats([3]) }, { id: "d", stats: stats([]) }];
  assert.deepEqual(rank(list).map((x) => x.id), ["c", "a", "b", "d"]);
});

/** A tiny in-memory app + DOM probe: every operation's setup → act → check must agree with the contract. */
function fakeApp() {
  let rows = [], sel = -1;
  const app = { run: (r) => { rows = r.slice(); }, add: (r) => { rows = rows.concat(r); }, update: () => { rows = rows.map((x, i) => (i % 10 ? x : { ...x, label: x.label + " !!!" })); },
    swap: () => { if (rows.length > 998) { const x = rows.slice(); [x[1], x[998]] = [x[998], x[1]]; rows = x; } }, clear: () => { rows = []; }, destroy: () => {} };
  const dom = { count: () => rows.length, label: (i) => rows[i].label, id: (i) => String(rows[i].id), selected: (i) => rows[i].id === sel,
    click: (i, link) => { if (link === "lbl") sel = rows[i].id; else rows = rows.filter((_, j) => j !== i); } };
  return { app, dom };
}
test("operations: setup → act passes the check; doing nothing fails it", () => {
  for (const op of OPS) {
    const { app, dom } = fakeApp(), src = rowSource(3);
    op.setup(app, src, dom); op.mark?.(dom); op.act(app, src, dom);
    assert.ok(op.check(dom), `${op.id} check`);
    const idle = fakeApp();
    op.setup(idle.app, src, idle.dom); op.mark?.(idle.dom);
    if (op.id !== "clear" || idle.dom.count()) assert.ok(!op.check(idle.dom), `${op.id}: skipping the work must fail`);
  }
  assert.equal(new Set(OPS.map((o) => o.id)).size, OPS.length);
});

test("share link: deflate + base64url round trip, junk gives null", async () => {
  const r = { v: 1, date: "2026-01-01", env: { ua: "x" }, reps: 3, samples: { vanilla: { create1k: [12.345, 11, 13] } }, errors: {}, firstPaint: { vanilla: 4 }, memory: {} };
  const text = await encodeResult(r);
  assert.match(text, /^[\w-]+$/);
  const back = await decodeResult(text);
  assert.deepEqual(back.samples.vanilla.create1k, [12.3, 11, 13]);
  assert.equal(await decodeResult("not-a-result"), null);
});
