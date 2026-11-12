import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Loader, bootLoader } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };

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
