import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { PropertyGrid } = await import("./index.ts");
const { undoStack } = await import("../../../managers/undo/index.ts");
const { dirtyState } = await import("../../../managers/dirty/index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const type = (input, v) => { input.value = v; input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true })); };

const PROPS = [
  { key: "name", label: "Name", group: "General" },
  { key: "width", label: "Width", type: "number", group: "Layout", unit: "px", validate: (v) => (v > 1000 ? "Too wide" : null) },
  { key: "visible", label: "Visible", type: "switch", group: "Layout" },
  { key: "radius", label: "Corner radius", type: "slider", min: 0, max: 24, group: "Style", hidden: (v) => !v.visible },
];

test("PropertyGrid: groups, search, hidden rows, changes with undo and DirtyState, reset, revert, save", async () => {
  const value = signal({ name: "Acme", width: 320, visible: true, radius: 8 });
  const saves = [];
  let api;
  const u = undoStack();
  u.clear();
  const m = mount(() => h(PropertyGrid, { properties: PROPS, value, label: "Card", id: "pg1", onSave: (v) => { saves.push(v); }, api: (a) => { api = a; } }));
  await tick();
  const root = m.el.querySelector(".hm-pg");
  assert.equal(root.getAttribute("aria-label"), "Card");
  assert.equal(root.querySelectorAll("details.hm-pg-group").length, 3);
  assert.equal(root.querySelectorAll(".hm-pg-row").length, 4);
  // every editor is labelled by its row label
  const width = root.querySelector('#pg1-width');
  assert.equal(root.querySelector("#pg1-width-l").getAttribute("for"), "pg1-width");
  // change: value, changed mark, undo step, dirty entry
  type(width, "480");
  await tick();
  assert.equal(value().width, 480);
  assert.ok(root.querySelector('[data-key="width"]').className.includes("is-changed"));
  assert.deepEqual(api.changes(), ["width"]);
  assert.equal(u.past()[0], "Width değişikliği");
  assert.ok(dirtyState().is("pg1"));
  assert.ok(root.querySelector(".hm-pg-foot"));
  await u.undo();
  assert.equal(value().width, 320);
  assert.deepEqual(api.changes(), []);
  assert.ok(!dirtyState().is("pg1"));
  await u.redo();
  assert.equal(value().width, 480);
  // validation
  type(width, "2000");
  await tick();
  assert.ok(root.querySelector('[data-key="width"]').className.includes("is-invalid"));
  assert.equal(root.querySelector('[data-key="width"] .hm-pg-error').textContent, "Too wide");
  // per-row reset back to the saved value
  root.querySelector('[data-key="width"] .hm-pg-reset').click();
  assert.equal(value().width, 320);
  // hidden: the radius row goes when visible is off
  value.set({ ...value(), visible: false });
  await tick();
  assert.ok(!root.querySelector('[data-key="radius"]'));
  // search
  const search = root.querySelector('input[type="search"]');
  type(search, "wid");
  await tick();
  assert.deepEqual([...root.querySelectorAll(".hm-pg-row")].map((r) => r.dataset.key), ["width"]);
  type(search, "zzz");
  await tick();
  assert.ok(root.querySelector(".hm-pg-empty"));
  type(search, "");
  await tick();
  // revert all, then save
  api.revert();
  assert.equal(value().visible, true);
  value.set({ ...value(), name: "Acme 2" });
  await api.save();
  assert.equal(saves.length, 1);
  assert.equal(saves[0].name, "Acme 2");
  assert.deepEqual(api.changes(), []);
  assert.ok(!dirtyState().is("pg1"));
  m.dispose();
});

test("PropertyGrid: history and dirty can be switched off; any control works", async () => {
  let seen = null;
  const Custom = (p) => { seen = p; return h("output", { id: p.id }, () => String(p.value)); };
  const value = signal({ tone: "warm" });
  const m = mount(() => h(PropertyGrid, { properties: [{ key: "tone", label: "Tone", control: Custom }], value, history: false, dirty: false, search: false, id: "pg2" }));
  await tick();
  assert.ok(!m.el.querySelector(".hm-pg-history"));
  assert.ok(!m.el.querySelector('input[type="search"]'));
  assert.equal(m.el.querySelector("#pg2-tone").textContent, "warm");
  seen.setValue("cool");
  assert.equal(value().tone, "cool");
  assert.ok(!dirtyState().is("pg2"));
  m.dispose();
});
