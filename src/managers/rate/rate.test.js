// RateLimitManager: debounce (maxWait, leading, flush, cancel), throttle (leading/trailing), quotas, limit(), pause.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { rateLimit, disposeRateLimit } = await import("./index.ts");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test("debounce: last call after quiet time; maxWait; flush and cancel", async () => {
  disposeRateLimit();
  const calls = [];
  const d = rateLimit().debounce((x) => calls.push(x), 30);
  d(1); d(2); d(3);
  assert.equal(d.pending(), true);
  await wait(50);
  assert.deepEqual(calls, [3]);
  assert.equal(d.pending(), false);
  d(4); d.flush();
  assert.deepEqual(calls, [3, 4]);
  d(5); d.cancel();
  await wait(40);
  assert.deepEqual(calls, [3, 4]);
  const m = rateLimit().debounce((x) => calls.push(x), 30, { maxWait: 45 });
  m("a"); await wait(20); m("b"); await wait(20); m("c");
  await wait(15);
  assert.ok(calls.includes("c") || calls.includes("b"), "maxWait forced a run during the burst");
  m.cancel();
});

test("throttle: leading and trailing", async () => {
  const calls = [];
  const t = rateLimit().throttle((x) => calls.push(x), 30);
  t(1); t(2); t(3);
  assert.deepEqual(calls, [1], "leading");
  await wait(45);
  assert.deepEqual(calls, [1, 3], "trailing with the last arguments");
  t.cancel();
});

test("quota: sliding window, remaining, resetIn, limit(), pause", async () => {
  disposeRateLimit();
  const r = rateLimit();
  const q = r.quota("export", { limit: 2, per: 40 });
  assert.equal(r.quota("export", { limit: 99, per: 1 }), q, "shared by key");
  assert.equal(q.take(), true); assert.equal(q.take(), true);
  assert.equal(q.take(), false);
  assert.equal(q.remaining(), 0);
  assert.ok(q.resetIn() > 0 && q.resetIn() <= 40);
  await wait(50);
  assert.equal(q.remaining(), 2, "window passed");
  let n = 0;
  const inc = r.limit("inc", { limit: 1, per: "1m" }, () => ++n);
  assert.equal(inc(), 1); assert.equal(inc(), undefined);
  r.pause("export", 30);
  assert.equal(q.take(), false, "paused");
  await wait(40);
  assert.equal(q.take(), true);
  disposeRateLimit();
});
