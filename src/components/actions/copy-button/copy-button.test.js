import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const { CopyButton } = await import("./index.ts");

test("CopyButton: writes the text, confirms, then resets; icon-only is named", async () => {
  let written = null;
  Object.defineProperty(globalThis.navigator, "clipboard", { value: { writeText: async (s) => { written = s; } }, configurable: true });
  let copied = 0;
  const m = mount(() => [h(CopyButton, { text: () => 42, onCopy: () => copied++ }), h(CopyButton, { text: "x", iconOnly: true, label: "Copy key" })]);
  const [a, b] = m.el.querySelectorAll("button");
  assert.equal(a.textContent, "Copy");
  assert.equal(a.getAttribute("aria-live"), "polite");
  assert.equal(b.getAttribute("aria-label"), "Copy key");
  a.click();
  await tick();
  assert.equal(written, "42");
  assert.equal(copied, 1);
  assert.equal(a.textContent, "Copied");
  assert.ok(a.className.includes("is-copied"));
  m.dispose();
});

test("CopyButton: your own texts, icons, colour; the failure toast can be turned off", async () => {
  Object.defineProperty(globalThis.navigator, "clipboard", { value: { writeText: async () => {} }, configurable: true });
  const m = mount(() => [
    h(CopyButton, { text: "x", icon: "@", copiedIcon: "♥", copiedLabel: "Got it", copiedColor: "brand-blue" }),
    h(CopyButton, { text: "x", iconOnly: true, icon: "@", copiedIcon: false, copiedLabel: "Got it" }),
  ]);
  const [a, b] = m.el.querySelectorAll("button");
  assert.equal(a.textContent, "@Copy");
  assert.equal(a.getAttribute("data-m-color"), null);
  a.click(); b.click();
  await tick();
  assert.equal(a.textContent, "♥Got it");
  assert.equal(a.getAttribute("data-m-color"), "brand-blue");
  assert.equal(b.textContent, "@", "copiedIcon false: the icon does not change");
  assert.equal(b.getAttribute("aria-label"), "Got it");
  m.dispose();

  Object.defineProperty(globalThis.navigator, "clipboard", { value: { writeText: async () => { throw new Error("denied"); } }, configurable: true });
  let failed = null;
  const toasts = () => document.querySelectorAll(".m-toast").length;
  const before = toasts();
  const n = mount(() => h(CopyButton, { text: "x", errorText: false, onError: (e) => { failed = e; } }));
  n.el.querySelector("button").click();
  await tick();
  assert.equal(failed.message, "denied");
  assert.equal(toasts(), before, "no toast");
  assert.equal(n.el.querySelector("button").textContent, "Copy");
  n.dispose();
});
