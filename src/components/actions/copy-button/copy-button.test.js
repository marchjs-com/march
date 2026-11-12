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
