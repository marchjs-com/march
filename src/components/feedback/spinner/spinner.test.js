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
  const [a, b, c] = el.querySelectorAll(".m-loading");
  assert.equal(a.getAttribute("role"), "status");
  assert.equal(a.getAttribute("aria-label"), "Loading users");
  assert.ok(a.classList.contains("m-spin-lg"));
  assert.equal(b.getAttribute("data-m-colors"), "custom");
  assert.match(b.style.getPropertyValue("--m-spinner-paint"), /conic-gradient/);
  assert.ok(c.classList.contains("m-spin-single"));
});

test("Spinner: one colour token paints a single-colour ring", () => {
  const m = mountD(() => [h(Spinner, { color: "brand-orange" }), h(Spinner, {})]);
  const [a, b] = m.el.querySelectorAll(".m-loading");
  assert.equal(a.getAttribute("data-m-color"), "brand-orange");
  assert.ok(a.classList.contains("m-spin-single"));
  assert.equal(b.getAttribute("data-m-color"), null);
  assert.ok(!b.classList.contains("m-spin-single"));
  m.dispose();
});

test("Spinner: decorative is hidden from assistive technology; size=\"em\" follows the text", () => {
  const el = mount(() => [h(Spinner, { decorative: true, size: "em", label: "ignored" }), h(Spinner, {})]);
  const [a, b] = el.querySelectorAll(".m-loading");
  assert.equal(a.getAttribute("aria-hidden"), "true");
  assert.equal(a.getAttribute("role"), null);
  assert.equal(a.getAttribute("aria-label"), null);
  assert.ok(a.classList.contains("m-spin-em"));
  assert.equal(b.getAttribute("role"), "status");
  assert.equal(b.getAttribute("aria-hidden"), null);
});
