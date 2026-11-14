import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const { DataGrid } = await import("./index.ts");
const { createAxis, windowRange } = await import("../../../core/virtual.ts");
const { groupRows, aggregate } = await import("../../../data/group.ts");
const { createSelection, moveCursor } = await import("../../../core/selection.ts");

const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const key = (el, k, o = {}) => el.dispatchEvent(new Event("keydown", { bubbles: true, cancelable: true, key: k, ...o }));
const ptr = (el, type, o = {}) => el.dispatchEvent(new Event(type, { bubbles: true, cancelable: true, button: 0, pointerId: 1, clientX: 5, clientY: 5, ...o }));
const regions = ["North", "South", "East", "West"];
const big = Array.from({ length: 100000 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}`, region: regions[i % 4], amount: (i % 100) + 1 }));

test("core virtual axis: fixed and variable sizes, range, indexAt", () => {
  const fixed = createAxis({ count: () => 100000, size: 36 });
  assert.equal(fixed.total(), 3600000);
  assert.deepEqual(fixed.range(36000, 360, 2), { start: 998, end: 1013, top: 998 * 36, bottom: (100000 - 1013) * 36 });
  const sizes = [100, 50, 200, 80];
  const vary = createAxis({ count: () => 4, size: (i) => sizes[i] });
  assert.equal(vary.total(), 430);
  assert.equal(vary.offsetOf(2), 150);
  assert.equal(vary.indexAt(149), 1);
  assert.equal(vary.indexAt(150), 2);
  assert.deepEqual(vary.range(120, 60, 0), { start: 1, end: 3, top: 100, bottom: 80 });
  assert.equal(windowRange({ count: 10, height: 100, rowHeight: 20, overscan: 0 }).end, 6);
});

test("core selection: pick (click / ctrl / shift), range off, cursor keys", () => {
  const items = ["a", "b", "c", "d", "e"];
  const s = createSelection({ items: () => items });
  s.pick("b");
  s.pick("d", { shiftKey: true });
  assert.deepEqual(s.keys(), ["b", "c", "d"]);
  s.pick("a", { ctrlKey: true });
  assert.equal(s.state(), "some");
  s.range("c", true, false); // anchor is "a" (last Ctrl pick): a..c off
  assert.deepEqual(s.keys(), ["d"]);
  s.selectAll();
  assert.equal(s.state(), "all");
  assert.equal(moveCursor({ key: "ArrowDown", index: 2, count: 10, columns: 4 }), 6);
  assert.equal(moveCursor({ key: "ArrowRight", index: 2, count: 10, columns: 4, rtl: true }), 1);
  assert.equal(moveCursor({ key: "End", index: 5, count: 10, columns: 4 }), 7);
  assert.equal(moveCursor({ key: "x", index: 0, count: 3 }), null);
});

test("data group: nested groups, aggregates, collapsed groups hide their rows", () => {
  const rows = big.slice(0, 8);
  assert.equal(aggregate(rows, (r) => r.amount, "sum"), 36);
  assert.equal(aggregate(rows, (r) => r.amount, "avg"), 4.5);
  const out = groupRows(rows, [{ key: "region", value: (r) => r.region }], { aggregates: [{ key: "amount", value: (r) => r.amount, aggregate: "sum" }], collapsed: (id) => id === "South" });
  const heads = out.filter((x) => x.kind === "group");
  assert.deepEqual(heads.map((g) => [g.id, g.count, g.aggregates.amount, g.open]), [["North", 2, 6, true], ["South", 2, 8, false], ["East", 2, 10, true], ["West", 2, 12, true]]);
  assert.equal(out.length, 4 + 6);
});

test("DataGrid: 100k rows render only the window; sort, group, keyboard cursor, selection, edit", async () => {
  const rows = signal(big);
  const saved = [];
  const m = mount(() => h(DataGrid, {
    rows, rowKey: "id", height: 400, selectable: true,
    columns: [{ key: "id", label: "ID", width: 80 }, { key: "name", label: "Name", editable: true }, { key: "region", label: "Region" }, { key: "amount", label: "Amount", type: "number", aggregate: "sum" }],
    onEdit: (row, k, v) => { saved.push([row.id, k, v]); rows.set(rows().map((r) => (r.id === row.id ? { ...r, [k]: v } : r))); },
  }));
  const grid = m.el.querySelector("[role=grid]");
  assert.equal(grid.getAttribute("aria-rowcount"), "100001");
  const rendered = m.el.querySelectorAll(".hm-dg-body .hm-dg-row").length;
  assert.ok(rendered > 5 && rendered < 40, `rendered ${rendered} rows`);
  // totals footer
  assert.match(m.el.querySelector(".hm-dg-foot").textContent, /5[.,]?050[.,]?000/);
  // keyboard cursor: Down, End, aria-activedescendant
  key(grid, "ArrowDown");
  key(grid, "End");
  const active = grid.getAttribute("aria-activedescendant");
  assert.ok(active && document.getElementById(active).classList.contains("is-cursor"));
  assert.equal(document.getElementById(active).dataset.key, "amount");
  // Space selects the row; Shift+Down extends
  key(grid, " ");
  key(grid, "ArrowDown", { shiftKey: true });
  assert.equal(m.el.querySelectorAll(".hm-dg-row.is-selected").length, 2);
  assert.match(m.el.querySelector(".hm-dg-total").textContent, /2 selected/);
  // edit: Home → name column … type a letter starts editing with that draft, Enter saves
  key(grid, "Home");
  key(grid, "ArrowRight");
  key(grid, "Z");
  const input = m.el.querySelector(".hm-dg-cell.is-editing input");
  assert.ok(input, "editor open");
  assert.equal(input.value, "Z");
  key(input, "Enter");
  await new Promise((r) => setTimeout(r, 5));
  assert.deepEqual(saved, [[3, "name", "Z"]]);
  // sort by clicking the header (pointerdown → pointerup without movement = click)
  const th = [...m.el.querySelectorAll(".hm-dg-th")].find((x) => x.dataset.key === "amount");
  ptr(th, "pointerdown");
  ptr(document, "pointerup");
  assert.equal([...m.el.querySelectorAll(".hm-dg-th")].find((x) => x.dataset.key === "amount").getAttribute("aria-sort"), "ascending");
  m.dispose();
});

test("DataGrid: grouping shows group rows with counts and aggregates; collapsing hides rows", () => {
  const rows = big.slice(0, 40);
  const m = mount(() => h(DataGrid, { rows, rowKey: "id", groupBy: ["region"], columns: [{ key: "name" }, { key: "region" }, { key: "amount", aggregate: "sum" }] }));
  const groups = () => [...m.el.querySelectorAll(".hm-dg-group")];
  const grid = m.el.querySelector("[role=grid]");
  assert.equal(grid.getAttribute("aria-rowcount"), String(1 + 4 + 40));
  assert.equal(groups()[0].getAttribute("aria-expanded"), "true");
  assert.match(groups()[0].textContent, /North/);
  assert.match(groups()[0].querySelector(".hm-dg-count").textContent, /^10$/);
  key(grid, "Enter"); // cursor on the first group row
  assert.equal(groups()[0].getAttribute("aria-expanded"), "false");
  assert.equal(grid.getAttribute("aria-rowcount"), String(1 + 4 + 30));
  // the chip in the toolbar removes the grouping
  m.el.querySelector(".hm-dg-groups .hm-chip2-x").click();
  assert.equal(groups().length, 0);
  m.dispose();
});

test("DataGrid: own texts, single tools off, no column menu, empty state off or own", () => {
  const rows = big.slice(0, 20), columns = [{ key: "name", label: "Name" }, { key: "amount", label: "Amount", aggregate: "sum" }];
  const m = mount(() => [
    h(DataGrid, { rows, columns, selectable: true, labels: { search: "Find", rows: (n) => `${n} orders`, total: "Sum of all", csv: "Export", selectAll: "All of them" } }),
    h(DataGrid, { rows, columns, toolbar: { csv: false, groups: false, filters: false }, columnMenu: false, animate: false, class: "mine" }),
    h(DataGrid, { rows: [], columns, toolbar: false, empty: false }),
    h(DataGrid, { rows: [], columns, empty: h("i", { class: "own-empty" }, "nothing"), labels: { noRows: "unused" } }),
    h(DataGrid, { rows: [], columns, labels: { noRows: "No orders" } }),
  ]);
  const [a, b, c, d, e] = m.el.querySelectorAll(".hm-dg");
  assert.equal(a.querySelector(".hm-dg-search input").getAttribute("placeholder"), "Find");
  assert.equal(a.querySelector(".hm-dg-total").textContent, "20 orders");
  assert.match(a.querySelector(".hm-dg-toolbar").textContent, /Export/);
  assert.equal(a.querySelector(".hm-dg-foot-row b").textContent, "Sum of all");
  assert.equal(a.querySelector(".hm-dg-head .hm-table-check input").getAttribute("aria-label"), "All of them");
  assert.ok(a.querySelector(".hm-dg-th-menu"));
  assert.ok(b.className.includes("mine"));
  assert.ok(b.querySelector(".hm-dg-search") && b.querySelector(".hm-dg-total"));
  assert.equal(b.querySelector(".hm-dg-groups"), null);
  assert.equal(b.querySelectorAll(".hm-dg-toolbar button").length, 0, "no filter and CSV buttons");
  assert.equal(b.querySelector(".hm-dg-th-menu"), null);
  assert.equal(c.querySelector(".hm-dg-toolbar, .hm-dg-empty"), null);
  assert.ok(d.querySelector(".hm-dg-empty .own-empty"));
  assert.equal(e.querySelector(".hm-dg-empty").textContent, "No orders");
  m.dispose();
});
