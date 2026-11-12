// SyncManager: offline queue (persistent), send on reconnect, Idempotency-Key, order, backoff retries, permanent failure.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { createNet } = await import("../../net/index.ts");
const { reply } = await import("../../net/mock.ts");
const { sync, configureSync, disposeSync } = await import("./index.ts");
const { onManager } = await import("../manager.ts");
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));
const until = async (fn, ms = 2000) => { const end = Date.now() + ms; while (!fn()) { if (Date.now() > end) throw new Error("timeout"); await tick(5); } };

const got = [];
let fail = 0, status = 503;
const n = createNet();
n.mock({ "POST /notes": (r) => { if (fail > 0) { fail--; return reply(status, { message: "busy" }); } got.push([r.body.text, r.headers["Idempotency-Key"] ?? r.headers["idempotency-key"]]); return { ok: true }; } }, { delay: 0 });

test("offline: queued and persisted; back online: sent in order with an Idempotency-Key", async () => {
  localStorage.clear();
  const events = [];
  const prev = onManager("*", (e) => e.manager === "sync" && events.push(e.type));
  n.setOnline(false);
  configureSync({ net: n, storageKey: "t.sync", retry: { delay: 10, factor: 2, max: 100, count: 4 } });
  const s = sync();
  const a = s.enqueue({ url: "/notes", body: { text: "one" } });
  s.enqueue({ url: "/notes", body: { text: "two" } });
  assert.equal(s.pending(), 2);
  assert.equal(s.status(), "offline");
  assert.equal(JSON.parse(localStorage.getItem("t.sync")).length, 2, "kept for the next visit");
  n.setOnline(true);
  await until(() => s.pending() === 0);
  assert.deepEqual(got.map((g) => g[0]), ["one", "two"]);
  assert.equal(got[0][1], a.id, "Idempotency-Key = item id");
  assert.equal(s.status(), "idle");
  assert.ok(s.lastSync() > 0);
  assert.ok(events.includes("queued") && events.includes("sent") && events.includes("synced"));
  prev();
});

test("5xx: retried with backoff; 4xx: failed, kept until retried or removed", async () => {
  got.length = 0;
  const s = sync();
  fail = 2; status = 503;
  s.enqueue({ url: "/notes", body: { text: "flaky" } });
  await until(() => s.pending() === 0);
  assert.deepEqual(got.map((g) => g[0]), ["flaky"], "sent after two retries");
  fail = 1; status = 422;
  const x = s.enqueue({ url: "/notes", body: { text: "bad" } });
  await until(() => s.failed() === 1);
  assert.equal(s.status(), "error");
  assert.equal(s.queue()[0].error, "busy");
  s.retry(x.id);
  await until(() => s.queue().length === 0);
  assert.deepEqual(got.map((g) => g[0]), ["flaky", "bad"]);
  fail = 1;
  const y = s.enqueue({ url: "/notes", body: { text: "drop" } });
  await until(() => s.failed() === 1);
  s.remove(y.id);
  assert.equal(s.queue().length, 0);
  disposeSync();
});

test("a new instance sends what the previous visit left", async () => {
  got.length = 0;
  n.setOnline(false);
  configureSync({ net: n, storageKey: "t.sync" });
  sync().enqueue({ url: "/notes", body: { text: "left" } });
  disposeSync();
  n.setOnline(true);
  await tick();
  assert.equal(got.length, 0, "nobody was listening");
  const s = sync();
  await until(() => s.pending() === 0);
  assert.deepEqual(got.map((g) => g[0]), ["left"]);
  disposeSync();
  configureSync({ net: null, storageKey: "hm.sync" });
});
