import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document, window } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { DevicePreview, deviceSensors } = await import("./index.ts");
const { allDevices, addDevice, removeDevice, deviceById, isTouch, dprOf, customDevices } = await import("./devices.ts");

test("DevicePreview: the catalog (phones, tablets, desktops), your own devices, a desktop window", () => {
  const all = allDevices();
  assert.ok(all.length >= 30, "dozens of devices");
  for (const k of ["phone", "tablet", "desktop"]) assert.ok(all.some((d) => d.kind === k), k);
  assert.equal(isTouch(deviceById("pixel-8")), true);
  assert.equal(isTouch(deviceById("desktop-1920")), false);
  assert.equal(dprOf(deviceById("macbook-air")), 2);
  const id = addDevice({ name: "Kiosk 2", width: 600, height: 900, kind: "screen", touch: true });
  assert.match(id, /^my-kiosk-2/);
  assert.equal(deviceById(id).own, true);
  assert.ok(customDevices().some((d) => d.id === id));
  removeDevice(id);
  assert.equal(deviceById(id), undefined);
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(DevicePreview, { device: "desktop-1920", fit: false, address: "hadi.app" }, "x"), host);
  const dev = host.querySelector(".m-device");
  assert.match(dev.getAttribute("class"), /m-device-desktop/);
  assert.doesNotMatch(dev.getAttribute("class"), /is-touch/, "a desktop has a mouse");
  assert.equal(host.querySelector(".m-device-bar").hasAttribute("hidden"), false);
  assert.equal(host.querySelector(".m-device-address").textContent, "hadi.app");
  assert.equal(host.querySelector(".m-device-status").hasAttribute("hidden"), true);
  dispose();
});

test("DevicePreview: the control rail turns the device and fires the device's events", () => {
  const land = signal(false), events = [];
  const host = document.createElement("div"); document.body.appendChild(host);
  const off = (e) => events.push(e.type);
  for (const t of ["offline", "online", "orientationchange"]) window.addEventListener(t, off);
  const dispose = render(() => h(DevicePreview, { device: "iphone-15", fit: false, landscape: land, controls: true, onEvent: (n) => events.push(`say:${n}`) }, "x"), host);
  const rail = host.querySelector(".m-device-rail");
  assert.equal(rail.getAttribute("role"), "toolbar");
  const button = (re) => [...rail.querySelectorAll("button")].find((b) => re.test(b.getAttribute("aria-label") ?? ""));
  button(/Turn to landscape|Yatay çevir/).click();
  assert.equal(land(), true, "the rail turns a landscape signal");
  assert.ok(events.includes("orientationchange"));
  button(/Go offline|Çevrimdışı ol/).click();
  assert.ok(events.includes("offline"));
  assert.match(host.querySelector(".m-device-wifi").getAttribute("class"), /is-off/, "the status bar shows it");
  button(/Send to background|Arka plana al/).click();
  assert.equal(host.querySelector(".m-device-away").hasAttribute("hidden"), false);
  button(/Keyboard|Klavye/).click();
  assert.equal(host.querySelector(".m-device-kb").hasAttribute("hidden"), false, "the keyboard opens");
  assert.ok(events.includes("say:offline") && events.includes("say:visibilitychange"));
  for (const t of ["offline", "online", "orientationchange"]) window.removeEventListener(t, off);
  dispose();
});

test("deviceSensors: values for the scope only, battery manager, events; undone on dispose", async () => {
  // a window of its own (the test DOM's elements are its event targets)
  const Target = class { constructor() { return document.createElement("i"); } };
  const win = Object.assign(document.createElement("b"), { navigator: { onLine: true }, document: Object.assign(document.createElement("s"), { visibilityState: "visible", hidden: false }), Event, EventTarget: Target });
  const s = deviceSensors(win, { scope: (stack) => stack.includes("inScopeCall"), dpr: () => 3 });
  function inScopeCall() { return [win.navigator.onLine, win.document.hidden, win.devicePixelRatio]; }
  s.online.set(false); s.hidden.set(true);
  assert.deepEqual(inScopeCall(), [false, true, 3], "the code in the scope reads the device");
  assert.equal(win.navigator.onLine, true, "the rest of the page reads its own");
  let level = 0;
  const bm = await (function inScopeCall() { return win.navigator.getBattery(); })();
  bm.addEventListener("levelchange", () => { level = bm.level; });
  s.battery.set({ level: 0.3, charging: false });
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(level, 0.3);
  s.dispose();
  assert.equal(inScopeCall()[0], true, "undone");
});
