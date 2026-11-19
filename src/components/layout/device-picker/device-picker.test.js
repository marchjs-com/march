import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { DevicePicker } = await import("./index.ts");
const { customDevices, removeDevice } = await import("../device-preview/devices.ts");

const items = (host) => [...host.querySelectorAll(".m-dpick-item")];

test("DevicePicker: every device with its size in sections by kind, fit in the top row, a choice sets the value", () => {
  const value = signal("iphone-15");
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(DevicePicker, { value, fit: true }), host);
  const rows = items(host);
  assert.ok(rows.length > 30, "the catalog");
  assert.equal(rows.length, host.querySelectorAll(".m-dpick-grid .m-dpick-item").length, "every device is in a section grid");
  assert.equal(host.querySelectorAll(".m-dpick-section").length, 3, "phones, tablets, desktops and screens");
  const fit = host.querySelector(".m-dpick-fit-btn");
  assert.match(fit.textContent, /Panele sığdır|Fit the panel/);
  const pixel = rows.find((r) => /Pixel 8/.test(r.textContent));
  assert.match(pixel.textContent, /412 × 915/);
  pixel.click();
  assert.equal(value(), "pixel-8");
  fit.click();
  assert.equal(value(), "");
  assert.equal(fit.getAttribute("aria-pressed"), "true");
  dispose();
});

test("DevicePicker: the landscape switch swaps the sizes; no fit, no search", () => {
  const land = signal(false);
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(DevicePicker, { value: signal("ipad"), landscape: land, search: false }), host);
  assert.equal(host.querySelector("input[type=search], .m-search-box"), null);
  assert.equal(host.querySelector(".m-dpick-fit-btn"), null, "no fit without `fit`");
  const ipad = () => items(host).find((r) => /820 × 1180|1180 × 820/.test(r.textContent));
  assert.match(ipad().textContent, /820 × 1180/);
  land.set(true);
  assert.match(ipad().textContent, /1180 × 820/);
  dispose();
});

test("DevicePicker: your own device is saved, chosen and removable", () => {
  const value = signal("");
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(DevicePicker, { value }), host);
  host.querySelector(".m-dpick-add").click();
  const form = host.querySelector(".m-dpick-form");
  assert.ok(form, "the form opens");
  const save = [...form.querySelectorAll("button")].find((b) => /Kaydet|Save/.test(b.textContent));
  save.click();
  assert.match(value(), /^my-/);
  const mine = customDevices().find((d) => d.id === value());
  assert.ok(mine?.own);
  assert.ok(items(host).some((r) => r.textContent.includes(mine.name)), "it is listed (Mine)");
  removeDevice(mine.id);
  dispose();
});
