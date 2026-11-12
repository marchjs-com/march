// SessionManager: start, remaining, warning, extend, expire + onExpire, end, other tabs (storage event), activity.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { session, configureSession, disposeSession } = await import("./index.ts");
const { configureIdle, disposeIdle } = await import("../idle/index.ts");
const { setManagerEmit } = await import("../manager.ts");
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));
const storageEvent = (key, value) => { const e = new Event("storage"); e.key = key; e.newValue = value; window.dispatchEvent(e); };

test("start, warning window, extend, end", () => {
  localStorage.clear();
  configureSession({ duration: 60_000, warnBefore: 10_000, storageKey: "t.session", extendOnActivity: false });
  const s = session();
  assert.equal(s.active(), false);
  s.start();
  assert.equal(s.active(), true);
  assert.ok(s.remaining() > 59_000);
  assert.equal(s.warning(), false);
  assert.ok(JSON.parse(localStorage.getItem("t.session")).exp > Date.now(), "shared with the other tabs");
  s.start(5000);
  assert.equal(s.warning(), true, "5 s left < 10 s warning");
  s.extend();
  assert.ok(s.remaining() <= 5000, "extend uses the last duration");
  s.end();
  assert.equal(s.active(), false);
  assert.equal(JSON.parse(localStorage.getItem("t.session")).exp, null);
  disposeSession();
});

test("expires: onExpire once, events, expired()", async () => {
  const events = [];
  const prev = setManagerEmit((e) => e.manager === "session" && events.push(e.type));
  let expired = 0;
  configureSession({ duration: 50, warnBefore: 1000, storageKey: null, onExpire: () => expired++, extendOnActivity: false });
  session().start();
  await tick(1150);
  assert.equal(session().expired(), true);
  assert.equal(session().active(), false);
  assert.equal(expired, 1);
  assert.deepEqual(events.filter((t) => t !== "start" && t !== "dispose"), ["warn", "expire"]);
  setManagerEmit(prev);
  disposeSession();
});

test("other tabs: extend and sign-out travel through storage; activity extends", () => {
  configureSession({ duration: 60_000, warnBefore: 1000, storageKey: "t.session2", extendOnActivity: true, extendEvery: 0, onExpire: null });
  configureIdle({ throttle: 0 });
  const s = session();
  const far = Date.now() + 120_000;
  storageEvent("t.session2", JSON.stringify({ exp: far, dur: 120_000 }));
  assert.equal(s.expiresAt(), far, "another tab started / extended");
  storageEvent("t.session2", JSON.stringify({ exp: null, dur: 120_000 }));
  assert.equal(s.active(), false, "signed out in another tab");
  s.start(30_000);
  const before = s.expiresAt();
  const t0 = Date.now();
  while (Date.now() === t0) { /* next ms */ }
  document.dispatchEvent(new Event("keydown"));
  assert.ok(s.expiresAt() > before, "activity extended");
  disposeSession();
  disposeIdle();
});
