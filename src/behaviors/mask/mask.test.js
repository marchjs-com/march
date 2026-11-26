import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom, Event } from "../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../index.ts");
const { mask } = await import("./index.ts");

test("use:mask on a plain input: a pattern, options with onChange, a signal that changes the mask", () => {
  const raw = signal(""), spec = signal("99-99");
  const host = document.createElement("div");
  document.body.appendChild(host);
  render(() => [
    h("input", { id: "a", "use:mask": [mask, { mask: "(999) 999", onChange: (v) => raw.set(v) }] }),
    h("input", { id: "b", "use:mask": [mask, spec] }),
  ], host);
  const a = host.querySelector("#a"), b = host.querySelector("#b");
  a.value = "5551234"; a.dispatchEvent(new Event("input", { bubbles: true }));
  assert.equal(a.value, "(555) 123");
  assert.equal(raw(), "555123");
  b.value = "1234"; b.dispatchEvent(new Event("input", { bubbles: true }));
  assert.equal(b.value, "12-34");
  spec.set("9.9.9.9");
  assert.equal(b.value, "1.2.3.4");
});
