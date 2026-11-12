import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const { Tooltip } = await import("./index.ts");

test("Tooltip: shows on focus with aria-describedby, hides on Escape", async () => {
  const m = mount(() => h(Tooltip, { text: "Hint" }, h("button", {}, "B")));
  const btn = m.el.querySelector("button");
  btn.dispatchEvent(new globalThis.FocusEvent("focusin", { bubbles: true }));
  await tick();
  const id = btn.getAttribute("aria-describedby");
  assert.ok(id);
  const tip = document.getElementById(id);
  assert.equal(tip.getAttribute("role"), "tooltip");
  assert.equal(tip.textContent, "Hint");
  btn.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  await tick();
  assert.equal(btn.getAttribute("aria-describedby"), null);
  m.dispose();
});
