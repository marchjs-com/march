import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installDom } from "../src/testing/dom.ts";

installDom();
const { h } = await import("../src/index.ts");
const U = await import("../src/ui/index.ts");
const css = readFileSync(new URL("../src/components/layout/grid/grid.css", import.meta.url), "utf8");
const cls = (el) => el.getAttribute("class").split(/\s+/);

test("Grid: default fixed columns, auto columns with --hm-grid-min", () => {
  assert.deepEqual(cls(h(U.Grid, { cols: 3 }, "a")), ["hm-grid", "hm-grid-gap-4", "hm-grid-3"]);
  const auto = h(U.Grid, { min: "12rem", gap: 2 }, "a");
  assert.ok(cls(auto).includes("hm-grid-auto"));
  assert.equal(auto.style.getPropertyValue("--hm-grid-min"), "12rem");
});

test("Grid: balance (and min + fill) use the flex layout; fill with cols uses span mode", () => {
  const c = cls(h(U.Grid, { cols: 4, fill: "stretch", balance: true }, "a"));
  for (const k of ["hm-grid-flex", "hm-grid-c4", "hm-grid-fill-stretch", "hm-grid-balance"]) assert.ok(c.includes(k), k);
  assert.ok(cls(h(U.Grid, { cols: 9, fill: "last" })).includes("hm-gc-6"), "cols capped at 6 (span mode)");
  assert.ok(cls(h(U.Grid, { min: "10rem", fill: "stretch" })).includes("hm-grid-flex-min"));
});

test("grid.css: no horizontal overflow, balance table, small-screen caps", () => {
  assert.match(css, /\.hm-grid > \* \{ min-width: 0; \}/);
  assert.match(css, /\.hm-grid-balance\.hm-grid-c4:has\(> :nth-child\(5\):last-child\) \{ --hm-cols: 3; \}/);
  assert.match(css, /\.hm-grid-balance\.hm-grid-c3:has\(> :nth-child\(4\):last-child\) \{ --hm-cols: 2; \}/);
  assert.doesNotMatch(css, /\.hm-grid-balance\.hm-grid-c4:has\(> :nth-child\(8\):last-child\)/, "8 in 4 is already even");
  assert.match(css, /@media \(max-width: 640px\) \{ \.hm-grid-flex \{ --hm-cols-sm: 1; \}/);
  assert.doesNotMatch(css, /\b(left|right)\s*:/, "logical only");
});

test("Grid: minCol and equal; cards fill their cell; fixed grids never crush columns", () => {
  const g = h(U.Grid, { cols: 4, minCol: "12rem", equal: true }, "a");
  assert.ok(cls(g).includes("hm-grid-equal"));
  assert.equal(g.style.getPropertyValue("--hm-grid-col-min"), "12rem");
  assert.match(css, /\.hm-grid > \* > :only-child:is\(\.hm-card, \.hm-link-card\) \{ height: 100%; \}/);
  assert.match(css, /@container hm-grid \(width < 19rem\)/);
  const display = readFileSync(new URL("../src/ui/display.css", import.meta.url), "utf8");
  assert.match(display, /repeat\(auto-fill, minmax\(min\(100%, max\(var\(--hm-grid-col-min, 9rem\)/);
  assert.match(display, /\.hm-card \{ position: relative; display: flex; flex-direction: column;/);
});

test("Grid span mode: fill + equal together with fixed columns; generated CSS fills the last row", async () => {
  const c = cls(h(U.Grid, { cols: 4, minCol: "17rem", fill: "stretch", equal: true }, "a"));
  for (const k of ["hm-grid-span", "hm-gc-4", "hm-gm-17", "hm-grid-fill-stretch", "hm-grid-equal"]) assert.ok(c.includes(k), k);
  assert.ok(!c.includes("hm-grid-flex"));
  assert.ok(cls(h(U.Grid, { cols: 3, equal: true })).includes("hm-gm-9"), "default minimum column bucket");
  assert.ok(cls(h(U.Grid, { cols: 4, fill: "stretch", balance: true })).includes("hm-grid-flex"), "balance stays in flex mode");
  assert.match(css, /\.hm-grid-equal \{ grid-auto-rows: 1fr; \}/);
  assert.match(css, /\.hm-grid-span \{ display: grid; grid-template-columns: repeat\(60, minmax\(0, 1fr\)\);/);
  // 4 columns of 17rem: items span 15; a last row of 1 spans 60, of 2 spans 30, of 3 spans 20; fill="last" widens the last item
  assert.match(css, /@container hm-grid-span \(width >= 72rem\) \{ \.hm-grid-span\.hm-gc-4\.hm-gm-17 > \* \{ grid-column: span 15; \}/);
  assert.match(css, /\.hm-gc-4\.hm-gm-17\.hm-grid-fill-stretch > :nth-child\(4n\+1\):nth-last-child\(3\) ~ \* \{ grid-column: span 20; \}/);
  assert.match(css, /\.hm-gc-4\.hm-gm-17\.hm-grid-fill-last > :last-child:nth-child\(4n\+2\) \{ grid-column: span 45; \}/);
  const { execFileSync } = await import("node:child_process");
  assert.match(execFileSync(process.execPath, ["tools/gen-grid.js", "--check"], { encoding: "utf8" }), /up to date/);
});
