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

test("Menu: a checked item is a menuitemcheckbox / menuitemradio with aria-checked and a mark; roving focus includes it", async () => {
  const sort = signal("name");
  let hidden = false;
  const m = mount(() => h(Menu, { label: "View", items: [
    { label: "Plain" },
    { label: "Name", radio: true, checked: () => sort() === "name", onSelect: () => sort.set("name") },
    { label: "Date", radio: true, checked: () => sort() === "date", onSelect: () => sort.set("date") },
    { label: "Hidden files", checked: () => hidden, onSelect: () => { hidden = !hidden; } },
  ] }));
  const trigger = m.el.querySelector("button");
  trigger.click();
  await tick();
  let panel = document.getElementById(trigger.getAttribute("aria-controls"));
  const radios = panel.querySelectorAll("[role=menuitemradio]");
  assert.equal(radios.length, 2);
  assert.equal(radios[0].getAttribute("aria-checked"), "true");
  assert.equal(radios[1].getAttribute("aria-checked"), "false");
  assert.equal(radios[0].querySelector(".hm-menu-check").getAttribute("aria-hidden"), "true");
  const box = panel.querySelector("[role=menuitemcheckbox]");
  assert.equal(box.getAttribute("aria-checked"), "false");
  const plain = panel.querySelector("[role=menuitem]");
  assert.equal(plain.getAttribute("aria-checked"), null);
  assert.equal(plain.querySelector(".hm-menu-check"), null);
  // arrow keys walk over every kind of item
  plain.focus();
  panel.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
  assert.equal(document.activeElement, radios[0]);
  radios[1].click();
  assert.equal(sort(), "date");
  assert.equal(trigger.getAttribute("aria-expanded"), "false");
  trigger.click();
  await tick();
  panel = document.getElementById(trigger.getAttribute("aria-controls"));
  assert.equal(panel.querySelectorAll("[role=menuitemradio]")[1].getAttribute("aria-checked"), "true");
  m.dispose();
});
