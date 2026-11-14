import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { DevicePreview, DEVICES } = await import("./index.ts");

test("DevicePreview: real screen size, rotation, camera kind; the screen is an overlay scope and an hm-site container", () => {
  const land = signal(false);
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(DevicePreview, { device: "pixel-8", landscape: land, fit: false }, h("p", {}, "site")), host);
  const dev = host.querySelector(".hm-device");
  assert.match(dev.getAttribute("class"), /hm-device-phone/);
  assert.match(dev.getAttribute("class"), /hm-device-cam-punch/);
  assert.equal(dev.style.getPropertyValue("--hm-dev-w"), `${DEVICES["pixel-8"].width}px`);
  land.set(true);
  assert.equal(dev.style.getPropertyValue("--hm-dev-w"), `${DEVICES["pixel-8"].height}px`, "landscape swaps the sides");
  assert.match(dev.getAttribute("class"), /is-landscape/);
  assert.ok(host.querySelector(".hm-device-screen.hm-overlay-scope"), "drawers and dialogs open inside the device");
  assert.equal(host.querySelector(".hm-device-viewport").textContent, "site");
  assert.match(dev.getAttribute("aria-label"), /Pixel 8/);
  dispose();
});

test("DevicePreview: a custom device; touch off removes the touch look", () => {
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(DevicePreview, { device: { name: "Kiosk", width: 600, height: 900, radius: 0, kind: "screen" }, touch: false, fit: false }, "x"), host);
  const dev = host.querySelector(".hm-device");
  assert.equal(dev.style.getPropertyValue("--hm-dev-h"), "900px");
  assert.doesNotMatch(dev.getAttribute("class"), /is-touch/);
  dispose();
});

test("previewFrame: only pages of this site; another origin stays blank", async () => {
  const { previewFrame } = await import("./index.ts");
  const src = signal("/web/product?bare=1");
  const host = document.createElement("div"); document.body.appendChild(host);
  let f;
  const dispose = render(() => (f = previewFrame(src, "p", "x")), host);
  assert.equal(f.tagName.toLowerCase(), "iframe");
  assert.match(f.getAttribute("src"), /^http:\/\/localhost\/web\/product\?bare=1$/);
  src.set("https://evil.example/");
  assert.equal(f.getAttribute("src"), "about:blank");
  dispose();
});

test("DevicePreview: status bar, home indicator and camera off; your own status bar, clock text and label", () => {
  const bar = signal(true);
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(DevicePreview, { device: "pixel-8", fit: false, statusBar: bar, homeIndicator: false, camera: false, time: "9:41", label: "Checkout" }, "x"), host);
  const dev = host.querySelector(".hm-device");
  assert.equal(dev.getAttribute("aria-label"), "Checkout");
  assert.match(dev.getAttribute("class"), /hm-device-cam-none/);
  assert.equal(host.querySelector(".hm-device-time").textContent, "9:41");
  assert.equal(host.querySelector(".hm-device-home").hasAttribute("hidden"), true);
  assert.equal(host.querySelector(".hm-device-status").hasAttribute("hidden"), false);
  bar.set(false);
  assert.equal(host.querySelector(".hm-device-status").hasAttribute("hidden"), true);
  dispose();
  const own = document.createElement("b"); own.textContent = "mine";
  const d2 = render(() => h(DevicePreview, { device: "pixel-8", fit: false, statusBar: own }, "x"), host);
  assert.equal(host.querySelector(".hm-device-status").textContent, "mine");
  assert.equal(host.querySelector(".hm-device-time"), null);
  assert.equal(host.querySelector(".hm-device-home").hasAttribute("hidden"), false);
  assert.match(host.querySelector(".hm-device").getAttribute("class"), /hm-device-cam-punch/);
  d2();
});
