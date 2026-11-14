import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Loader, bootLoader } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };
const mountD = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Loader: status with visible text, or a screen-reader label; overlay class", () => {
  const el = mount(() => [h(Loader, { text: "Preparing" }), h(Loader, { overlay: true })]);
  const [a, b] = el.querySelectorAll(".hm-loader");
  assert.equal(a.getAttribute("role"), "status");
  assert.equal(a.querySelector(".hm-loader-text").textContent, "Preparing");
  assert.ok(b.classList.contains("hm-loader-overlay"));
  assert.equal(b.querySelector(".hm-sr-only").textContent, "Loading");
});

test("bootLoader.done: hides #hm-boot, false without one", () => {
  assert.equal(bootLoader.done(), false);
  const boot = document.createElement("div");
  boot.id = "hm-boot";
  document.body.appendChild(boot);
  assert.equal(bootLoader.done({ fade: 0 }), true);
  assert.ok(boot.classList.contains("hm-boot-done"));
  assert.equal(boot.getAttribute("aria-hidden"), "true");
});

test("Loader: no spinner, an own spinner, a colour, an own screen-reader label, no fade", () => {
  const m = mountD(() => [h(Loader, { spinner: false, label: "Opening" }), h(Loader, { spinner: h("i", { class: "mine" }), fade: false }), h(Loader, { color: "brand-orange" })]);
  const [a, b, c] = m.el.querySelectorAll(".hm-loader");
  assert.equal(a.querySelector(".hm-loading"), null);
  assert.equal(a.querySelector(".hm-sr-only").textContent, "Opening");
  assert.ok(b.querySelector(".hm-loader-spinner .mine"));
  assert.equal(b.querySelector(".hm-loading"), null);
  assert.ok(b.classList.contains("is-still"));
  assert.equal(c.querySelector(".hm-loading").getAttribute("data-hm-color"), "brand-orange");
  assert.ok(c.querySelector(".hm-loading").classList.contains("hm-spin-single"));
  assert.ok(!c.classList.contains("is-still"));
  m.dispose();
});
