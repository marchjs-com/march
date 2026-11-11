import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { installDom } from "../src/testing/dom.ts";

installDom();
const { h } = await import("../src/index.ts");
const U = await import("../src/ui/index.ts");
const css = readFileSync(new URL("../src/ui/grid.css", import.meta.url), "utf8");
const cls = (el) => el.getAttribute("class").split(/\s+/);

test("Grid: default fixed columns, auto columns with --hm-grid-min", () => {
  assert.deepEqual(cls(h(U.Grid, { cols: 3 }, "a")), ["hm-grid", "hm-grid-gap-4", "hm-grid-3"]);
  const auto = h(U.Grid, { min: "12rem", gap: 2 }, "a");
  assert.ok(cls(auto).includes("hm-grid-auto"));
  assert.equal(auto.style.getPropertyValue("--hm-grid-min"), "12rem");
});

test("Grid: fill and balance switch to the flex layout", () => {
  const c = cls(h(U.Grid, { cols: 4, fill: "stretch", balance: true }, "a"));
  for (const k of ["hm-grid-flex", "hm-grid-c4", "hm-grid-fill-stretch", "hm-grid-balance"]) assert.ok(c.includes(k), k);
  assert.ok(cls(h(U.Grid, { cols: 9, fill: "last" })).includes("hm-grid-c6"), "cols capped at 6");
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
