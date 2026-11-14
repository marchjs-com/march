import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Spinner } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };
const mountD = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("Spinner: role status with a label, size class, colours as a conic paint", () => {
  const el = mount(() => [h(Spinner, { size: "lg", label: "Loading users" }), h(Spinner, { colors: ["brand-blue", "brand-green"] }), h(Spinner, { colors: "single" })]);
  const [a, b, c] = el.querySelectorAll(".hm-loading");
  assert.equal(a.getAttribute("role"), "status");
  assert.equal(a.getAttribute("aria-label"), "Loading users");
  assert.ok(a.classList.contains("hm-spin-lg"));
  assert.equal(b.getAttribute("data-hm-colors"), "custom");
  assert.match(b.style.getPropertyValue("--hm-spinner-paint"), /conic-gradient/);
  assert.ok(c.classList.contains("hm-spin-single"));
});

test("Spinner: one colour token paints a single-colour ring", () => {
  const m = mountD(() => [h(Spinner, { color: "brand-orange" }), h(Spinner, {})]);
  const [a, b] = m.el.querySelectorAll(".hm-loading");
  assert.equal(a.getAttribute("data-hm-color"), "brand-orange");
  assert.ok(a.classList.contains("hm-spin-single"));
  assert.equal(b.getAttribute("data-hm-color"), null);
  assert.ok(!b.classList.contains("hm-spin-single"));
  m.dispose();
});
