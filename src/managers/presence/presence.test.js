// PresenceManager: active / idle / away / offline, report, other tabs (overall), peers.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const bcNet = new Set();
globalThis.BroadcastChannel = class {
  constructor(name) { this.name = name; this.onmessage = null; bcNet.add(this); }
  postMessage(data) { const c = structuredClone(data); for (const o of bcNet) if (o !== this && o.name === this.name) queueMicrotask(() => o.onmessage?.({ data: structuredClone(c) })); }
  close() { bcNet.delete(this); }
};
Object.defineProperty(globalThis, "navigator", { configurable: true, value: { onLine: true } });
const { presence, configurePresence, disposePresence } = await import("./index.ts");
const { configureIdle, disposeIdle } = await import("../idle/index.ts");
const { configureWindow, disposeWindow } = await import("../window/index.ts");
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

test("state from idle, visibility and the connection; report on change", async () => {
  configureIdle({ timeout: 30, throttle: 0 });
  configureWindow({ channel: "t.presence", heartbeat: 1000, ttl: 3000 });
  const sent = [];
  configurePresence({ report: (s) => sent.push(s), heartbeat: 0 });
  const p = presence();
  assert.equal(p.state(), "active");
  assert.deepEqual(sent, ["active"], "first report");
  await tick(60);
  assert.equal(p.state(), "idle");
  document.dispatchEvent(new Event("keydown"));
  assert.equal(p.state(), "active");
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(p.state(), "away");
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  navigator.onLine = false;
  window.dispatchEvent(new Event("offline"));
  assert.equal(p.state(), "offline");
  navigator.onLine = true;
  window.dispatchEvent(new Event("online"));
  assert.equal(p.state(), "active");
  assert.deepEqual(sent.slice(0, 4), ["active", "idle", "active", "away"]);
  assert.equal(sent.at(-1), "active");
});

test("other tabs: overall is the most present; peers from the server", async () => {
  const p = presence();
  const other = new BroadcastChannel("t.presence");
  other.postMessage({ k: "hello", from: "tab2", since: 1, visible: false, focused: false });
  other.postMessage({ k: "msg", from: "tab2", since: 1, visible: false, focused: false, type: "presence", data: "away" });
  await tick();
  assert.deepEqual(p.tabs().map((t) => [t.id, t.state]), [["tab2", "away"]]);
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(p.state(), "away");
  other.postMessage({ k: "msg", from: "tab2", since: 1, visible: true, focused: true, type: "presence", data: "active" });
  await tick();
  assert.equal(p.overall(), "active", "another tab is in use");
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  p.setPeer("u1", "idle", { name: "Alex" });
  p.setPeer("u2", "active");
  assert.deepEqual(p.peers().map((x) => x.state), ["idle", "active"]);
  p.removePeer("u1");
  assert.deepEqual(p.peers().map((x) => x.id), ["u2"]);
  other.close();
  disposePresence(); disposeIdle(); disposeWindow();
  configureIdle({ timeout: 60_000, throttle: 250 });
});
