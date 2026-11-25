import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { MenuBar } = await import("./index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));

test("MenuBar: a menubar of menuitems, one tab stop, opens a menu with its entries and submenus", async () => {
  const picked = [];
  const rulers = signal(false);
  const el = document.createElement("div");
  document.body.appendChild(el);
  render(() => h(MenuBar, { menus: [
    { label: "File", items: [{ label: "New", shortcut: "mod+n", onSelect: () => picked.push("new") }, "-", { label: "Export", items: [{ label: "PNG", onSelect: () => picked.push("png") }] }] },
    { label: "View", items: [{ label: "Rulers", checked: () => rulers(), onSelect: () => rulers.set(!rulers()) }] },
    { label: "Hidden", hidden: true, items: [] },
  ] }), el);
  const bar = el.querySelector("[role=menubar]");
  assert.equal(bar.getAttribute("aria-label"), "Menu bar");
  const tops = [...bar.children].filter((x) => x.getAttribute("role") === "menuitem");
  assert.deepEqual(tops.map((b) => b.textContent), ["File", "View"]);
  assert.deepEqual(tops.map((b) => b.getAttribute("tabindex")), ["0", "-1"]);
  tops[0].click();
  await tick();
  assert.equal(tops[0].getAttribute("aria-expanded"), "true");
  const panel = document.getElementById(tops[0].getAttribute("aria-controls"));
  assert.ok(panel, "the panel is in the page");
  const items = panel.querySelectorAll("[role=menuitem]");
  assert.ok(items.some((x) => x.textContent.includes("New")));
  const sub = items.find((x) => x.getAttribute("aria-haspopup") === "menu");
  assert.ok(sub && sub.textContent.includes("Export"));
  items.find((x) => x.textContent.includes("New")).click();
  assert.deepEqual(picked, ["new"]);
  assert.equal(tops[0].getAttribute("aria-expanded"), "false", "picking closes the menu");
});

test("MenuBar: arrow keys move across the bar", () => {
  const el = document.createElement("div");
  document.body.appendChild(el);
  render(() => h(MenuBar, { menus: [{ label: "A", items: [{ label: "a" }] }, { label: "B", items: [{ label: "b" }] }] }), el);
  const tops = [...el.querySelector("[role=menubar]").children].filter((x) => x.getAttribute("role") === "menuitem");
  tops[0].focus();
  tops[0].dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
  assert.equal(document.activeElement, tops[1]);
});
