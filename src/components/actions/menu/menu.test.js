import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const { Menu, Dropdown } = await import("./index.ts");

test("Menu: trigger ARIA, opens on ArrowDown, items, separator, disabled, shortcut", async () => {
  let picked = null;
  const m = mount(() => h(Menu, { label: "Actions", items: [{ label: "Edit", shortcut: "E", onSelect: (x) => { picked = x; } }, "-", { label: "Off", disabled: true }, { label: "Gone", hidden: true }], args: ["row"] }));
  const trigger = m.el.querySelector("button");
  assert.equal(trigger.getAttribute("aria-haspopup"), "menu");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  trigger.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  await tick();
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  const panel = document.getElementById(trigger.getAttribute("aria-controls"));
  assert.equal(panel.getAttribute("role"), "menu");
  const items = panel.querySelectorAll("[role=menuitem]");
  assert.equal(items.length, 2, "hidden item skipped");
  assert.ok(panel.querySelector("[role=separator]"));
  assert.equal(items[1].disabled, true);
  assert.ok(items[0].querySelector("kbd.hm-menu-kbd"));
  items[0].click();
  assert.equal(picked, "row");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  m.dispose();
});

test("Dropdown: dialog panel with a close function", async () => {
  let close;
  const m = mount(() => h(Dropdown, { label: "Filters" }, (c) => { close = c; return "body"; }));
  const trigger = m.el.querySelector("button");
  assert.equal(trigger.getAttribute("aria-haspopup"), "dialog");
  trigger.click();
  await tick();
  assert.equal(trigger.getAttribute("aria-expanded"), "true");
  close();
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  m.dispose();
});

test("Menu / Dropdown: the trigger takes a colour token, a class and its own content", () => {
  const m = mount(() => [
    h(Menu, { label: "Actions", variant: "primary", color: "brand-purple", class: "mine", trigger: h("b", {}, "Me"), items: [] }),
    h(Dropdown, { label: "Filters" }, "body"),
  ]);
  const [a, b] = m.el.querySelectorAll("button");
  assert.equal(a.getAttribute("data-hm-color"), "brand-purple");
  assert.ok(a.className.includes("hm-btn-primary") && a.className.includes("mine"));
  assert.equal(a.querySelector("b").textContent, "Me");
  assert.equal(b.getAttribute("data-hm-color"), null);
  m.dispose();
});
