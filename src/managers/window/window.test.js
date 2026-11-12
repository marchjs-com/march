// WindowManager: visibility, focus, other tabs (BroadcastChannel), leader, messages, events.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
// a fake BroadcastChannel network (the real one needs Node's own Event class, which the fake DOM replaces)
const bcNet = new Set();
globalThis.BroadcastChannel = class {
  constructor(name) { this.name = name; this.onmessage = null; bcNet.add(this); }
  postMessage(data) { const c = structuredClone(data); for (const o of bcNet) if (o !== this && o.name === this.name) queueMicrotask(() => o.onmessage?.({ data: structuredClone(c) })); }
  close() { bcNet.delete(this); }
};
const { appWindow, configureWindow, disposeWindow } = await import("./index.ts");
const { onManager } = await import("../manager.ts");
const tick = (ms = 10) => new Promise((r) => setTimeout(r, ms));

test("other tabs: count, leader, messages, bye", async () => {
  configureWindow({ channel: "test:window", heartbeat: 50, ttl: 150 });
  const events = [];
  const prev = onManager("*", (e) => events.push(`${e.manager}:${e.type}`));
  const w = appWindow();
  assert.equal(w.count(), 1);
  assert.equal(w.leader(), true, "alone = leader");
  const other = new BroadcastChannel("test:window");
  const said = [];
  other.onmessage = (e) => said.push(e.data.k);
  other.postMessage({ k: "hello", from: "older", since: 1, visible: true, focused: false });
  await tick(20);
  assert.equal(w.count(), 2);
  assert.equal(w.leader(), false, "an older tab leads");
  assert.ok(said.includes("ping"), "a new tab is answered");
  const got = [];
  w.on("cart", (d, from) => got.push([d, from]));
  other.postMessage({ k: "msg", from: "older", since: 1, visible: true, focused: false, type: "cart", data: { n: 3 } });
  await tick(20);
  assert.deepEqual(got, [[{ n: 3 }, "older"]]);
  w.broadcast("cart", { n: 4 });
  await tick(20);
  assert.ok(said.includes("msg"));
  other.postMessage({ k: "bye", from: "older", since: 1, visible: true, focused: false });
  await tick(20);
  assert.equal(w.count(), 1);
  assert.equal(w.leader(), true);
  assert.ok(events.includes("window:tabs") && events.includes("window:leader") && events.includes("window:message"));
  other.close();
  prev();
  disposeWindow();
});

test("a silent tab is dropped after ttl; visibility and focus", async () => {
  configureWindow({ channel: "test:window2", heartbeat: 20, ttl: 60 });
  const w = appWindow();
  const other = new BroadcastChannel("test:window2");
  other.postMessage({ k: "hello", from: "x", since: Date.now() + 1, visible: true, focused: false });
  await tick(15);
  assert.equal(w.count(), 2);
  assert.equal(w.leader(), true, "this tab is older");
  await tick(120);
  assert.equal(w.count(), 1, "silent tab gone");
  document.visibilityState = "hidden";
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(w.visible(), false);
  document.visibilityState = "visible";
  document.dispatchEvent(new Event("visibilitychange"));
  assert.equal(w.visible(), true);
  window.dispatchEvent(new Event("blur"));
  assert.equal(w.focused(), false);
  window.dispatchEvent(new Event("focus"));
  assert.equal(w.focused(), true);
  other.close();
  disposeWindow();
});
