// DockLayout (the dock of march-app-ui) and AppUI: the layout tree (pure operations, geometry, hit test, save / restore)
// and the workspace in the DOM.
import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";

const { document } = installDom({ url: "http://localhost/" });
const C = await import("./model.ts");
const { row, col, tabs } = C;
const DEFS = [
  { id: "files", min: [150, 160], place: { near: "editor", zone: "left", size: 0.2 } },
  { id: "editor", min: [260, 180] },
  { id: "preview", min: [220, 180], place: { near: "editor", zone: "right", size: 0.45 } },
  { id: "console", min: [180, 90], place: { near: "preview", zone: "bottom", size: 0.36 } },
  { id: "debug", place: { near: "console", zone: "center" } },
];
const PRESET = { title: "Default", tree: () => row([0.2, tabs("files")], [0.45, tabs("editor")], [0.35, col([0.6, tabs("preview")], [0.4, tabs(["console", "debug"])])]) };
const AREA = { x: 0, y: 0, w: 1200, h: 800 };
const base = () => C.presetLayout(PRESET, DEFS);

test("presets get ids, weights sum to 1, nested splits of one direction flatten", () => {
  const L = base();
  assert.equal(L.root.t, "row");
  assert.equal(L.root.kids.length, 3);
  assert.ok(Math.abs(L.root.sizes.reduce((a, b) => a + b, 0) - 1) < 1e-9);
  assert.deepEqual(C.allPanels(L.root).sort(), ["console", "debug", "editor", "files", "preview"]);
  const flat = C.fromTree(row([0.5, tabs("a")], [0.5, row([0.5, tabs("b")], [0.5, tabs("c")])]));
  assert.equal(flat.root.kids.length, 3);
});

test("collapse narrows by the parent split, keeps one group open, restore gives the size back", () => {
  let L = base();
  const files = C.groupOf(L, "files").id;
  assert.equal(C.collapseMode(L.root, files), "vertical");
  assert.equal(C.collapseMode(L.root, C.groupOf(L, "console").id), "horizontal");
  const before = C.computeRects(L, AREA).groups[files].w;
  L = C.collapseGroup(L, files, { area: AREA });
  const R = C.computeRects(L, AREA);
  assert.equal(R.groups[files], undefined);
  assert.equal(R.strips.length, 1);
  assert.equal(R.strips[0].mode, "vertical");
  assert.equal(R.strips[0].rect.w, C.METRICS.strip);
  L = C.restoreGroup(L, files, "files", { area: AREA });
  assert.equal(C.computeRects(L, AREA).groups[files].w, before);
  // the last open group cannot collapse
  let M = C.fromTree(tabs("a"));
  assert.equal(C.canCollapse(M, M.root.id), false);
  M = C.fromTree(col([0.5, tabs("a")], [0.5, tabs("b")]));
  M = C.collapseGroup(M, C.groupOf(M, "a").id);
  assert.equal(C.collapseGroup(M, C.groupOf(M, "b").id), M);
});

test("move: to a side makes a split, to the centre a tab, to the root edge a new column", () => {
  let L = base();
  L = C.movePanel(L, "console", C.groupOf(L, "editor").id, "bottom");
  const ed = C.groupOf(L, "editor"), con = C.groupOf(L, "console");
  assert.notEqual(ed.id, con.id);
  L = C.movePanel(L, "files", C.groupOf(L, "editor").id, "center", 0);
  assert.deepEqual(C.groupOf(L, "editor").panels, ["files", "editor"]);
  assert.equal(C.groupOf(L, "files").active, "files");
  L = C.movePanel(L, "debug", C.ROOT, "right");
  assert.equal(L.root.t, "row");
  assert.deepEqual(L.root.kids.at(-1).panels, ["debug"]);
  L = C.moveTab(L, "editor", 0);
  assert.deepEqual(C.groupOf(L, "editor").panels, ["editor", "files"]);
});

test("geometry: minimums kept, splitters between open neighbours, resize and equalize", () => {
  const L = base(), R = C.computeRects(L, AREA, { mins: Object.fromEntries(DEFS.map((d) => [d.id, d.min ?? [120, 80]])) });
  assert.equal(Object.keys(R.groups).length, 4);
  assert.equal(R.splitters.length, 3);
  const s = R.splitters[0], info = R.splits[s.split];
  const L2 = C.resizeSplit(L, s.split, s.a, s.b, -1000, R);
  const R2 = C.computeRects(L2, AREA, { mins: { files: [150, 160] } });
  assert.equal(R2.splits[s.split].px[s.a], Math.min(info.min[s.a], info.px[s.a]));
  const E = C.equalize(L2, s.split);
  assert.ok(Math.abs(E.root.sizes[0] - E.root.sizes[1]) < 1e-9);
  assert.deepEqual(C.allot(100, [1, 1, 1], [0, 0, 0]).reduce((a, b) => a + b, 0), 100);
});

test("hit test: outer edge, tab header, the five zones", () => {
  const L = base(), R = C.computeRects(L, { x: 8, y: 8, w: 1184, h: 784 });
  assert.equal(C.hitTest(R, 10, 400).target, C.ROOT);
  const g = R.groups[C.groupOf(L, "editor").id];
  assert.equal(C.hitTest(R, g.x + g.w / 2, g.y + 10).onTabs, true);
  assert.equal(C.hitTest(R, g.x + 5, g.y + g.h / 2).zone, "left");
  assert.equal(C.hitTest(R, g.x + g.w / 2, g.y + g.h - 5).zone, "bottom");
  assert.equal(C.hitTest(R, g.x + g.w / 2, g.y + g.h / 2).zone, "center");
});

test("save and restore: unknown and repeated panels drop, missing ones go to their place, broken input is null", () => {
  const L = base(), raw = C.serialize(L);
  assert.deepEqual(C.restoreLayout(JSON.parse(JSON.stringify(raw)), DEFS).root.t, "row");
  assert.equal(C.restoreLayout({ v: 99, root: {} }, DEFS), null);
  assert.equal(C.restoreLayout("x", DEFS), null);
  const R = C.restoreLayout({ v: 1, seq: 1, max: null, root: { t: "tabs", id: "g1", panels: ["editor", "ghost", "editor"], active: "editor" } }, DEFS);
  assert.deepEqual(C.allPanels(R.root).sort(), ["console", "debug", "editor", "files", "preview"]);
  assert.ok(!C.allPanels(R.root).includes("ghost"));
  assert.deepEqual(C.groupOf(R, "debug").panels, ["console", "debug"]);
});

test("maximize, reveal, focus mode, reset panel", () => {
  let L = base();
  const ed = C.groupOf(L, "editor").id;
  L = C.maximize(L, ed);
  assert.equal(L.max, ed);
  L = C.reveal(L, "debug");
  assert.equal(L.max, null);
  assert.equal(C.groupOf(L, "debug").active, "debug");
  const F = C.focusOnly(L, "preview");
  assert.deepEqual(C.groups(F.root).filter((g) => !g.collapsed).map((g) => g.panels[0]), ["preview"]);
  const moved = C.movePanel(L, "files", C.groupOf(L, "editor").id, "center");
  const back = C.resetPanel(moved, DEFS[0], DEFS);
  assert.deepEqual(C.groupOf(back, "files").panels, ["files"]);
});

const { h, render, signal } = await import("../../../index.ts");
const { DockLayout } = await import("./index.ts");
const tick = () => new Promise((r) => setTimeout(r, 0));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const panelsOf = (list) => list.map((d) => ({ ...d, title: d.id.toUpperCase(), content: () => h("p", { class: `body-${d.id}` }, d.id) }));

test("DockLayout: panels built once, a TabList per group, collapse / reveal / reset through the api, kept in storage", async () => {
  const kept = new Map();
  const storage = { get: (k) => kept.get(k) ?? null, set: (k, v) => kept.set(k, v) };
  let api;
  const { el, dispose } = mount(() => h(DockLayout, { panels: panelsOf(DEFS), presets: { main: PRESET }, persist: "t", storage, commands: false, api: (a) => { api = a; } }));
  const root = el.querySelector(".m-dock");
  assert.equal(root.querySelectorAll(".m-dock-panel").length, 5);
  assert.equal(root.querySelectorAll(".body-editor").length, 1);
  assert.equal(api.isOpen("files"), true);
  api.collapse("files");
  assert.equal(api.isOpen("files"), false);
  assert.ok(C.groupOf(api.layout(), "files").collapsed);
  api.open("files");
  assert.equal(api.isOpen("files"), true);
  api.open("debug");
  assert.equal(C.groupOf(api.layout(), "debug").active, "debug");
  await new Promise((r) => setTimeout(r, 300));
  assert.ok(kept.get("t:layout"), "the layout is saved");
  api.reset();
  assert.equal(C.groupOf(api.layout(), "debug").active, "console");
  dispose();
});

test("DockLayout: the panel list may change (an editor opens next to its place, a closed one leaves the tree)", async () => {
  const list = signal(panelsOf(DEFS.slice(0, 3)));
  let api;
  const { el, dispose } = mount(() => h(DockLayout, { panels: list, presets: { main: { title: "M", tree: () => row([0.3, tabs("files")], [0.7, tabs("editor")]) } }, commands: false, api: (a) => { api = a; } }));
  list.set([...list(), ...panelsOf([{ id: "notes", place: { near: "editor", zone: "center" } }])]);
  await tick();
  assert.deepEqual(C.groupOf(api.layout(), "notes").panels, ["editor", "notes"]);
  assert.ok(el.querySelector(".body-notes"));
  list.set(list().filter((p) => p.id !== "notes"));
  await tick();
  assert.equal(C.groupOf(api.layout(), "notes"), null);
  assert.equal(el.querySelector(".body-notes"), null);
  dispose();
});

