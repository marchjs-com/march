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
