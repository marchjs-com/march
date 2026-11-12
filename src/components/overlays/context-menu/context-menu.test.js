import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { ContextMenu } = await import("./index.ts");

test("ContextMenu: right-click opens items for the target, Escape closes, Shift+F10 opens from the keyboard", async () => {
  const picked = [];
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(ContextMenu, { label: "Actions", items: (target) => [{ label: `Open ${target.dataset.name}`, onSelect: () => picked.push(target.dataset.name) }, "-", { label: "Delete", danger: true, onSelect: () => picked.push("del") }] },
    h("button", { type: "button", "data-name": "a" }, "A")), host);
  const btn = host.querySelector("button");
  btn.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }));
  await Promise.resolve();
  const menu = document.querySelector('[role="menu"]');
  assert.ok(menu, "menu opened");
  assert.equal(menu.getAttribute("aria-label"), "Actions");
  const items = menu.querySelectorAll('[role="menuitem"]');
  assert.equal(items[0].textContent, "Open a");
  items[0].click();
  assert.deepEqual(picked, ["a"]);
  assert.equal(document.querySelector('[role="menu"]'), null, "closed after a choice");
  btn.dispatchEvent(new KeyboardEvent("keydown", { key: "F10", shiftKey: true, bubbles: true }));
  assert.ok(document.querySelector('[role="menu"]'));
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
  assert.equal(document.querySelector('[role="menu"]'), null);
  dispose();
});
