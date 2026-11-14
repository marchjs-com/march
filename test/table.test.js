import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installDom } from "../src/testing/dom.ts";
const { document, window } = installDom({ url: "http://localhost/list" });
const { signal, h, render, createRoot, store, setLocale } = await import("../src/index.ts");
setLocale("en");
const T = await import("../src/table/index.ts");
const R = await import("../src/router/index.ts");
const { schema } = await import("../src/schema/index.ts");
const { Event } = await import("../src/testing/dom.ts");

const tick = (ms = 0) => new Promise((r) => setTimeout(r, ms));
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const headless = (o) => createRoot(() => T.createTable(o));
const ids = (rows) => rows.map((r) => r.id);
const key = (el, k, extra = {}) => el.dispatchEvent(new Event("keydown", { bubbles: true, cancelable: true, key: k, ...extra }));
const click = (el, extra = {}) => el.dispatchEvent(new Event("click", { bubbles: true, cancelable: true, ...extra }));
const input = (el, v, type = "input") => { el.value = v; el.dispatchEvent(new Event(type, { bubbles: true })); };
/** Open a toolbar / row menu of a table: the floating panel (Popover) loads on first use and is drawn in the overlay layer. */
const openMenu = async (el, cls) => { click(el.querySelector(`.${cls} button`)); for (let i = 0; i < 20 && !document.querySelector(".m-table-menu-body"); i++) await tick(5); return document.querySelector(".m-table-menu-body"); };
const closeMenu = (el, cls) => click(el.querySelector(`.${cls} button`));
/** Minimal action object (same shape as hadi-march/ui action()). */
function act(label, fn) {
  const busy = signal(false);
  return { kind: "march.action", label: () => label, opts: {}, busy: () => busy(), visible: () => true, disabled: () => busy(),
    async run(...a) { busy.set(true); try { return await fn(...a); } finally { busy.set(false); } } };
}

const PEOPLE = [
  { id: 1, name: "Zeynep", city: "İstanbul", age: 31, joined: "2024-03-01", active: true, team: "red" },
  { id: 2, name: "Ali", city: "Ankara", age: 25, joined: "2023-11-15", active: false, team: "blue" },
  { id: 3, name: "Émile", city: "Paris", age: 31, joined: "2024-07-20", active: true, team: "blue" },
  { id: 4, name: "Bob", city: "Izmir", age: 40, joined: "2022-01-05", active: true, team: "green" },
  { id: 5, name: "Çağrı", city: "Bursa", age: null, joined: "2024-01-10", active: false, team: "red" },
];
const COLS = [
  { key: "name", label: "Name", filter: "text" },
  { key: "city", label: "City", filter: "text" },
  { key: "age", label: "Age", filter: "range", align: "end" },
  { key: "joined", label: "Joined", filter: "dateRange" },
  { key: "active", label: "Active", filter: "bool" },
  { key: "team", label: "Team", filter: "select", options: ["red", "blue", "green"] },
];

test("client sort: single, toggle cycle, multi with shift, nulls last", () => {
  const tb = headless({ rows: PEOPLE, columns: COLS });
  tb.toggleSort("age");
  assert.deepEqual(ids(tb.rows()), [2, 1, 3, 4, 5]);
  tb.toggleSort("age");
  assert.deepEqual(ids(tb.rows()), [4, 1, 3, 2, 5], "desc keeps nulls last");
  tb.toggleSort("name", true);
  assert.deepEqual(tb.sort(), [{ key: "age", dir: "desc" }, { key: "name", dir: "asc" }]);
  assert.deepEqual(ids(tb.rows()), [4, 3, 1, 2, 5], "ties broken by name (Émile before Zeynep, accent-insensitive)");
  tb.toggleSort("age", true); tb.toggleSort("name"); // age removed, then name → desc only
  assert.deepEqual(tb.sort(), [{ key: "name", dir: "desc" }]);
  tb.toggleSort("name");
  assert.deepEqual(tb.sort(), []);
});

test("filters per type, search with locale folding, chips text", () => {
  const tb = headless({ rows: PEOPLE, columns: COLS });
  tb.setFilter("name", "e");
  assert.deepEqual(ids(tb.rows()), [1, 3], "text contains, folded (É)");
  tb.clearFilters();
  tb.setFilter("age", { min: 30, max: 35 });
  assert.deepEqual(ids(tb.rows()), [1, 3]);
  tb.setFilter("age", { min: 30, max: null });
  assert.deepEqual(ids(tb.rows()), [1, 3, 4]);
  tb.clearFilters();
  tb.setFilter("joined", { from: "2024-01-01", to: "2024-06-30" });
  assert.deepEqual(ids(tb.rows()), [1, 5]);
  tb.clearFilters();
  tb.setFilter("active", false);
  assert.deepEqual(ids(tb.rows()), [2, 5]);
  tb.setFilter("active", null);
  tb.setFilter("team", ["red", "green"]);
  assert.deepEqual(ids(tb.rows()), [1, 4, 5]);
  assert.deepEqual(tb.activeFilters().map((f) => f.text), ["red, green"]);
  tb.clearFilters();
  tb.setSearch("istanbul");
  assert.deepEqual(ids(tb.rows()), [1], "İstanbul matches istanbul");
  tb.setSearch("CAGRI");
  assert.deepEqual(ids(tb.rows()), [5], "Çağrı matches CAGRI");
  tb.setSearch("izmir");
  assert.deepEqual(ids(tb.rows()), [4]);
  assert.equal(T.fold("İSTANBUL Iğdır"), "istanbul igdir");
});

test("client paging and page size; filter resets page", () => {
  const rows = Array.from({ length: 23 }, (_, i) => ({ id: i + 1, n: i + 1 }));
  const tb = headless({ rows, columns: [{ key: "n", filter: "range" }], pageSize: 10 });
  assert.equal(tb.pageCount(), 3);
  assert.deepEqual(ids(tb.rows()), [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  tb.next(); tb.next();
  assert.deepEqual(ids(tb.rows()), [21, 22, 23]);
  assert.equal(tb.hasNext(), false);
  tb.prev();
  assert.equal(tb.page(), 2);
  tb.setSize(5);
  assert.equal(tb.page(), 1);
  assert.equal(tb.pageCount(), 5);
  tb.setPage(4);
  tb.setFilter("n", { min: 20 });
  assert.equal(tb.page(), 1);
  assert.deepEqual(ids(tb.rows()), [20, 21, 22, 23]);
});

test("server mode: offset params mapping, total, refetch", async () => {
  const seen = [];
  const source = async (p) => { seen.push(p); return { items: [{ id: p.skip + 1 }, { id: p.skip + 2 }], total: 42 }; };
  const tb = headless({ source, columns: COLS, pageSize: 2, paramNames: { offset: "skip", size: "limit", page: null, sort: (s) => ({ order: s.map((x) => (x.dir === "desc" ? "-" : "") + x.key).join(",") }) } });
  await tick();
  assert.deepEqual(seen[0], { limit: 2, skip: 0, order: "", filters: {}, search: "" });
  assert.equal(tb.total(), 42);
  assert.equal(tb.pageCount(), 21);
  tb.next();
  await tick();
  assert.equal(seen.at(-1).skip, 2);
  assert.deepEqual(ids(tb.rows()), [3, 4]);
  tb.toggleSort("age"); tb.toggleSort("age");
  tb.setFilter("team", ["red"]);
  await tick();
  assert.deepEqual(seen.at(-1), { limit: 2, skip: 0, order: "-age", filters: { team: ["red"] }, search: "" });
  const n = seen.length;
  await tb.refetch();
  assert.equal(seen.length, n + 1);
});

test("server mode: cursor paging next/prev", async () => {
  const seen = [];
  const pages = { "": { items: [{ id: 1 }], nextCursor: "c2" }, c2: { items: [{ id: 2 }], nextCursor: "c3" }, c3: { items: [{ id: 3 }] } };
  const tb = headless({ source: async (p) => { seen.push(p); return pages[p.after ?? ""]; }, columns: [{ key: "id" }], paging: "cursor", paramNames: { cursor: "after" } });
  await tick();
  assert.deepEqual(Object.keys(seen[0]).sort(), ["after", "filters", "search", "size", "sort"]);
  assert.equal(tb.hasPrev(), false);
  tb.next(); await tick();
  assert.deepEqual(ids(tb.rows()), [2]);
  tb.next(); await tick();
  assert.deepEqual(ids(tb.rows()), [3]);
  assert.equal(tb.hasNext(), false);
  tb.prev(); await tick();
  assert.equal(seen.at(-1).after, "c2");
  tb.prev(); await tick();
  assert.equal(seen.at(-1).after, null);
  assert.equal(tb.hasPrev(), false);
});

test("URL sync: state is written to the query string and restored (shareable link)", async () => {
  history.replaceState(null, "", "/list");
  R.createRouter({ routes: { "/list": { component: () => null } } });
  await tick();
  let dispose;
  const tb = createRoot((d) => { dispose = d; return T.createTable({ rows: PEOPLE, columns: COLS, urlKey: "u", urlDelay: 0, pageSize: 2 }); });
  tb.toggleSort("age"); tb.toggleSort("name", true);
  tb.setFilter("team", ["red", "blue"]);
  tb.setFilter("age", { min: 20 });
  tb.setSearch("a");
  tb.next();
  await tick();
  const sp = new URLSearchParams(location.search);
  assert.equal(sp.get("u.s"), "age,name");
  assert.equal(sp.get("u.q"), "a");
  assert.equal(sp.get("u.p"), "2");
  assert.equal(sp.get("u.f.team"), '["red","blue"]');
  assert.equal(R.query()["u.q"], "a", "router query updated");
  dispose();
  const again = headless({ rows: PEOPLE, columns: COLS, urlKey: "u", urlDelay: 0, pageSize: 2 });
  assert.deepEqual(again.sort(), [{ key: "age", dir: "asc" }, { key: "name", dir: "asc" }]);
  assert.deepEqual(again.filters(), { team: ["red", "blue"], age: { min: 20 } });
  assert.equal(again.search(), "a");
  assert.equal(again.page(), 2);
  again.clearFilters();
  await tick();
  assert.equal(new URLSearchParams(location.search).has("u.f.team"), false);
  R._resetRouter();
  history.replaceState(null, "", "/");
});

test("selection: row checkbox, shift range, select page / all matching, bulk action clears", async () => {
  const removed = [];
  const del = act("Delete", async (rows) => { removed.push(...ids(rows)); });
  const rows = Array.from({ length: 12 }, (_, i) => ({ id: i + 1, name: `n${i + 1}` }));
  let tb;
  const { el } = mount(() => { tb = T.createTable({ rows, columns: [{ key: "name" }], pageSize: 5 }); return h(T.Table, { table: tb, selectable: true, bulkActions: [del], paging: true }); });
  const boxes = () => el.querySelectorAll("tbody .m-table-check input");
  click(boxes()[0]);
  click(boxes()[3], { shiftKey: true });
  assert.deepEqual(ids(tb.selectedRows()), [1, 2, 3, 4]);
  assert.equal(el.querySelector(".m-table-bulk-count").textContent, "4 selected");
  assert.equal(el.querySelectorAll("tr[aria-selected=true]").length, 4);
  click(el.querySelector("thead .m-table-check input"));
  assert.equal(tb.selectedCount(), 5);
  click(el.querySelector(".m-table-selectall"));
  assert.equal(tb.selectedCount(), 12);
  click([...el.querySelectorAll(".m-table-bulk button")].find((b) => b.textContent === "Delete"));
  await tick(); await tick();
  assert.equal(removed.length, 12);
  assert.equal(tb.selectedCount(), 0);
  assert.equal(el.querySelector(".m-table-bulk"), null);
});

test("inline edit: validation error, Escape cancels, Enter saves", async () => {
  const S = schema({ name: { type: "text", required: true, max: 10 }, age: { type: "int", min: 0 } });
  const rows = store([{ id: 1, name: "Ada", age: 36 }]);
  const edits = [];
  const onEdit = async (row, k, v) => { edits.push([row.id, k, v]); row[k] = v; };
  const { el } = mount(() => h(T.Table, { rows, schema: S, columns: S.columns({ name: { editable: true }, age: { editable: true } }), onEdit }));
  const cell = () => el.querySelector('td[data-col="age"]');
  cell().focus();
  key(cell(), "Enter");
  const inp = cell().querySelector("input");
  assert.ok(inp, "editor opened");
  assert.ok(inp.classList.contains("m-number"), "a number column edits in a NumberInput");
  input(inp, "-3");
  key(inp, "Enter");
  await tick();
  assert.equal(cell().querySelector(".m-table-edit .m-field-error").textContent, "Must be at least 0");
  assert.equal(inp.getAttribute("aria-invalid"), "true");
  key(inp, "Escape");
  assert.equal(cell().querySelector("input"), null);
  assert.equal(cell().textContent, "36");
  cell().dispatchEvent(new Event("dblclick", { bubbles: true }));
  const inp2 = cell().querySelector("input");
  input(inp2, "37");
  key(inp2, "Enter");
  await tick();
  assert.deepEqual(edits, [[1, "age", 37]]);
  assert.equal(cell().querySelector("input"), null);
  assert.equal(cell().textContent, "37");
});

test("expand row via button and Enter key; row click handler", () => {
  const clicked = [];
  const { el } = mount(() => h(T.Table, { rows: PEOPLE.slice(0, 2), columns: COLS, expand: (r) => h("p", { class: "detail" }, `Details of ${r.name}`) }));
  el.querySelector(".m-table-expander").click();
  assert.equal(el.querySelector(".detail").textContent, "Details of Zeynep");
  assert.equal(el.querySelector(".m-table-expander").getAttribute("aria-expanded"), "true");
  const cell = el.querySelectorAll("tr[data-row]")[1].querySelector('td[data-col="name"]');
  key(cell, "Enter");
  assert.equal(el.querySelectorAll(".detail").length, 2);
  el.querySelector(".m-table-expander").click();
  assert.equal(el.querySelectorAll(".detail").length, 1);
  const m = mount(() => h(T.Table, { rows: PEOPLE.slice(0, 2), columns: COLS, onRowClick: (r) => clicked.push(r.id) }));
  click(m.el.querySelectorAll("tr[data-row]")[1].querySelector("td"));
  assert.deepEqual(clicked, [2]);
});

test("CSV quoting, BOM, formatted vs raw; JSON; download uses a revoked object URL", async () => {
  const rows = [{ id: 1, a: 'say "hi"', b: "x,y", c: "line\nbreak", d: "=SUM(A1)", n: 1234.5, ok: true }];
  const cols = ["a", "b", "c", "d", { key: "n", format: ["number", 1] }, "ok"].map(T.column);
  const csv = T.toCSV(rows, cols);
  assert.equal(csv, 'A,B,C,D,N,Ok\r\n"say ""hi""","x,y","line\nbreak",\'=SUM(A1),1234.5,true');
  const tb = headless({ rows, columns: cols });
  const f = tb.toCSV({ formatted: true, bom: true });
  assert.ok(f.startsWith(String.fromCharCode(0xfeff) + "A,"));
  assert.ok(f.includes('"1,234.5"') && f.endsWith(",Yes"));
  assert.deepEqual(JSON.parse(tb.toJSON())[0], { a: 'say "hi"', b: "x,y", c: "line\nbreak", d: "=SUM(A1)", n: 1234.5, ok: true });
  const made = [], revoked = [];
  const orig = { c: URL.createObjectURL, r: URL.revokeObjectURL };
  URL.createObjectURL = (b) => { made.push(b); return "blob:x"; };
  URL.revokeObjectURL = (u) => revoked.push(u);
  let clicked = null;
  const origClick = Element.prototype.click;
  Element.prototype.click = function () { if (this.getAttribute?.("download")) clicked = { name: this.getAttribute("download"), attached: this.isConnected }; return origClick?.call(this); };
  try { await tb.exportCSV({ filename: "people" }); await tick(); } finally { Element.prototype.click = origClick; }
  assert.equal(clicked?.name, "people.csv");
  assert.equal(clicked?.attached, false, "the download link is never added to the page");
  assert.equal(made.length, 1);
  assert.deepEqual(revoked, ["blob:x"]);
  assert.equal(new TextDecoder("utf-8", { ignoreBOM: true }).decode(await made[0].arrayBuffer()), String.fromCharCode(0xfeff) + `${tb.toCSV({ formatted: false })}`);
  Object.assign(URL, { createObjectURL: orig.c, revokeObjectURL: orig.r });
});

test("saved views persist in localStorage; default view applies on load", () => {
  localStorage.clear();
  const a = headless({ rows: PEOPLE, columns: COLS, storageKey: "people.table" });
  a.setFilter("team", ["red"]);
  a.toggleSort("age");
  a.setHidden("city", true);
  a.setWidth("name", 220);
  a.saveView("Reds");
  a.setDefaultView("Reds");
  a.clearFilters();
  a.saveView("All");
  const saved = JSON.parse(localStorage.getItem("people.table"));
  assert.deepEqual(saved.views.map((v) => v.name), ["Reds", "All"]);
  assert.equal(saved.default, "Reds");
  const b = headless({ rows: PEOPLE, columns: COLS, storageKey: "people.table" });
  assert.equal(b.activeView(), "Reds");
  assert.deepEqual(b.filters(), { team: ["red"] });
  assert.deepEqual(b.sort(), [{ key: "age", dir: "asc" }]);
  assert.equal(b.isHidden("city"), true);
  assert.equal(b.widthOf("name"), 220);
  b.applyView("All");
  assert.deepEqual(b.filters(), {});
  b.deleteView("Reds");
  assert.equal(JSON.parse(localStorage.getItem("people.table")).default, null);
  localStorage.setItem("broken", "{not json");
  assert.doesNotThrow(() => headless({ rows: [], columns: COLS, storageKey: "broken" }));
});

test("virtual scrolling renders a window of 100,000 rows and moves on scroll", () => {
  const rows = Array.from({ length: 100_000 }, (_, i) => ({ id: i, label: `row ${i}` }));
  const { el } = mount(() => h(T.Table, { rows, columns: [{ key: "label" }], virtual: true, height: 400, rowHeight: 40, overscan: 5 }));
  const rendered = () => el.querySelectorAll("tr[data-row]");
  assert.equal(rendered().length, 16, "10 visible + 1 + 5 overscan");
  assert.equal(rendered()[0].textContent, "row 0");
  const scroller = el.querySelector(".m-table-scroll");
  scroller.scrollTop = 40 * 50_000;
  scroller.dispatchEvent(new Event("scroll"));
  const r = rendered();
  assert.equal(r.length, 21);
  assert.equal(r[0].textContent, "row 49995");
  assert.equal(r[0].getAttribute("aria-rowindex"), "49997");
  const [top, bottom] = el.querySelectorAll(".m-table-spacer td");
  assert.equal(top.style.getPropertyValue("height"), `${49995 * 40}px`);
  assert.equal(bottom.style.getPropertyValue("height"), `${(100_000 - 50_016) * 40}px`);
  assert.equal(el.querySelector(".m-table-range").textContent, "100000 rows");
});

test("cards layout renders label/value pairs", () => {
  const { el } = mount(() => h(T.Table, { rows: PEOPLE.slice(0, 2), columns: COLS, layout: "cards", selectable: true }));
  assert.equal(el.querySelector("table"), null);
  const cards = el.querySelectorAll(".m-table-card");
  assert.equal(cards.length, 2);
  assert.equal(cards[0].getAttribute("role"), "listitem");
  const f = cards[1].querySelectorAll(".m-table-card-field");
  assert.equal(f[0].querySelector("dt").textContent, "Name");
  assert.equal(f[0].querySelector("dd").textContent, "Ali");
  assert.equal(f[4].querySelector("dd").textContent, "No");
});

test("columns: hide, reorder, resize (keyboard), pin; header aria-sort; only one row's cells update", async () => {
  const rows = signal(PEOPLE.slice(0, 3));
  let tb;
  const { el } = mount(() => { tb = T.createTable({ rows, columns: COLS }); return h(T.Table, { table: tb }); });
  const heads = () => el.querySelectorAll("thead th").map((th) => th.getAttribute("data-col"));
  assert.deepEqual(heads(), ["name", "city", "age", "joined", "active", "team"]);
  tb.setHidden("joined", true);
  tb.moveColumn("team", -10);
  assert.deepEqual(heads(), ["team", "name", "city", "age", "active"]);
  const panel = await openMenu(el, "m-table-columns");
  panel.querySelector('li[data-col="city"] input').dispatchEvent(new Event("change", { bubbles: true }));
  assert.deepEqual(heads(), ["team", "name", "age", "active"]);
  [...panel.querySelectorAll('li[data-col="age"] button')].find((b) => / up$/.test(b.getAttribute("aria-label"))).click();
  assert.deepEqual(heads(), ["team", "age", "name", "active"]);
  closeMenu(el, "m-table-columns");
  assert.equal(document.querySelector(".m-table-menu-body"), null, "the trigger closes its panel");
  const handle = el.querySelector('th[data-col="name"] .m-table-resize');
  key(handle, "ArrowRight");
  assert.equal(tb.widthOf("name"), 170);
  key(handle, "ArrowLeft", { shiftKey: true });
  assert.equal(tb.widthOf("name"), 120);
  assert.equal(el.querySelector('col[data-col="name"]').style.getPropertyValue("width"), "120px");
  assert.equal(handle.getAttribute("aria-valuenow"), "120");
  tb.pin("name", "left");
  assert.deepEqual(heads(), ["name", "team", "age", "active"]);
  assert.ok(el.querySelector('th[data-col="name"]').classList.contains("m-table-pin-start"));
  el.querySelector('th[data-col="age"] button').click();
  assert.equal(el.querySelector('th[data-col="age"]').getAttribute("aria-sort"), "ascending");
  // fine-grained update: replace one row object, other rows' nodes are kept
  const before = el.querySelectorAll("tr[data-row]");
  const keepCell = before[1].querySelector('td[data-col="name"]').firstChild;
  rows.set(rows.peek().map((r) => (r.id === 1 ? { ...r, name: "Zehra" } : r)));
  const after = el.querySelectorAll("tr[data-row]");
  assert.ok(before.every((tr, i) => tr === after[i]), "rows reused");
  assert.equal(after[1].querySelector('td[data-col="name"]').firstChild, keepCell, "untouched row cell kept");
  assert.ok(after.some((tr) => tr.textContent.includes("Zehra")));
});

test("keyboard grid navigation: arrows move focus, Space selects", () => {
  let tb;
  const { el } = mount(() => { tb = T.createTable({ rows: PEOPLE.slice(0, 3), columns: COLS.slice(0, 2) }); return h(T.Table, { table: tb, selectable: true }); });
  assert.equal(el.querySelector("table").getAttribute("role"), "grid");
  const first = el.querySelector("thead th");
  first.focus();
  key(first, "ArrowDown");
  const c1 = document.activeElement;
  assert.equal(c1.parentNode.getAttribute("data-row"), "");
  key(c1, "ArrowRight");
  assert.equal(document.activeElement.getAttribute("data-col"), "name");
  assert.equal(document.activeElement.getAttribute("tabindex"), "0");
  key(document.activeElement, "ArrowDown");
  key(document.activeElement, " ");
  assert.deepEqual(ids(tb.selectedRows()), [2]);
});

test("states: loading skeleton, custom empty, filtered empty, server error with Retry", async () => {
  const loading = signal(true);
  const rows = signal([]);
  const { el } = mount(() => h(T.Table, { rows, loading, columns: COLS, empty: () => h("b", {}, "Nothing here") }));
  assert.ok(el.querySelectorAll("tr.m-table-skeleton").length > 0);
  assert.equal(el.querySelector(".m-table").getAttribute("aria-busy"), "true");
  loading.set(false);
  assert.equal(el.querySelector(".m-table-empty b").textContent, "Nothing here");
  rows.set(PEOPLE);
  assert.equal(el.querySelectorAll("tr[data-row]").length, 5);
  let fail = true, calls = 0;
  const m = mount(() => h(T.Table, { source: async () => { calls++; if (fail) throw new Error("Backend down"); return { items: PEOPLE, total: 5 }; }, columns: COLS }));
  assert.ok(m.el.querySelector("tr.m-table-skeleton"));
  await tick();
  assert.equal(m.el.querySelector(".m-table-error p").textContent, "Backend down");
  fail = false;
  [...m.el.querySelectorAll(".m-table-error button")].find((b) => b.textContent === "Retry").click();
  await tick();
  assert.equal(m.el.querySelectorAll("tr[data-row]").length, 5);
  assert.equal(calls, 2);
  const f = mount(() => h(T.Table, { rows: PEOPLE, columns: COLS, search: "nobody" }));
  assert.equal(f.el.querySelector(".m-table-empty p").textContent, "No matching rows.");
  f.el.querySelector(".m-table-empty button").click();
  assert.equal(f.el.querySelectorAll("tr[data-row]").length, 5);
});

test("filter UI controls and chips drive state", async () => {
  let tb;
  const { el } = mount(() => { tb = T.createTable({ rows: PEOPLE, columns: COLS, searchDelay: 0 }); return h(T.Table, { table: tb, searchDelay: 0 }); });
  const panel = await openMenu(el, "m-table-filters");
  input(panel.querySelector('fieldset[data-filter="name"] input'), "ali");
  assert.deepEqual(ids(tb.rows()), [2]);
  const chip = el.querySelector(".m-table-chip");
  assert.equal(chip.textContent.startsWith("Name: “ali”"), true);
  chip.querySelector("button").click();
  assert.deepEqual(tb.filters(), {});
  const blue = panel.querySelectorAll('fieldset[data-filter="team"] input')[1];
  blue.checked = true; blue.dispatchEvent(new Event("change", { bubbles: true }));
  assert.deepEqual(tb.filters(), { team: ["blue"] });
  input(panel.querySelector('fieldset[data-filter="active"] select'), "0", "change"); // the Select's first option: Yes
  assert.deepEqual(ids(tb.rows()), [3]);
  input(el.querySelector(".m-table-search input"), "zzz");
  assert.equal(tb.search(), "zzz");
  el.querySelector(".m-table-clear").click();
  assert.equal(tb.rows().length, 5);
  closeMenu(el, "m-table-filters");
  void window;
});

test("row actions run with the row; kebab menu for more than two", async () => {
  const log = [];
  const acts = ["Edit", "Archive", "Delete"].map((n) => act(n, async (r) => log.push(`${n}:${r.id}`)));
  const { el } = mount(() => h(T.Table, { rows: PEOPLE.slice(0, 2), columns: COLS, rowActions: acts }));
  const row = el.querySelectorAll("tr[data-row]")[1];
  assert.equal(row.querySelector(".m-table-kebab button").getAttribute("aria-haspopup"), "menu");
  const menu = await openMenu(row, "m-table-kebab");
  assert.equal(menu.closest("[role=menu]") != null, true);
  menu.querySelectorAll("[role=menuitem]")[1].click();
  await tick(); await tick();
  assert.deepEqual(log, ["Archive:2"]);
});

test("table alignment: numeric / date columns are end-aligned by default and their header follows the column", async () => {
  const { column, defaultAlign } = await import("../src/table/state.ts");
  assert.equal(column({ key: "n", type: "number" }).align, "end");
  assert.equal(column({ key: "m", format: ["money", "TRY"] }).align, "end");
  assert.equal(column({ key: "d", format: "date" }).align, "end");
  assert.equal(column({ key: "r", filter: "range" }).align, "end");
  assert.equal(column({ key: "s" }).align, "start");
  assert.equal(column({ key: "n", type: "number", align: "center" }).align, "center", "explicit align wins");
  assert.equal(defaultAlign({ type: "text" }), "start");
  const css = readFileSync(new URL("../src/css/table.css", import.meta.url), "utf8");
  assert.match(css, /\.m-table-th\.m-align-end \.m-table-sort \{ flex-direction: row-reverse; \}/, "sort arrow before the text in end-aligned headers");
  assert.match(css, /\.m-align-end \{ text-align: end !important; font-variant-numeric: tabular-nums; \}/);
});
