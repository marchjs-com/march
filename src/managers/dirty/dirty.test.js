// DirtyStateManager: tracked sources, manual marks, beforeunload warning, router leave guard, saveAll, undo integration.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../testing/dom.ts";

installDom();
const { dirtyState, configureDirty, disposeDirty } = await import("./index.ts");
const { undoStack, disposeUndo } = await import("../undo/index.ts");
const { signal, createRoot } = await import("../../index.ts");
const { channel } = await import("../../channel/index.ts");

test("track / mark / clean and the any() + list() signals", () => {
  configureDirty({ confirm: () => true });
  const d = dirtyState();
  const form = signal(false);
  let off;
  createRoot((dispose) => { d.track("form", form, "Profile"); off = dispose; });
  assert.equal(d.any(), false);
  form.set(true);
  assert.equal(d.any(), true);
  assert.deepEqual(d.list().map((e) => e.label), ["Profile"]);
  d.mark("note", "Note");
  assert.equal(d.is("note"), true);
  d.clean("note");
  off();
  assert.equal(d.any(), false, "removed with its owner");
});

test("beforeunload warns only while dirty; confirmLeave asks with the list", async () => {
  const asked = [];
  configureDirty({ confirm: (items) => { asked.push(items.map((i) => i.id)); return false; } });
  const d = dirtyState();
  const ev = () => { const e = new Event("beforeunload", { cancelable: true }); globalThis.dispatchEvent(e); return e.defaultPrevented; };
  assert.equal(ev(), false);
  assert.equal(await d.confirmLeave(), true, "nothing dirty: no question");
  d.mark("draft");
  assert.equal(ev(), true);
  assert.equal(await d.confirmLeave(), false);
  assert.deepEqual(asked, [["draft"]]);
  d.clean("draft");
});

test("saveAll runs save() of dirty entries; undo saved point drives the state; change events", async () => {
  disposeUndo(); configureDirty({ confirm: () => true });
  await new Promise((r) => setTimeout(r, 0));
  const seen = [];
  const off = channel("managers.dirty").on((m) => { if (m.type === "change") seen.push(m.detail.dirty); });
  const d = dirtyState();
  const u = undoStack();
  createRoot(() => d.track("doc", () => !u.atSaved(), "Document", () => u.markSaved()));
  u.push({ label: "edit", undo: () => {} });
  assert.equal(d.is("doc"), true);
  assert.equal(await d.saveAll(), 1);
  assert.equal(d.any(), false);
  await new Promise((r) => setTimeout(r, 0));
  assert.deepEqual(seen, [true, false]);
  off(); disposeDirty();
});
