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
  assert.match(el.querySelector(".hm-hc-counts").textContent, /Ahead in 1, even in 1, behind in 1/);
  assert.match(el.querySelector("tbody").textContent, /Yes/);
  assert.equal(el.querySelectorAll(".hm-hc-row.is-behind").length, 1);
  assert.equal(el.querySelectorAll("tbody td.hm-hc-us").length, 4);
  const btn = el.querySelector(".hm-hc-filter");
  btn.click();
  assert.equal(btn.getAttribute("aria-pressed"), "true");
  const shown = [...el.querySelectorAll("tbody tr")].filter((r) => !r.hidden);
  assert.equal(shown.length, 2, "the behind row and its note");
  btn.click();
  assert.equal([...el.querySelectorAll("tbody tr")].filter((r) => !r.hidden).length, 5);
  dispose();
});
