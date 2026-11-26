// march/vault: create, lock / unlock, wrong passphrases slowed down, values and names encrypted on disk (ids are
// HMACs, nothing readable), records bound to their id, passphrase change, reset, live values.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../testing/dom.ts";

installDom();
const { createVault, unlockDelay, VaultError, _resetVaults } = await import("./index.ts");
const { createRoot, effect } = await import("../core/reactive.ts");
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const make = (o = {}) => { _resetVaults(); return createVault({ name: `t${Math.random()}`, memory: true, iterations: 1000, autoLock: 0, ...o }); };
const PASS = "correct horse battery";

test("create, set / get / names, lock, unlock", async () => {
  const v = make();
  await tick();
  assert.equal(v.state(), "new");
  await assert.rejects(v.create("short"), (e) => e instanceof VaultError && e.code === "short");
  await v.create(PASS);
  assert.equal(v.state(), "unlocked");
  await v.set("ai:anthropic", { key: "sk-ant-123" });
  await v.set("ai:openai", { key: "sk-456" });
  await v.set("note", "hi");
  assert.deepEqual(await v.get("ai:anthropic"), { key: "sk-ant-123" });
  assert.deepEqual(await v.names("ai:"), ["ai:anthropic", "ai:openai"]);
  assert.equal(await v.has("note"), true);
  await v.remove("note");
  assert.equal(await v.get("note"), undefined);
  v.lock();
  assert.equal(v.state(), "locked");
  await assert.rejects(v.get("ai:openai"), (e) => e.code === "locked");
  assert.equal(await v.unlock("wrong passphrase"), false);
  assert.equal(await v.unlock(PASS), true);
  assert.deepEqual(await v.get("ai:openai"), { key: "sk-456" });
  await assert.rejects(v.create(PASS), (e) => e.code === "exists");
});

test("nothing readable on disk: ids are HMACs, values and names are ciphertext", async () => {
  const v = make();
  await v.create(PASS);
  await v.set("ai:anthropic", { key: "sk-ant-SECRET" });
  const raw = await v._dump();
  const text = JSON.stringify(raw, (_, x) => (x instanceof ArrayBuffer || ArrayBuffer.isView(x) ? new TextDecoder().decode(x) : x));
  assert.ok(!text.includes("SECRET") && !text.includes("anthropic"), "no plain text on disk");
  assert.equal(raw.items.length, 1);
  assert.match(raw.items[0].id, /^[\w-]{43}$/, "the id is a base64url HMAC-SHA-256");
});

test("wrong tries slow down", async () => {
  assert.deepEqual([0, 1, 2, 3, 4, 5, 20].map(unlockDelay), [0, 0, 0, 1000, 2000, 4000, 300000]);
  const v = make();
  await v.create(PASS);
  v.lock();
  for (let i = 0; i < 3; i++) assert.equal(await v.unlock(`nope${i}`), false);
  assert.ok(v.waitMs() > 0);
  await assert.rejects(v.unlock(PASS), (e) => e.code === "wait" && e.retryIn > 0);
});

test("change passphrase keeps the data; reset removes it", async () => {
  const v = make();
  await v.create(PASS);
  await v.set("x", 1);
  await assert.rejects(v.changePassphrase("bad bad bad bad", "another long one"), (e) => e.code === "wrong");
  await v.changePassphrase(PASS, "another long one");
  v.lock();
  assert.equal(await v.unlock(PASS), false);
  assert.equal(await v.unlock("another long one"), true);
  assert.equal(await v.get("x"), 1);
  await v.reset();
  assert.equal(v.state(), "new");
  await v.create(PASS);
  assert.equal(await v.get("x"), undefined);
});

test("auto-lock and live values", async () => {
  // 300 ms: long enough that a slow CI machine does not lock it between the writes and the reads below (with 30 ms
  // node 22 on CI once saw it locked before the first read); the lock is checked after 360 ms without use
  const v = make({ autoLock: 300 });
  await v.create(PASS);
  await v.set("k", "a");
  const seen = [];
  const dispose = createRoot((d) => { const k = v.value("k"); effect(() => seen.push(k())); return d; });
  await tick(5);
  assert.equal(seen.at(-1), "a");
  await v.set("k", "b");
  await tick(5);
  assert.equal(seen.at(-1), "b");
  await tick(360);
  assert.equal(v.state(), "locked", "locked after 300 ms without use");
  await tick(5);
  assert.equal(seen.at(-1), undefined, "a locked vault shows nothing");
  dispose();
});

test("length and hint: kept beside the vault (shown while locked); a hint that gives the passphrase away is refused", async () => {
  const v = make();
  await assert.rejects(v.create(PASS, { hint: `it is ${PASS}` }), (e) => e.code === "hint");
  await assert.rejects(v.create(PASS, { hint: "correct horse" }), (e) => e.code === "hint", "most of it is too much");
  await v.create(PASS, { hint: "the comic about passwords" });
  v.lock();
  assert.deepEqual(v.info(), { length: PASS.length, hint: "the comic about passwords" });
  await v.changePassphrase(PASS, "ğüşiöç kısa değil", { hint: "" });
  assert.deepEqual(v.info(), { length: 17 }, "counted in characters; no hint");
  const w = make({ rememberLength: false });
  await w.create(PASS);
  assert.deepEqual(w.info(), {}, "rememberLength: false keeps no length");
});
