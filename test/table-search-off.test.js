import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../src/testing/dom.ts";
const { document } = installDom({ url: "http://localhost/list" });
const { h, render, createRoot } = await import("../src/index.js");
const T = await import("../src/table/index.ts");

test("search={false} hides the search box and is not used as a query", () => {
  const rows = [{ id: 1, name: "Ada" }, { id: 2, name: "Bo" }];
  const t = createRoot(() => T.createTable({ rows, columns: [{ key: "name" }], search: false }));
  assert.equal(t.search(), "");
  assert.equal(t.filteredRows().length, 2);
  const el = document.createElement("div"); document.body.appendChild(el);
  const dispose = render(() => h(T.Table, { rows, columns: [{ key: "name" }], search: false }), el);
  assert.equal(el.querySelector("input[type=search]"), null);
  assert.match(el.textContent, /Ada/);
  dispose();
});
