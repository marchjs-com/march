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
  const value = signal({ name: "HADİ", width: 320, visible: true, radius: 8 });
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
  value.set({ ...value(), name: "HADİ 2" });
  await api.save();
  assert.equal(saves.length, 1);
  assert.equal(saves[0].name, "HADİ 2");
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

test("PropertyGrid: a slider being dragged stays the same node in the same group box (focus and pointer kept)", async () => {
  const value = signal({ name: "HADİ", width: 320, visible: true, radius: 8 });
  const m = mount(() => h(PropertyGrid, { properties: PROPS, value, id: "pg-drag", history: false, dirty: false }));
  await tick();
  const slider = m.el.querySelector("#pg-drag-radius");
  const box = slider.closest("details");
  slider.focus();
  for (const v of [9, 12, 16, 20, 24]) {
    type(slider, String(v));
    await tick();
    assert.equal(m.el.querySelector("#pg-drag-radius"), slider, `same input at ${v}`);
    assert.equal(slider.closest("details"), box, `same group box at ${v}`);
    assert.equal(value().radius, v);
  }
  assert.equal(document.activeElement, slider);
  m.dispose();
});

test("PropertyGrid: history buttons, reset buttons, change marks and the footer can be turned off; texts are yours", async () => {
  const value = signal({ name: "HADİ", width: 320, visible: true, radius: 8 });
  const bare = mount(() => h(PropertyGrid, { properties: PROPS, value, id: "pg-bare", dirty: false, onSave: () => {}, class: "mine",
    historyButtons: false, resetButtons: false, changeMarks: false, footer: false }));
  await tick();
  type(bare.el.querySelector("#pg-bare-width"), "500"); await tick();
  assert.ok(bare.el.querySelector(".hm-pg.mine"));
  assert.ok(bare.el.querySelector('[data-key="width"]').className.includes("is-changed"));
  for (const part of [".hm-pg-history", ".hm-pg-reset", ".hm-pg-dot", ".hm-pg-count", ".hm-pg-foot"]) assert.equal(bare.el.querySelector(part), null, part);
  bare.dispose();

  const v2 = signal({ name: "HADİ", width: 320, visible: true, radius: 8 });
  const own = mount(() => h(PropertyGrid, { properties: PROPS, value: v2, id: "pg-own", dirty: false, onSave: () => {},
    labels: { search: "Find a setting", save: "Publish", revert: "Discard", unsaved: (n) => `${n} edits`, reset: (l) => `Restore ${l}`, noMatch: (q) => `Nothing for ${q}`, undo: "Step back" } }));
  await tick();
  assert.equal(own.el.querySelector(".hm-pg-search-input, .hm-pg-search input").getAttribute("placeholder"), "Find a setting");
  assert.equal(own.el.querySelector(".hm-pg-save").textContent, "Publish");
  assert.ok(own.el.querySelector(".hm-pg-history button").getAttribute("aria-label").startsWith("Step back"));
  type(own.el.querySelector("#pg-own-width"), "500"); await tick();
  assert.equal(own.el.querySelector(".hm-pg-changes").textContent, "1 edits");
  assert.equal(own.el.querySelector(".hm-pg-revert").textContent, "Discard");
  assert.equal(own.el.querySelector('[data-key="width"] .hm-pg-reset').getAttribute("aria-label"), "Restore Width");
  type(own.el.querySelector(".hm-pg-search input"), "qqqq"); await tick();
  assert.equal(own.el.querySelector(".hm-pg-empty").textContent, "Nothing for qqqq");
  own.dispose();
});
