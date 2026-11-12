import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { Spinner } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); render(fn, el); return el; };

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
