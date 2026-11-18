// march/db: stores, keys, indexes (multi), queries (range, prefix, order, page, filter), update, delete by query,
// transactions, live queries; on the in-memory backend (node has no IndexedDB), which follows IndexedDB's rules.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../testing/dom.ts";

installDom();
const { openDb, compareKeys, inRange } = await import("./index.ts");
const { effect, createRoot: root } = await import("../core/reactive.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));

const open = () => openDb(`t-${Math.random()}`, { version: 1, memory: true, stores: {
  notes: { key: "id", autoIncrement: true, indexes: { byTag: { path: "tags", multi: true }, byDate: "updated", byTitle: "title" } },
  kv: {},
} });

test("keys order like IndexedDB", () => {
  const ks = ["b", 2, [1], new Date(5), "a", 1, [0, 9]];
  ks.sort(compareKeys);
  assert.deepEqual(ks.map((k) => (k instanceof Date ? "D" : k)), [1, 2, "D", "a", "b", [0, 9], [1]]);
  assert.ok(inRange("abc", { prefix: "ab" }) && !inRange("b", { prefix: "a" }) && inRange(3, { gt: 2, lte: 3 }));
});

test("put, autoIncrement, get, find by index, range, prefix, order, page, filter", async () => {
  const db = open(), notes = db.store("notes");
  assert.equal(await db.persistent(), false);
  const k1 = await notes.put({ title: "alpha", tags: ["work", "x"], updated: 3 });
  const [k2, k3] = await notes.putMany([{ title: "beta", tags: ["home"], updated: 1 }, { title: "alphabet", tags: ["work"], updated: 2 }]);
  assert.deepEqual([k1, k2, k3], [1, 2, 3]);
  assert.equal((await notes.get(2)).title, "beta");
  assert.deepEqual((await notes.find({ index: "byTag", eq: "work" })).map((n) => n.id), [1, 3]);
  assert.deepEqual((await notes.find({ index: "byDate", order: "desc" })).map((n) => n.id), [1, 3, 2]);
  assert.deepEqual((await notes.find({ index: "byDate", gte: 2 })).map((n) => n.updated), [2, 3]);
  assert.deepEqual((await notes.find({ index: "byTitle", prefix: "alpha" })).map((n) => n.title), ["alpha", "alphabet"]);
  assert.deepEqual((await notes.find({ index: "byDate", offset: 1, limit: 1 })).map((n) => n.id), [3]);
  assert.deepEqual((await notes.find({ filter: (n) => n.tags.length > 1 })).map((n) => n.id), [1]);
  assert.equal(await notes.count({ index: "byTag", eq: "work" }), 2);
  assert.deepEqual(await notes.keys({ lt: 3 }), [1, 2]);
  assert.equal((await notes.first({ index: "byDate" })).id, 2);
  // a record read back is a copy
  const a = await notes.get(1); a.title = "changed";
  assert.equal((await notes.get(1)).title, "alpha");
  await assert.rejects(notes.add({ id: 1, title: "dup", tags: [], updated: 0 }), /exists/);
});

test("a store without a key path takes the key; update; delete by key and by query; clear", async () => {
  const db = open(), kv = db.store("kv");
  await kv.put("v1", "a"); await kv.put("v2", "b"); await kv.put("v3", "c");
  assert.equal(await kv.get("b"), "v2");
  assert.deepEqual(await kv.getMany(["a", "z"]), ["v1", undefined]);
  assert.equal(await kv.update("a", (v) => `${v}!`), "v1!");
  assert.equal(await kv.get("a"), "v1!");
  await kv.update("a", () => undefined);
  assert.equal(await kv.get("a"), undefined);
  assert.equal(await kv.delete({ gte: "c" }), 1);
  assert.deepEqual(await kv.keys(), ["b"]);
  await kv.clear();
  assert.equal(await kv.count(), 0);
  assert.throws(() => db.store("nope"), /no store/);
});

test("tx: writes over several stores land together", async () => {
  const db = open();
  await db.tx(["notes", "kv"], async (t) => {
    await t.notes.put({ title: "n", tags: [], updated: 1 });
    await t.kv.put(1, "count");
  });
  assert.equal(await db.store("notes").count(), 1);
  assert.equal(await db.store("kv").get("count"), 1);
});

test("live queries follow changes; on() reports them", async () => {
  const db = open(), notes = db.store("notes"), seen = [], changes = [];
  const off = notes.on((c) => changes.push(c.type));
  let one;
  const dispose = root((d) => {
    const work = notes.live({ index: "byTag", eq: "work" });
    one = notes.liveOne(1);
    effect(() => seen.push(work().length));
    return d;
  });
  await tick();
  assert.equal(seen.at(-1), 0);
  await notes.put({ title: "a", tags: ["work"], updated: 1 });
  await tick();
  assert.equal(seen.at(-1), 1);
  assert.equal(one().title, "a");
  await notes.put({ title: "b", tags: ["home"], updated: 1 });
  await notes.delete(1);
  await tick();
  assert.equal(seen.at(-1), 0);
  assert.equal(one(), undefined);
  assert.deepEqual(changes, ["put", "put", "delete"]);
  off(); dispose();
});
