// CacheManager: ttl, LRU, tags, wrap dedupe, stale-while-revalidate, net.invalidate, reactive stats.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { appCache, configureCache } = await import("./index.ts");
const { Net, onInvalidate } = await import("../../net/core.ts");
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test("set / get with ttl and LRU eviction", async () => {
  configureCache({ maxEntries: 2, ttl: "5m" });
  const c = appCache();
  c.set("a", 1); c.set("b", 2);
  assert.equal(c.get("a"), 1, "touch a: b is now the oldest");
  c.set("c", 3);
  assert.equal(c.has("b"), false, "least recently used evicted");
  assert.ok(c.has("a") && c.has("c"));
  c.set("old", 1, { ttl: 1 });
  await tick(5);
  assert.equal(c.get("old"), undefined, "expired");
  await tick(0);
  const s = c.stats();
  assert.ok(s.hits >= 1 && s.misses >= 1 && s.evictions >= 1);
});

test("wrap: one load per key at a time; stale-while-revalidate", async () => {
  configureCache({ maxEntries: 50, ttl: 20 });
  const c = appCache();
  let loads = 0;
  const load = async () => { loads++; await tick(5); return loads; };
  const [a, b] = await Promise.all([c.wrap("k", load), c.wrap("k", load)]);
  assert.equal(loads, 1, "deduped");
  assert.equal(a, 1); assert.equal(b, 1);
  assert.equal(await c.wrap("k", load), 1, "fresh: from cache");
  await tick(30);
  assert.equal(await c.wrap("k", load, { swr: true }), 1, "stale value at once");
  await tick(15);
  assert.equal(c.peek("k"), 2, "refreshed in the background");
});

test("tags, prefixes and net.invalidate()", () => {
  configureCache({ maxEntries: 50, ttl: "5m" });
  const c = appCache();
  const off = c.follow(onInvalidate);
  c.set("users:1", 1); c.set("users:2", 2); c.set("rates", 3, { tags: ["money"] });
  assert.equal(c.invalidate("money"), 1);
  new Net().invalidate("users");
  assert.equal(c.has("users:1") || c.has("users:2"), false, "net.invalidate clears this cache too");
  assert.deepEqual(c.entries(), []);
  off();
  c.set("users:3", 3);
  new Net().invalidate("users");
  assert.equal(c.has("users:3"), true, "off: no longer follows");
});
