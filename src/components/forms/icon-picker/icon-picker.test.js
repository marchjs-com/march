import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";

const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { IconPicker } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const tick = () => new Promise((r) => setTimeout(r, 0));

test("IconPicker inline: a grid of the icons, search and filter narrow it, a choice sets the value", async () => {
  const icons = { plus: { name: "plus", d: ["M12 5v14"] }, arrowLeft: { name: "arrow-left", d: ["M19 12H5"] }, heart: { name: "heart", d: ["M1 1"], fill: true } };
  const value = signal("plus");
  const changes = [];
  const { el, dispose } = mount(() => h(IconPicker, { inline: true, icons, value, onChange: (n) => changes.push(n) }));
  const items = () => [...el.querySelectorAll(".m-ipk-item")].filter((b) => !b.classList.contains("m-ipk-off"));
  assert.equal(items().length, 3);
  assert.equal(el.querySelector('.m-ipk-item[aria-pressed="true"]').getAttribute("aria-label"), "plus");
  // a filter chip: arrows only
  [...el.querySelectorAll(".m-ipk-groups button")][0].click();
  await tick();
  assert.deepEqual(items().map((b) => b.getAttribute("aria-label")), ["arrow left"]);
  items()[0].click();
  assert.equal(value(), "arrowLeft");
  assert.deepEqual(changes, ["arrowLeft"]);
  // "No icon"
  el.querySelector(".m-ipk-off").click();
  assert.equal(value(), null);
  dispose();
});

test("IconPicker: groups={false} and none={false} leave the chips and the empty choice out", () => {
  const { el, dispose } = mount(() => h(IconPicker, { inline: true, groups: false, none: false, icons: { plus: { name: "plus", d: [] } } }));
  assert.equal(el.querySelector(".m-ipk-groups"), null);
  assert.equal(el.querySelector(".m-ipk-off"), null);
  dispose();
});

test("IconPicker packs: a set loads when chosen, its value is id:name; the grid draws a page at a time", async () => {
  let loads = 0;
  const many = Object.fromEntries(Array.from({ length: 30 }, (_, i) => [`dot-${i}`, { name: `dot-${i}`, d: ["M1 1"] }]));
  const packs = [{ id: "dots", label: "Dots", count: 30, load: async () => { loads++; return many; } }];
  const value = signal(null);
  const { el, dispose } = mount(() => h(IconPicker, { inline: true, groups: false, none: false, pageSize: 10, icons: { plus: { name: "plus", d: [] } }, packs, value }));
  const items = () => [...el.querySelectorAll(".m-ipk-item")];
  assert.equal(items().length, 1, "the base set first");
  assert.equal(loads, 0, "nothing loads before the set is chosen");
  const select = el.querySelector(".m-ipk-set select") ?? el.querySelector("select");
  select.value = "1";
  select.dispatchEvent(new Event("change", { bubbles: true }));
  await tick(); await tick();
  assert.equal(loads, 1);
  assert.equal(items().length, 10, "first page");
  const grid = el.querySelector(".m-ipk-grid");
  Object.defineProperty(grid, "scrollHeight", { value: 100, configurable: true });
  Object.defineProperty(grid, "clientHeight", { value: 100, configurable: true });
  Object.defineProperty(grid, "scrollTop", { value: 0, configurable: true });
  grid.dispatchEvent(new Event("scroll"));
  await tick();
  assert.equal(items().length, 20, "next page on scroll to the end");
  items()[3].click();
  assert.equal(value(), "dots:dot-3");
  assert.match(el.querySelector(".m-ipk-count").textContent, /30/);
  dispose();
});
