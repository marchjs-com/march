import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { VerifiedMark } = await import("./index.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("VerifiedMark: an image named Verified, with the built-in badge", () => {
  const [el, dispose] = mount(() => h(VerifiedMark, { "data-k": "1" }));
  const m = el.querySelector(".m-verified-mark");
  assert.equal(m.getAttribute("role"), "img");
  assert.equal(m.getAttribute("aria-label"), "Verified");
  assert.ok(m.classList.contains("m-verified-mark-sm"));
  assert.ok(m.querySelector("svg"));
  assert.equal(m.getAttribute("data-k"), "1");
  dispose();
});

test("VerifiedMark: own label, icon, colour, size; decorative with label={false}", () => {
  const label = signal("Verified organiser");
  const [el, dispose] = mount(() => [h(VerifiedMark, { label, icon: "✔", color: "brand-green", size: "lg", class: "mine" }), h(VerifiedMark, { label: false })]);
  const [a, b] = el.querySelectorAll(".m-verified-mark");
  assert.equal(a.getAttribute("aria-label"), "Verified organiser");
  assert.equal(a.textContent, "✔");
  assert.equal(a.getAttribute("data-m-color"), "brand-green");
  assert.ok(a.classList.contains("m-verified-mark-lg") && a.classList.contains("mine"));
  label.set("Official");
  assert.equal(a.getAttribute("aria-label"), "Official");
  assert.equal(b.getAttribute("aria-hidden"), "true");
  assert.equal(b.getAttribute("role"), null);
  dispose();
});
