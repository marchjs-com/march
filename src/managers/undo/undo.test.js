// UndoManager: push / run / undo / redo, merge window, transactions, saved point, command integration, channel events.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { undoStack, undoCommands, configureUndo, disposeUndo } = await import("./index.ts");
const { command, commands, disposeCommands } = await import("../command/index.ts");
const { channel } = await import("../../channel/index.ts");
const { createRoot } = await import("../../index.ts");

test("run, undo, redo and labels", async () => {
  disposeUndo();
  let v = 0;
  const u = undoStack();
  u.run("one", () => (v = 1), () => (v = 0));
  u.run("two", () => (v = 2), () => (v = 1));
  assert.deepEqual(u.past(), ["two", "one"]);
  assert.equal(await u.undo(), true);
  assert.equal(v, 1);
  assert.deepEqual(u.future(), ["two"]);
  await u.redo();
  assert.equal(v, 2);
  u.run("three", () => (v = 3), () => (v = 2));
  await u.undo(); await u.undo(); await u.undo(); 
  assert.equal(v, 0);
  assert.equal(await u.undo(), false, "nothing left");
  assert.equal(u.canUndo(), false);
  u.run("x", () => (v = 9), () => (v = 0));
  assert.equal(u.canRedo(), false, "a new step drops the redo side");
});

test("merge window, limit and transactions", async () => {
  configureUndo({ limit: 3, mergeMs: 1000 });
  const u = undoStack();
  let text = "";
  for (const ch of "abc") { const before = text; u.run("Typing", () => (text += ch), () => (text = before), "typing"); }
  assert.deepEqual(u.past(), ["Typing"], "merged into one step");
  await u.undo();
  assert.equal(text, "", "the merged step goes back to the start");
  for (let i = 0; i < 5; i++) u.push({ label: `s${i}`, undo: () => {} });
  assert.equal(u.past().length, 3, "limit");
  u.clear();
  const log = [];
  u.transaction("Paste", () => { u.push({ label: "a", undo: () => log.push("a") }); u.push({ label: "b", undo: () => log.push("b") }); });
  assert.deepEqual(u.past(), ["Paste"]);
  await u.undo();
  assert.deepEqual(log, ["b", "a"], "reverse order");
});

test("saved point follows the history", async () => {
  disposeUndo();
  const u = undoStack();
  assert.equal(u.atSaved(), true);
  u.push({ label: "a", undo: () => {}, redo: () => {} });
  assert.equal(u.atSaved(), false);
  u.markSaved();
  assert.equal(u.atSaved(), true);
  await u.undo();
  assert.equal(u.atSaved(), false);
  await u.redo();
  assert.equal(u.atSaved(), true);
});

test("commands returning { undo } are recorded; edit.undo / edit.redo commands; channel events", async () => {
  disposeCommands(); disposeUndo();
  const seen = [];
  const off = channel("managers.undo").on((m) => seen.push(m.type));
  let n = 0;
  createRoot(() => {
    command({ id: "count.add", title: "Add", run: () => { n++; return { label: "", undo: () => { n--; }, redo: () => { n++; } }; } });
    undoCommands();
  });
  await commands.run("count.add");
  await commands.run("count.add");
  assert.equal(n, 2);
  assert.deepEqual(undoStack().past(), ["Add", "Add"], "command title as label");
  assert.match(commands.get("edit.undo").title(), /: Add$/, "label in the title (localized)");
  await commands.run("edit.undo");
  assert.equal(n, 1);
  assert.equal(commands.get("edit.redo").enabled(), true);
  await commands.run("edit.redo");
  assert.equal(n, 2);
  assert.deepEqual(undoStack().past(), ["Add", "Add"], "undo/redo commands are not recorded themselves");
  assert.ok(seen.includes("push") && seen.includes("undo") && seen.includes("redo"));
  off();
});
