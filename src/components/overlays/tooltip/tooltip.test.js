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

test("Tooltip: color, class and motion on the bubble; disabled never shows; own delay", async () => {
  const off = signal(true);
  const m = mount(() => [
    h(Tooltip, { text: "Saved", color: "success", class: "mine", motion: "none", delay: 0 }, h("button", { class: "a" }, "A")),
    h(Tooltip, { text: "Hidden", disabled: off }, h("button", { class: "b" }, "B")),
  ]);
  const a = m.el.querySelector(".a"), b = m.el.querySelector(".b");
  a.parentElement.dispatchEvent(new globalThis.MouseEvent("mouseenter"));
  await tick(); await tick();
  const tip = document.getElementById(a.getAttribute("aria-describedby"));
  assert.ok(tip, "delay 0: shown on the next tick");
  assert.equal(tip.getAttribute("data-m-color"), "success");
  for (const c of ["m-tooltip", "m-tooltip-colored", "m-tooltip-still", "mine"]) assert.ok(tip.classList.contains(c), c);
  b.dispatchEvent(new globalThis.FocusEvent("focusin", { bubbles: true }));
  await tick();
  assert.equal(b.getAttribute("aria-describedby"), null, "disabled");
  off.set(false);
  b.dispatchEvent(new globalThis.FocusEvent("focusin", { bubbles: true }));
  await tick();
  assert.ok(b.getAttribute("aria-describedby"));
  m.dispose();
});
