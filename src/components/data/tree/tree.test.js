import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { mProps } = await import("../../../props/index.ts");
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { Tree } = await import("./index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const key = (el, k) => el.dispatchEvent(new globalThis.KeyboardEvent("keydown", { key: k, bubbles: true }));

test("Tree: ARIA, expand / collapse with keys and clicks, selection", () => {
  const sel = signal(null);
  const nodes = [{ id: "a", label: "a", children: [{ id: "a1", label: "a1", meta: "3" }] }, { id: "b", label: "b" }];
  const m = mount(() => h(Tree, { nodes, selected: sel, onSelect: (n) => sel.set(n.id), label: "Files" }));
  const tree = m.el.querySelector("[role=tree]");
  assert.equal(tree.getAttribute("aria-label"), "Files");
  const a = [...tree.children].find((x) => x.getAttribute("role") === "treeitem");
  assert.equal(a.getAttribute("aria-expanded"), "false");
  const row = a.querySelector(".m-tree-row");
  key(a, "ArrowRight");
  assert.equal(a.getAttribute("aria-expanded"), "true");
  assert.equal(a.querySelector("[role=group]").hidden, false);
  key(a, "ArrowLeft");
  assert.equal(a.getAttribute("aria-expanded"), "false");
  row.click();
  assert.equal(sel(), "a");
  assert.equal(a.getAttribute("aria-selected"), "true");
  assert.equal(a.querySelector(".m-tree-meta").textContent, "3");
  assert.equal(a.querySelector("[role=treeitem]").getAttribute("aria-level"), "2");
  m.dispose();
});

test("Tree: no chevron, own chevron that follows open, selection colour", () => {
  const nodes = [{ id: "a", label: "a", children: [{ id: "a1", label: "a1" }] }];
  const m = mount(() => [mProps(h(Tree, { nodes, chevron: false }), { color: "brand-purple" }), h(Tree, { nodes, chevron: (_n, open) => h("b", {}, () => (open() ? "-" : "+")) }), h(Tree, { nodes })]);
  const [a, b, c] = m.el.querySelectorAll("[role=tree]");
  assert.equal(a.querySelector(".m-tree-chev"), null);
  assert.equal(a.getAttribute("data-m-color"), "brand-purple");
  const own = b.querySelector(".m-tree-chev.is-own");
  assert.equal(own.textContent, "+");
  key(b.querySelector("[role=treeitem]"), "ArrowRight");
  assert.equal(own.textContent, "-");
  assert.ok(c.querySelector(".m-tree-chev .m-svg"), "the default arrow stays");
  assert.equal(c.getAttribute("data-m-color"), null);
  m.dispose();
});

test("Tree: rows are ListRows with a Chevron; → enters an open node, ← leaves to the parent", () => {
  const nodes = [{ id: "a", label: "a", children: [{ id: "a1", label: "a1" }] }, { id: "b", label: "b" }];
  const m = mount(() => h(Tree, { nodes, expanded: ["a"] }));
  const rows = [...m.el.querySelectorAll(".m-tree-row")], items = [...m.el.querySelectorAll("[role=treeitem]")];
  assert.ok(rows[0].classList.contains("m-listrow") && rows[0].querySelector(".m-tree-chev.m-chevron.is-open"));
  assert.ok(rows[1].querySelector(".m-tree-chev.is-leaf"), "a leaf keeps the arrow's box");
  items[0].focus(); key(items[0], "ArrowRight");
  assert.equal(document.activeElement, items[1], "→ on an open node goes to its first child (focus is on the treeitem)");
  key(items[1], "ArrowLeft");
  assert.equal(document.activeElement, items[0], "← on a leaf goes to its parent");
  m.dispose();
});

test("treeRow `sub` and treeListKey: a tree drawn as one flat list (TreeEditor)", async () => {
  const { treeRow, treeListKey } = await import("./row.ts");
  const { el, dispose } = mount(() => treeRow({ prefix: "m-x", kids: true, open: true, label: "name", sub: "a problem" }, { role: "treeitem" }));
  assert.equal(el.querySelector(".m-x-row .m-listrow-sub").textContent, "a problem");
  dispose();
  const at = { index: 2, count: 5, kids: true, open: false, parent: 0 };
  assert.equal(treeListKey("ArrowDown", at), 3);
  assert.equal(treeListKey("Home", at), 0);
  assert.equal(treeListKey("End", at), 4);
  assert.equal(treeListKey("ArrowRight", at), "open");
  assert.equal(treeListKey("ArrowRight", { ...at, open: true }), 3, "an open node: its first child");
  assert.equal(treeListKey("ArrowLeft", { ...at, open: true }), "close");
  assert.equal(treeListKey("ArrowLeft", at), 0, "a closed node: its parent");
  assert.equal(treeListKey("ArrowLeft", { ...at, parent: -1 }), 2, "a root stays");
  assert.equal(treeListKey("ArrowLeft", at, true), "open", "right-to-left swaps the arrows");
  assert.equal(treeListKey("Enter", at), "activate");
  assert.equal(treeListKey(" ", at), "select");
  assert.equal(treeListKey("x", at), null);
});

test("treeKey: the keys Tree and TreeView share (mirrored in right-to-left)", async () => {
  const { treeKey } = await import("./row.ts");
  assert.equal(treeKey("ArrowRight", { kids: true, open: false }), "open");
  assert.equal(treeKey("ArrowRight", { kids: true, open: true }), "child");
  assert.equal(treeKey("ArrowRight", { kids: false, open: false }), null);
  assert.equal(treeKey("ArrowLeft", { kids: true, open: true }), "close");
  assert.equal(treeKey("ArrowLeft", { kids: false, open: false }), "parent");
  assert.equal(treeKey("ArrowLeft", { kids: true, open: false }, true), "open");
  assert.equal(treeKey("Enter", { kids: false, open: false }), "activate");
  assert.equal(treeKey(" ", { kids: false, open: false }), "select");
  assert.equal(treeKey("x", { kids: true, open: true }), null);
});

test("Tree: toggle=\"chevron\" opens only from the arrow", () => {
  const picked = [];
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(Tree, { nodes: [{ id: "a", label: "A", children: [{ id: "b", label: "B" }] }], toggle: "chevron", onSelect: (n) => picked.push(n.id) }), el);
  const li = el.querySelector(".m-tree-li");
  const row = li.querySelector(".m-tree-row");
  row.click();
  assert.equal(li.getAttribute("aria-expanded"), "false", "a row click only selects");
  assert.deepEqual(picked, ["a"]);
  row.querySelector("[data-chev]").dispatchEvent(new (globalThis.MouseEvent ?? globalThis.Event)("click", { bubbles: true }));
  assert.equal(li.getAttribute("aria-expanded"), "true");
  assert.deepEqual(picked, ["a"], "the arrow does not select");
  dispose();
});
