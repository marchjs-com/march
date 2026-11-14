import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
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
  const row = a.querySelector(".hm-tree-row");
  key(row, "ArrowRight");
  assert.equal(a.getAttribute("aria-expanded"), "true");
  assert.equal(a.querySelector("[role=group]").hidden, false);
  key(row, "ArrowLeft");
  assert.equal(a.getAttribute("aria-expanded"), "false");
  row.click();
  assert.equal(sel(), "a");
  assert.equal(a.getAttribute("aria-selected"), "true");
  assert.equal(a.querySelector(".hm-tree-meta").textContent, "3");
  assert.equal(a.querySelector("[role=treeitem]").getAttribute("aria-level"), "2");
  m.dispose();
});

test("Tree: no chevron, own chevron that follows open, selection colour", () => {
  const nodes = [{ id: "a", label: "a", children: [{ id: "a1", label: "a1" }] }];
  const m = mount(() => [h(Tree, { nodes, chevron: false, color: "brand-purple" }), h(Tree, { nodes, chevron: (_n, open) => h("b", {}, () => (open() ? "-" : "+")) }), h(Tree, { nodes })]);
  const [a, b, c] = m.el.querySelectorAll("[role=tree]");
  assert.equal(a.querySelector(".hm-tree-chev"), null);
  assert.equal(a.getAttribute("data-hm-color"), "brand-purple");
  const own = b.querySelector(".hm-tree-chev.is-own");
  assert.equal(own.textContent, "+");
  key(b.querySelector(".hm-tree-row"), "ArrowRight");
  assert.equal(own.textContent, "-");
  assert.ok(c.querySelector(".hm-tree-chev .hm-svg"), "the default arrow stays");
  assert.equal(c.getAttribute("data-hm-color"), null);
  m.dispose();
});

test("Tree: rows are ListRows with a Chevron; → enters an open node, ← leaves to the parent", () => {
  const nodes = [{ id: "a", label: "a", children: [{ id: "a1", label: "a1" }] }, { id: "b", label: "b" }];
  const m = mount(() => h(Tree, { nodes, expanded: ["a"] }));
  const rows = [...m.el.querySelectorAll(".hm-tree-row")];
  assert.ok(rows[0].classList.contains("hm-listrow") && rows[0].querySelector(".hm-tree-chev.hm-chevron.is-open"));
  assert.ok(rows[1].querySelector(".hm-tree-chev.is-leaf"), "a leaf keeps the arrow's box");
  rows[0].focus(); key(rows[0], "ArrowRight");
  assert.equal(document.activeElement, rows[1], "→ on an open node goes to its first child");
  key(rows[1], "ArrowLeft");
  assert.equal(document.activeElement, rows[0], "← on a leaf goes to its parent");
  m.dispose();
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
