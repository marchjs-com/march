// LogManager: levels, transports, child scopes, redaction, Error entries, beacon batching and gate.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { logger, configureLog, memoryTransport, beaconTransport } = await import("./index.ts");
const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));

test("levels, scopes, fields and redaction", async () => {
  const mem = memoryTransport(10);
  configureLog({ level: "info", transports: [mem], redact: ["password", "token"] });
  const log = logger();
  log.debug("hidden");
  log.info("hello", { n: 1 });
  log.child("auth", { user: 7 }).child("login").warn("failed", { password: "x", nested: { token: "y" } });
  await tick();
  const [warn, info] = mem.entries();
  assert.equal(mem.entries().length, 2, "debug filtered");
  assert.equal(info.msg, "hello");
  assert.equal(warn.scope, "auth.login");
  assert.deepEqual(warn.data, { user: 7, password: "[redacted]", nested: { token: "[redacted]" } });
  log.setLevel("debug");
  log.debug("now visible");
  log.error(new TypeError("boom"));
  await tick();
  const [err, dbg] = mem.entries();
  assert.equal(dbg.msg, "now visible");
  assert.equal(err.msg, "boom");
  assert.equal(err.data.error.name, "TypeError");
});

test("beacon: batches, sends at the batch size, drops when not allowed", () => {
  const sent = [];
  let allowed = true;
  const b = beaconTransport("/log", { batch: 2, minLevel: "warn", allow: () => allowed, send: (u, body) => { sent.push(JSON.parse(body)); return true; } });
  configureLog({ level: "debug", transports: [b], redact: [] });
  const log = logger();
  log.info("not sent (below warn)");
  log.warn("one");
  assert.equal(b.queued(), 1);
  log.error("two");
  assert.equal(sent.length, 1);
  assert.deepEqual(sent[0].map((e) => e.msg), ["one", "two"]);
  allowed = false;
  log.warn("private");
  b.flush();
  assert.equal(sent.length, 1, "gate closed: nothing leaves");
  configureLog({ transports: [] });
});
