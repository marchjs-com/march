import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { TreeView } = await import("./index.ts");
const { matchRanges } = await import("../../../core/text.ts");
const { markText } = await import("../../../ui/mark.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const key = (el, k, o = {}) => el.dispatchEvent(new Event("keydown", { bubbles: true, cancelable: true, key: k, ...o }));
const tick = () => new Promise((r) => setTimeout(r, 0));
const nodes = () => [
  { id: "src", label: "src", children: [
    { id: "ui", label: "ui", children: [{ id: "button", label: "button.ts" }, { id: "menu", label: "menü.ts" }] },
    { id: "core", label: "core", children: [{ id: "reactive", label: "reactive.ts" }] },
  ] },
  { id: "docs", label: "docs", lazy: true },
  { id: "readme", label: "README.md" },
];
const labels = (el) => [...el.querySelectorAll(".hm-tv-row")].sort((a, b) => a.dataset.i - b.dataset.i).map((r) => r.dataset.id);

test("text: matchRanges maps folded hits back to the original text; markText wraps them", () => {
  assert.deepEqual(matchRanges("İstanbul ve istasyon", "ist"), [[0, 3], [12, 15]]);
  assert.deepEqual(matchRanges("Menü", "menu"), [[0, 4]]);
  const parts = markText("button.ts", "TON");
  assert.equal(parts.length, 3);
  assert.equal(parts[1].textContent, "ton");
});

test("TreeView: tree roles, keyboard open / close / parent, lazy children load once", async () => {
  let loads = 0;
  const m = mount(() => h(TreeView, { nodes: nodes(), expanded: ["src"], load: async () => { loads++; return [{ id: "guide", label: "guide.md" }]; } }));
  const tree = m.el.querySelector("[role=tree]");
  assert.deepEqual(labels(m.el), ["src", "ui", "core", "docs", "readme"]);
  const first = m.el.querySelector('[data-id="src"]');
  assert.equal(first.getAttribute("aria-expanded"), "true");
  assert.equal(first.getAttribute("aria-level"), "1");
  assert.equal(m.el.querySelector('[data-id="ui"]').getAttribute("aria-setsize"), "2");
  key(tree, "ArrowDown"); // ui
  key(tree, "ArrowRight"); // open ui
  assert.deepEqual(labels(m.el), ["src", "ui", "button", "menu", "core", "docs", "readme"]);
  key(tree, "ArrowRight"); // to first child
  assert.equal(document.getElementById(tree.getAttribute("aria-activedescendant")).dataset.id, "button");
  key(tree, "ArrowLeft"); // to parent
  assert.equal(document.getElementById(tree.getAttribute("aria-activedescendant")).dataset.id, "ui");
  key(tree, "ArrowLeft"); // close
  assert.deepEqual(labels(m.el), ["src", "ui", "core", "docs", "readme"]);
  // lazy
  key(tree, "End"); key(tree, "ArrowUp"); // docs
  key(tree, "ArrowRight");
  assert.equal(m.el.querySelector('[data-id="docs"]').getAttribute("aria-busy"), "true");
  await tick(); await tick();
  assert.deepEqual(labels(m.el).slice(-3), ["docs", "guide", "readme"]);
  key(tree, "ArrowLeft"); key(tree, "ArrowRight");
  assert.equal(loads, 1);
  m.dispose();
});

test("TreeView: multiple selection (click, Ctrl, Shift, Space), typeahead", () => {
  let last = [];
  const m = mount(() => h(TreeView, { nodes: nodes(), expanded: ["src", "ui", "core"], selection: "multiple", onSelect: (ids) => { last = ids; } }));
  const tree = m.el.querySelector("[role=tree]");
  const row = (id) => m.el.querySelector(`[data-id="${id}"]`);
  row("ui").dispatchEvent(new Event("click", { bubbles: true }));
  row("menu").dispatchEvent(new Event("click", { bubbles: true, shiftKey: true }));
  assert.deepEqual(last, ["ui", "button", "menu"]);
  row("readme").dispatchEvent(new Event("click", { bubbles: true, ctrlKey: true }));
  assert.equal(last.length, 4);
  assert.equal(row("readme").getAttribute("aria-selected"), "true");
  key(tree, "r"); // typeahead → reactive.ts
  assert.equal(document.getElementById(tree.getAttribute("aria-activedescendant")).dataset.id, "reactive");
  key(tree, " ");
  assert.ok(last.includes("reactive"));
  m.dispose();
});

test("TreeView: search keeps the path to hits open and highlights them", () => {
  const q = signal("");
  const m = mount(() => h(TreeView, { nodes: nodes(), search: q }));
  assert.deepEqual(labels(m.el), ["src", "docs", "readme"]);
  q.set("menu");
  assert.deepEqual(labels(m.el), ["src", "ui", "menu"]);
  assert.equal(m.el.querySelector('[data-id="menu"] mark').textContent, "menü");
  q.set("zzz");
  assert.match(m.el.querySelector(".hm-tv-empty").textContent, /zzz/);
  m.dispose();
});

test("TreeView: Alt+arrow moves a node among its siblings (keyboard drag and drop)", () => {
  const moves = [];
  const m = mount(() => h(TreeView, { nodes: nodes(), draggable: true, onMove: (ids, target, pos) => moves.push([ids, target, pos]) }));
  const tree = m.el.querySelector("[role=tree]");
  key(tree, "End"); // readme
  key(tree, "ArrowUp", { altKey: true });
  assert.deepEqual(moves, [[["readme"], "docs", "before"]]);
  assert.deepEqual(labels(m.el), ["src", "readme", "docs"]);
  m.dispose();
});

test("TreeView: a lazy folder that starts open loads its children at once", async () => {
  let calls = 0;
  const m = mount(() => h(TreeView, { nodes: [{ id: "a", label: "a", lazy: true }], expanded: ["a"], load: async () => { calls++; return [{ id: "a/x", label: "x.ts" }]; } }));
  await tick(); await tick();
  assert.equal(calls, 1);
  assert.ok([...m.el.querySelectorAll('[role="treeitem"]')].some((r) => r.textContent.includes("x.ts")));
  m.dispose();
});
