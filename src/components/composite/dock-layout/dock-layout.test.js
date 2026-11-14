import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { DockLayout } = await import("./index.ts");
const M = await import("./model.ts");
const { commands } = await import("../../../managers/command/index.ts");
const { announcer } = await import("../../../managers/announcer/index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };

test("model: split, tab insert, collapse, float, minimize / restore, sanitize", () => {
  let s = M.fromSpec({ row: [["files"], ["a", "b"]], share: 0.3 });
  assert.equal(s.root.type, "split");
  const right = s.root.b.id;
  s = M.insertPanel(s, "files", right, "center", 1); // files joins the right group between a and b; the left group goes
  assert.equal(s.root.type, "group");
  assert.deepEqual(s.root.panels, ["a", "files", "b"]);
  assert.equal(s.root.active, "files");
  s = M.insertPanel(s, "b", s.root.id, "bottom");
  assert.equal(s.root.type, "split");
  assert.equal(s.root.dir, "column");
  assert.deepEqual(s.root.b.panels, ["b"]);
  s = M.insertPanel(s, "a", "@root", "start");
  assert.equal(s.root.dir, "row");
  assert.deepEqual(s.root.a.panels, ["a"]);
  // a lone panel dropped on a side of its own group: no change
  assert.equal(M.insertPanel(s, "a", s.root.a.id, "end"), s);
  s = M.floatPanel(s, "b", { x: 10, y: 20, w: 300, h: 200 });
  assert.equal(s.floating.length, 1);
  assert.ok(M.isFloating(s, M.groupOf(s, "b").id));
  const from = M.groupOf(s, "files").id;
  s = M.minimizePanel(s, "files");
  assert.deepEqual(s.minimized, [{ panel: "files", from }]);
  assert.ok(!M.groupOf(s, "files"));
  s = M.restorePanel(s, "files");
  assert.ok(M.groupOf(s, "files"));
  assert.deepEqual(s.minimized, []);
  // saved layouts: unknown and duplicate panels go, the rest stays valid
  const saved = JSON.parse(JSON.stringify(s));
  M.groups(saved)[0].panels.push("gone", "a");
  const clean = M.sanitize(saved, (id) => id !== "gone");
  assert.deepEqual(M.placed(clean).sort(), ["a", "b", "files"]);
  assert.equal(M.sanitize({ version: 9 }, () => true), null);
});

test("DockLayout: groups from Tabs + Splitter, content kept across moves, keyboard docking, close", async () => {
  let api;
  const made = [];
  const panels = ["files", "editor", "console"].map((id) => ({ id, title: id.toUpperCase(), content: () => { const n = h("div", { class: `c-${id}` }, id); made.push(id); return n; } }));
  const m = mount(() => h(DockLayout, { panels, layout: { row: [["files"], ["editor", "console"]], share: 0.25 }, commands: "t1", api: (a) => { api = a; } }));
  await tick();
  const root = m.el.querySelector(".hm-dock");
  assert.equal(root.querySelectorAll("[data-dock-group]").length, 2);
  assert.ok(root.querySelector(".hm-splitter [role=separator]"));
  const tabs = [...root.querySelectorAll("[role=tab]")].map((x) => x.dataset.tab);
  assert.deepEqual(tabs, ["files", "editor", "console"]);
  const editorNode = root.querySelector(".c-editor");
  assert.ok(editorNode, "active panels render their content");
  assert.ok(!root.querySelector(".c-console"), "inactive panels wait until shown");
  // Alt+Shift+→ on a tab docks it to that side: a new split
  const ed = root.querySelector('[role=tab][data-tab="editor"]');
  ed.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", altKey: true, shiftKey: true, bubbles: true }));
  await tick(); await tick();
  assert.equal(root.querySelectorAll("[data-dock-group]").length, 3);
  assert.equal(root.querySelector(".c-editor"), editorNode, "the editor's content moved, not rebuilt");
  assert.equal(made.filter((x) => x === "editor").length, 1);
  // commands for the palette
  assert.ok(commands.get("t1.reset") && commands.get("t1.show.console"));
  // Delete closes; the layout collapses
  const fl = root.querySelector('[role=tab][data-tab="files"]');
  fl.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
  await tick(); await tick();
  assert.ok(!root.querySelector('[role=tab][data-tab="files"]'));
  assert.equal(root.querySelectorAll("[data-dock-group]").length, 2);
  // what happened is announced through the announcer (no live region of its own)
  assert.match(announcer.history()[0].text, /^FILES /);
  assert.equal(root.querySelector("[aria-live]"), null);
  // open() puts it back, reset() returns to the layout prop
  api.open("files");
  await tick(); await tick();
  assert.ok(root.querySelector('[role=tab][data-tab="files"]'));
  api.reset();
  await tick(); await tick();
  assert.equal(root.querySelectorAll("[data-dock-group]").length, 2);
  m.dispose();
  assert.ok(!commands.get("t1.reset"), "commands leave with the layout");
});

test("DockLayout: minimize to the tray, float, maximize, persist to a storage", async () => {
  const store = new Map();
  const storage = { get: (k) => store.get(k), set: (k, v) => { store.set(k, JSON.parse(JSON.stringify(v))); } };
  let api;
  const panels = [{ id: "a", title: "A", content: () => "a" }, { id: "b", title: "B", content: () => "b", closable: false }];
  const m = mount(() => h(DockLayout, { panels, layout: { row: [["a"], ["b"]] }, persist: "lay", storage, commands: false, api: (x) => { api = x; } }));
  await tick();
  const root = m.el.querySelector(".hm-dock");
  api.minimize("a");
  await tick(); await tick();
  const tray = root.querySelector(".hm-dock-tray");
  assert.equal(tray.getAttribute("role"), "toolbar");
  assert.equal(tray.querySelectorAll("button").length, 1);
  tray.querySelector("button").click();
  await tick(); await tick();
  assert.ok(!root.querySelector(".hm-dock-tray"));
  api.float("a");
  await tick(); await tick();
  const win = root.querySelector(".hm-dock-float");
  assert.ok(win && win.querySelector(".hm-dock-grip") && win.querySelector(".hm-dock-resize"));
  api.toggleMaximize("b");
  await tick();
  assert.ok(root.querySelector('[data-dock-group].is-maximized [data-tab="b"]'));
  assert.equal(root.querySelector(".is-maximized .hm-dock-btn").getAttribute("aria-pressed"), "true");
  // b is not closable: no × and Delete does nothing
  const b = root.querySelector('[role=tab][data-tab="b"]');
  assert.ok(!b.querySelector(".hm-tab-close"));
  b.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true }));
  await tick();
  assert.ok(root.querySelector('[role=tab][data-tab="b"]'));
  await new Promise((r) => setTimeout(r, 300));
  const saved = store.get("lay");
  assert.equal(saved.version, 1);
  assert.equal(saved.floating.length, 1);
  m.dispose();
  // a new layout with the same key loads it
  const m2 = mount(() => h(DockLayout, { panels, persist: "lay", storage, commands: false }));
  await tick();
  assert.ok(m2.el.querySelector(".hm-dock-float"));
  m2.dispose();
});

test("DockLayout: panels removed from the list leave the layout", async () => {
  const list = signal([{ id: "a", title: "A", content: () => "a" }, { id: "b", title: "B", content: () => "b" }]);
  const m = mount(() => h(DockLayout, { panels: list, commands: false }));
  await tick();
  assert.equal(m.el.querySelectorAll("[role=tab]").length, 2);
  list.set([list.peek()[0]]);
  await tick(); await tick();
  assert.equal(m.el.querySelectorAll("[role=tab]").length, 1);
  m.dispose();
});

test("DockLayout: group buttons off or chosen, own icons and texts, no tray, own empty state", async () => {
  const mk = () => ["a", "b"].map((id) => ({ id, title: id.toUpperCase(), content: () => h("p", {}, id) }));
  const host = document.createElement("div"); document.body.appendChild(host);
  const apis = [];
  const dispose = render(() => [
    h(DockLayout, { panels: mk(), commands: false, class: "one", actions: ["maximize"], icons: { close: "×", maximize: () => h("i", { class: "own-max" }) },
      labels: { workspace: "desk", maximize: "Full size", close: "Shut", panels: "Tabs", group: (title) => `Group ${title}` } }),
    h(DockLayout, { panels: mk(), commands: false, class: "two", actions: false, tray: false, motion: false, api: (a) => apis.push(a),
      empty: (reset) => h("button", { class: "own-empty", onClick: reset }, "Back") }),
    h(DockLayout, { panels: mk(), commands: false, class: "three", empty: false, api: (a) => apis.push(a), labels: { tray: "Parked", restore: "Wake" } }),
  ], host);
  const one = host.querySelector(".hm-dock.one"), two = host.querySelector(".hm-dock.two"), three = host.querySelector(".hm-dock.three");
  assert.equal(one.getAttribute("aria-roledescription"), "desk");
  assert.deepEqual([...one.querySelectorAll(".hm-dock-btn")].map((x) => x.getAttribute("aria-label")), ["Full size"]);
  assert.ok(one.querySelector(".hm-dock-btn .own-max"));
  assert.equal(one.querySelector(".hm-tab-close").getAttribute("title"), "Shut");
  assert.equal(one.querySelector(".hm-tab-close").textContent, "×");
  assert.equal(one.querySelector("[data-dock-group]").getAttribute("aria-label"), "Group A");
  assert.equal(one.querySelector("[role=tablist]").getAttribute("aria-label"), "Tabs");
  assert.equal(two.querySelector(".hm-dock-actions"), null);
  assert.equal(three.querySelectorAll(".hm-dock-btn").length, 3, "the default buttons stay");
  const [api2, api3] = apis;
  api2.minimize("a");
  api3.minimize("a");
  await tick();
  assert.equal(two.querySelector(".hm-dock-tray"), null, "tray={false}: no tray");
  assert.equal(three.querySelector(".hm-dock-tray").getAttribute("aria-label"), "Parked");
  assert.equal(three.querySelector(".hm-dock-tray-btn").getAttribute("title"), "Wake");
  api2.minimize("b");
  api3.minimize("b");
  await tick();
  assert.ok(two.querySelector(".hm-dock-empty .own-empty"), "own empty state");
  assert.equal(three.querySelector(".hm-dock-empty").textContent, "", "empty={false}: nothing");
  two.querySelector(".own-empty").click();
  await tick();
  assert.equal(two.querySelectorAll("[role=tab]").length, 2, "the own node's reset brings the panels back");
  dispose();
});

test("DockLayout: the announcer is released", () => { announcer.dispose(); });
