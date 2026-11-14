import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { UndoRedo } = await import("./index.ts");
const { undoHistory } = await import("../../../managers/undo/history.ts");
const { formatKey } = await import("../../../ui/keys.ts");

const mount = (view) => { const el = document.createElement("div"); document.body.appendChild(el); return [el, render(view, el)]; };

test("UndoRedo: follows an undo stack, names the step and the shortcut", async () => {
  const history = undoHistory();
  let n = 0;
  const [el, dispose] = mount(() => h(UndoRedo, { history }));
  const g = el.querySelector(".hm-undo-redo");
  assert.equal(g.getAttribute("role"), "group");
  assert.equal(g.getAttribute("aria-label"), "History");
  const [undo, redo] = g.querySelectorAll("button.hm-icon-btn");
  assert.equal(undo.disabled, true);
  assert.equal(redo.disabled, true);
  assert.equal(undo.getAttribute("aria-label"), "Undo");
  history.run("Add one", () => { n = 1; }, () => { n = 0; });
  assert.equal(undo.disabled, false);
  assert.equal(undo.getAttribute("aria-label"), "Undo: Add one");
  assert.equal(undo.getAttribute("title"), `Undo: Add one (${formatKey("mod+z")})`);
  undo.click();
  await Promise.resolve();
  assert.equal(n, 0);
  assert.equal(redo.disabled, false);
  assert.equal(redo.getAttribute("aria-label"), "Redo: Add one");
  assert.equal(redo.getAttribute("title"), `Redo: Add one (${formatKey("mod+shift+z")})`);
  dispose();
});

test("UndoRedo: four props, subset, own names / icons / steps, no shortcut, disabled", () => {
  const canUndo = signal(true), seen = [];
  const [el, dispose] = mount(() => [
    h(UndoRedo, { class: "one", canUndo, canRedo: false, onUndo: () => seen.push("undo"), onRedo: () => seen.push("redo"), shortcuts: false, steps: { undo: "Rename" }, labels: { undo: "Step back", group: "Edits" }, size: "sm" }),
    h(UndoRedo, { class: "two", canUndo: true, canRedo: true, actions: ["undo"], steps: false, shortcuts: { undo: "mod+u" }, icons: { undo: "↶" } }),
    h(UndoRedo, { class: "three", canUndo: true, canRedo: true, disabled: true }),
  ]);
  const [undo, redo] = el.querySelectorAll(".one button");
  assert.equal(el.querySelector(".one").getAttribute("aria-label"), "Edits");
  assert.equal(undo.getAttribute("aria-label"), "Step back: Rename");
  assert.equal(undo.getAttribute("title"), "Step back: Rename");
  assert.equal(redo.disabled, true);
  undo.click(); redo.click();
  assert.deepEqual(seen, ["undo"]);
  canUndo.set(false);
  assert.equal(undo.disabled, true);
  const two = el.querySelectorAll(".two button");
  assert.equal(two.length, 1);
  assert.equal(two[0].getAttribute("title"), `Undo (${formatKey("mod+u")})`);
  assert.equal(two[0].textContent, "↶");
  assert.deepEqual([...el.querySelectorAll(".three button")].map((b) => b.disabled), [true, true]);
  dispose();
});

test("UndoRedo: partClass adds the host's class to a button", () => {
  const host = document.createElement("div"); document.body.appendChild(host);
  const dispose = render(() => h(UndoRedo, { canUndo: true, canRedo: false, partClass: { undo: "my-undo" } }), host);
  assert.ok(host.querySelector(".hm-undo-redo-undo.my-undo"));
  assert.equal(host.querySelector(".hm-undo-redo-redo").className.includes("my-"), false);
  dispose();
});
