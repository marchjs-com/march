// DeviceManager: memory, cores, touch, network signal + event, battery, features, lowEnd / slowNetwork, storage.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { device, configureDevice, disposeDevice } = await import("./index.ts");
const { onManager } = await import("../manager.ts");
// a minimal event target (the fake DOM replaces Event, which Node's own EventTarget rejects)
const target = (props) => { const l = {}; return Object.assign({ addEventListener(t, f) { (l[t] ??= new Set()).add(f); }, removeEventListener(t, f) { l[t]?.delete(f); }, fire(t) { for (const f of [...(l[t] ?? [])]) f(); } }, props); };
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

const conn = target({ type: "wifi", effectiveType: "4g", downlink: 10, rtt: 50, saveData: false });
const battery = target({ level: 0.5, charging: false });
const nav = {
  deviceMemory: 2, hardwareConcurrency: 8, maxTouchPoints: 5, userAgent: "Mozilla/5.0 (Linux; Android 14) Mobile", connection: conn,
  getBattery: () => Promise.resolve(battery), vibrate: () => true, share: () => Promise.resolve(),
  storage: { estimate: () => Promise.resolve({ usage: 1000, quota: 5000 }), persisted: () => Promise.resolve(true) },
};
Object.defineProperty(globalThis, "navigator", { value: nav, configurable: true });

test("capabilities, low-end and features", async () => {
  disposeDevice();
  const d = device();
  assert.equal(d.memory(), 2);
  assert.equal(d.cores(), 8);
  assert.ok(d.touch() && d.touchPoints() === 5);
  assert.equal(d.mobile(), true);
  assert.equal(d.lowEnd(), true, "2 GB is low");
  configureDevice({ lowMemory: 1 });
  assert.equal(device().lowEnd(), false);
  assert.equal(d.supports("share"), true);
  assert.equal(d.supports("bluetooth"), false);
  assert.equal(d.features().vibrate, true);
  assert.equal(d.vibrate(50), true);
  assert.deepEqual(await device().storage(), { usage: 1000, quota: 5000, persisted: true });
});

test("network and battery are signals with events", async () => {
  disposeDevice();
  const events = [];
  const prev = onManager("*", (e) => events.push(e));
  const d = device();
  assert.equal(d.network().effectiveType, "4g");
  assert.equal(d.slowNetwork(), false);
  conn.effectiveType = "2g";
  conn.fire("change");
  assert.equal(d.network().effectiveType, "2g");
  assert.equal(d.slowNetwork(), true);
  assert.equal(d.battery(), null, "unknown until getBattery resolves");
  await tick();
  assert.deepEqual(d.battery(), { level: 0.5, charging: false });
  battery.charging = true;
  battery.fire("chargingchange");
  assert.equal(d.battery().charging, true);
  assert.ok(events.some((e) => e.type === "network" && e.detail.effectiveType === "2g"));
  assert.ok(events.some((e) => e.type === "battery"));
  disposeDevice();
  conn.effectiveType = "4g";
  conn.fire("change");
  prev();
});
