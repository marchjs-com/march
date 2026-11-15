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
