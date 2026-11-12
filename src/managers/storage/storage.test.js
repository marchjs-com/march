// StorageManager: areas, prefix, ttl, versions and migrations, blocked storage, persisted signals, other tabs, IndexedDB fallback.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { storage, persisted, configureStorage, disposeStorage } = await import("./index.ts");
const { channel } = await import("../../channel/index.ts");

test("local / session / memory: same API, prefix, envelope, ttl", async () => {
  localStorage.clear(); configureStorage({ prefix: "t.", version: 1, migrations: {} });
  const s = storage();
  s.local.setSync("a", { x: 1 });
  assert.deepEqual(s.local.getSync("a"), { x: 1 });
  assert.deepEqual(JSON.parse(localStorage.getItem("t.a")), { v: 1, d: { x: 1 } }, "prefixed, versioned envelope");
  await s.area("session").set("b", 2);
  assert.equal(await s.session.get("b"), 2);
  s.memory.setSync("m", "x");
  assert.deepEqual(s.memory.keysSync(), ["m"]);
  assert.deepEqual(await s.local.keys(), ["a"]);
  s.local.setSync("short", 1, { ttl: -1 });
  assert.equal(s.local.getSync("short", "gone"), "gone", "expired");
  assert.equal(localStorage.getItem("t.short"), null, "expired value removed");
  await s.local.clear();
  assert.deepEqual(s.local.keysSync(), []);
});

test("versions: an old value is migrated step by step on read and written back", async () => {
  localStorage.clear();
  localStorage.setItem("t.prefs", JSON.stringify({ v: 1, d: { theme: "dark" } }));
  configureStorage({ prefix: "t.", version: 3, migrations: { 2: (v) => ({ ...v, dense: false }), 3: (v, key) => ({ ...v, key }) } });
  const seen = [];
  const off = channel("managers.storage").on((m) => seen.push(m.type));
  assert.deepEqual(storage().local.getSync("prefs"), { theme: "dark", dense: false, key: "prefs" });
  assert.equal(JSON.parse(localStorage.getItem("t.prefs")).v, 3, "written back at the new version");
  localStorage.setItem("t.other", JSON.stringify({ v: 2, d: {} }));
  assert.equal(await storage().migrate("local"), 1, "migrate() lifts what is left");
  assert.ok(seen.includes("migrate"));
  off();
});

test("blocked storage falls back to memory and reports an error", () => {
  configureStorage({ prefix: "t.", version: 1, migrations: {} });
  const real = localStorage.setItem;
  localStorage.setItem = () => { throw new Error("QuotaExceededError"); };
  try {
    const s = storage();
    s.local.setSync("big", "x");
    assert.equal(s.local.getSync("big"), "x", "still readable from memory");
    assert.equal(s.persistent("local"), false);
  } finally { localStorage.setItem = real; }
});

test("persisted(): a signal kept in storage that follows other tabs", () => {
  localStorage.clear(); disposeStorage(); configureStorage({ prefix: "t.", version: 1, migrations: {} });
  const theme = persisted("theme", "light");
  assert.equal(theme(), "light");
  theme.set("dark");
  assert.equal(storage().local.getSync("theme"), "dark");
  assert.equal(persisted("theme", "light")(), "dark", "read back");
  localStorage.setItem("t.theme", JSON.stringify({ v: 1, d: "sepia" }));
  const ev = new Event("storage"); ev.key = "t.theme"; ev.newValue = "x";
  globalThis.dispatchEvent(ev);
  assert.equal(theme(), "sepia", "another tab's write arrives");
});

test("idb: without IndexedDB the area keeps working in memory", async () => {
  disposeStorage();
  const s = storage();
  await s.idb.set("draft", { body: "hi" });
  assert.deepEqual(await s.idb.get("draft"), { body: "hi" });
  assert.deepEqual(await s.idb.keys(), ["draft"]);
  assert.equal(s.persistent("idb"), false);
});
