// ShortcutHintManager: hold key shows / hides, a chord cancels, "?" asks for help, entries merge both registries,
// targets, the UI draws badges in an fx layer and opens the help dialog.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { h, render } = await import("../../index.ts");
const { key } = await import("../../ui/keys.ts");
const { layers } = await import("../../dom/portal.ts");
const { hotkeys, disposeHotkeys } = await import("../hotkey/index.ts");
const { shortcutHints, configureShortcutHints, disposeShortcutHints, comboOf } = await import("./index.ts");
const { ShortcutHints } = await import("./ui.ts");
const ev = (type, k, extra = {}) => { const e = new Event(type, { bubbles: true, cancelable: true }); Object.assign(e, { key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, repeat: false, ...extra }); document.body.dispatchEvent(e); return e; };
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test("holding the key shows hints after holdMs; release or a chord hides them", async () => {
  configureShortcutHints({ holdMs: 10 });
  shortcutHints.hide(); // start the instance (listeners)
  ev("keydown", "Alt");
  assert.equal(shortcutHints.visible(), false);
  await tick(25);
  assert.equal(shortcutHints.visible(), true);
  ev("keyup", "Alt");
  assert.equal(shortcutHints.visible(), false);
  ev("keydown", "Alt");
  ev("keydown", "s", { altKey: true });
  await tick(25);
  assert.equal(shortcutHints.visible(), false, "Alt+S is a chord, not a look");
  configureShortcutHints({ holdMs: 450 });
});

test("? opens help; entries merge hotkeys and ui/keys shortcuts without duplicates", () => {
  disposeHotkeys();
  disposeShortcutHints();
  hotkeys.bind("g h", () => {}, { description: "Go home", group: "Navigation" });
  const off = key("ctrl+j", () => {}, { description: "Jump" });
  const list = shortcutHints.entries();
  assert.equal(list.length, 3, "Go home, the help key itself, Jump");
  assert.deepEqual([list[0].description, list[2].description], ["Go home", "Jump"]);
  ev("keydown", "?", { shiftKey: true });
  assert.equal(shortcutHints.helpOpen(), true);
  shortcutHints.closeHelp();
  off();
});

test("targets: aria-keyshortcuts and data-hotkey, hidden and disabled skipped", () => {
  const box = h("div", {},
    h("button", { "aria-keyshortcuts": "Control+Shift+S" }, "a"),
    h("button", { "data-hotkey": "g h" }, "b"),
    h("button", { "data-hotkey": "x", disabled: true }, "c"),
    h("div", { hidden: true }, h("button", { "data-hotkey": "y" }, "d")));
  document.body.appendChild(box);
  const t = shortcutHints.targets(box);
  assert.deepEqual(t.map(comboOf), ["control+shift+s", "g h"]);
  box.remove();
});

test("<ShortcutHints /> draws badges in an fx layer while visible and opens the help dialog", async () => {
  disposeShortcutHints();
  const host = document.createElement("div");
  document.body.appendChild(host);
  host.appendChild(h("button", { "data-hotkey": "ctrl+k" }, "k"));
  const dispose = render(() => h(ShortcutHints, {}), host);
  const n = layers().length;
  shortcutHints.show();
  assert.equal(layers().length, n + 1);
  assert.equal(layers().at(-1).kind, "fx");
  shortcutHints.hide();
  assert.equal(layers().length, n);
  shortcutHints.openHelp();
  await tick();
  assert.ok(document.querySelector(".hm-shortcut-help"), "help list rendered in a dialog");
  dispose();
  host.remove();
});
