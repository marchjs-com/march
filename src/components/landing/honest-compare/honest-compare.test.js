import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render } = await import("../../../index.ts");
const { locale } = await import("../../../core/i18n.ts");
locale.set("en");
const { HonestCompare, compareRow } = await import("./index.ts");

const COLS = [{ id: "us", name: "Us" }, { id: "a", name: "A" }, { id: "b", name: "B" }];
const ROWS = [
  { label: "one", values: { us: true, a: "partial", b: false } },
  { label: "two", values: { us: "partial", a: true, b: false }, note: "planned" },
  { label: "three", values: { us: true, a: true, b: true } },
  { label: "price", values: { us: "Free", a: "Paid", b: "Paid" } },
];

test("compareRow: ahead, behind, even, not scored", () => {
  assert.deepEqual(ROWS.map((r) => compareRow(r, "us")), [1, -1, 0, null]);
});

test("HonestCompare: table semantics, summary, behind filter", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(HonestCompare, { columns: COLS, rows: ROWS, caption: "Cmp" }), el);
  assert.equal(el.querySelector("caption").textContent, "Cmp");
  assert.equal(el.querySelectorAll('thead th[scope="col"]').length, 3);
  assert.equal(el.querySelectorAll('tbody th[scope="row"]').length, 4);
  assert.match(el.querySelector(".m-hc-counts").textContent, /Ahead in 1, even in 1, behind in 1/);
  assert.match(el.querySelector("tbody").textContent, /Yes/);
  assert.equal(el.querySelectorAll(".m-hc-row.is-behind").length, 1);
  assert.equal(el.querySelectorAll("tbody td.m-hc-us").length, 4);
  const btn = el.querySelector(".m-hc-filter");
  btn.click();
  assert.equal(btn.getAttribute("aria-pressed"), "true");
  const shown = [...el.querySelectorAll("tbody tr")].filter((r) => !r.hidden);
  assert.equal(shown.length, 2, "the behind row and its note");
  btn.click();
  assert.equal([...el.querySelectorAll("tbody tr")].filter((r) => !r.hidden).length, 5);
  dispose();
});

test("HonestCompare: own texts, own cells, no tags, no filter, own colour", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const seen = [];
  const dispose = render(() => h(HonestCompare, {
    columns: COLS, rows: ROWS, tags: false, filter: false, color: "brand-green",
    labels: { partly: "Half", region: "Table", counts: (c) => `${c.ahead}-${c.even}-${c.behind}` },
    renderCell: (v, info) => { seen.push([info.row.label, info.column.id, info.us, info.verdict]); return v === true ? h("b", { class: "own" }, "Y") : undefined; },
  }), el);
  assert.equal(el.querySelector(".m-hc").getAttribute("data-m-color"), "brand-green");
  assert.equal(el.querySelector(".m-hc-tag"), null);
  assert.equal(el.querySelector(".m-hc-filter"), null);
  assert.equal(el.querySelector(".m-hc-counts").textContent, "1-1-1");
  assert.equal(el.querySelector(".m-hc-scroll").getAttribute("aria-label"), "Table");
  assert.equal(el.querySelectorAll("tbody .own").length, 5, "every yes cell is drawn by renderCell");
  assert.equal(el.querySelector(".m-hc-yes"), null);
  assert.equal(el.querySelector(".m-hc-part .m-checkmark-text").textContent, "Half", "undefined keeps the default mark, with the own text");
  assert.ok(el.querySelector(".m-hc-no"));
  assert.deepEqual(seen[0], ["one", "us", true, 1]);
  assert.deepEqual(seen[4], ["two", "a", false, -1]);
  dispose();
});

test("HonestCompare: tag and filter texts can be changed", () => {
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(HonestCompare, { columns: COLS, rows: ROWS, labels: { ahead: "Win", behind: "Lose", onlyBehind: "Losses", showAll: "All", yes: "Has", no: "Lacks" } }), el);
  assert.equal(el.querySelector(".m-hc-tag.is-ahead").textContent, "Win");
  assert.equal(el.querySelector(".m-hc-tag.is-behind").textContent, "Lose");
  const btn = el.querySelector(".m-hc-filter");
  assert.equal(btn.textContent, "Losses");
  btn.click();
  assert.equal(btn.textContent, "All");
  assert.match(el.querySelector("tbody").textContent, /Has/);
  assert.match(el.querySelector("tbody").textContent, /Lacks/);
  dispose();
});
