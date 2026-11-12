// HotkeyManager: chords, sequences, scopes (exclusive too), inputs, modal layers, pause, list, owner cleanup.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { h, createRoot } = await import("../../index.ts");
const { openLayer } = await import("../../dom/portal.ts");
const { hotkeys, disposeHotkeys, configureHotkeys } = await import("./index.ts");
const press = (k, extra = {}, target = document.body) => { const e = new Event("keydown", { bubbles: true, cancelable: true }); Object.assign(e, { key: k, ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...extra }); target.dispatchEvent(e); return e; };
const tick = (ms = 5) => new Promise((r) => setTimeout(r, ms));

test("chord: ctrl+k runs and prevents default; the newest binding of the same keys wins", () => {
  disposeHotkeys();
  const runs = [];
  hotkeys.bind("ctrl+k", () => runs.push("old"));
  const off = hotkeys.bind("ctrl+k", () => runs.push("new"));
  const e = press("k", { ctrlKey: true });
  assert.equal(e.defaultPrevented, true);
  off();
  press("k", { ctrlKey: true });
  press("k");
  assert.deepEqual(runs, ["new", "old"]);
});

test("sequence: g then h; a wrong key resets; pending() shows the prefix", async () => {
  disposeHotkeys();
  configureHotkeys({ sequenceTimeout: 30 });
  const runs = [];
  hotkeys.bind("g h", () => runs.push("home"));
  hotkeys.bind("g s", () => runs.push("settings"));
  press("g");
  assert.equal(hotkeys.pending(), "G");
  press("h");
  assert.equal(hotkeys.pending(), "");
  press("g"); press("x"); press("s");
  assert.deepEqual(runs, ["home"], "g x s is not g s");
  press("g");
  await tick(50);
  assert.equal(hotkeys.pending(), "", "timeout clears the prefix");
  press("s");
  assert.deepEqual(runs, ["home"]);
  configureHotkeys({ sequenceTimeout: 1000 });
});

test("scopes: scoped bindings only inside; an exclusive scope pauses global ones", () => {
  disposeHotkeys();
  const runs = [];
  hotkeys.bind("b", () => runs.push("global"));
  hotkeys.bind("ctrl+b", () => runs.push("bold"), { scope: "editor" });
  press("b", { ctrlKey: true });
  const leave = hotkeys.enter("editor");
  press("b", { ctrlKey: true });
  press("b");
  assert.deepEqual(hotkeys.scopes(), ["editor"]);
  leave();
  const leave2 = hotkeys.enter("editor", { exclusive: true });
  press("b");
  press("b", { ctrlKey: true });
  leave2();
  assert.deepEqual(runs, ["bold", "global", "bold"]);
});

test("typing in a field skips bindings unless inInputs; a modal layer skips them unless modal", () => {
  disposeHotkeys();
  const runs = [];
  hotkeys.bind("j", () => runs.push("j"));
  hotkeys.bind("escape", () => runs.push("esc"), { inInputs: true, modal: true });
  const input = h("input", {});
  document.body.appendChild(input);
  press("j", {}, input);
  press("Escape", {}, input);
  const close = openLayer("dialog", h("div"));
  press("j");
  press("Escape");
  close();
  press("j");
  input.remove();
  assert.deepEqual(runs, ["esc", "esc", "j"]);
});

test("list(): described bindings with labels and active state; pause / resume; owner cleanup", () => {
  disposeHotkeys();
  let dispose;
  createRoot((d) => { dispose = d; hotkeys.bind("ctrl+s", () => {}, { description: "Save", group: "File" }); hotkeys.bind("x", () => {}); });
  hotkeys.bind("ctrl+b", () => {}, { description: "Bold", scope: "editor" });
  const l = hotkeys.list();
  assert.deepEqual(l.map((x) => [x.combo, x.label, x.description, x.group, x.active]), [["ctrl+s", "Ctrl+S", "Save", "File", true], ["ctrl+b", "Ctrl+B", "Bold", null, false]]);
  let n = 0;
  hotkeys.bind("y", () => n++);
  hotkeys.pause();
  press("y");
  assert.equal(hotkeys.list()[0].active, false);
  hotkeys.resume();
  press("y");
  assert.equal(n, 1);
  assert.equal(hotkeys.trigger("y"), true);
  assert.equal(n, 2);
  dispose();
  assert.equal(hotkeys.list().length, 1, "bindings made inside an owner go with it");
});
