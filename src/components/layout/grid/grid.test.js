import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const { Grid } = await import("./index.ts");

test("Grid: fixed columns, span mode for fill, flex mode for balance, auto columns", () => {
  assert.match(h(Grid, { cols: 3 }).getAttribute("class"), /\bm-grid-3\b/);
  const span = h(Grid, { cols: 4, fill: "stretch" }).getAttribute("class");
  assert.match(span, /m-grid-span/);
  assert.match(span, /m-gc-4/);
  assert.match(span, /m-grid-fill-stretch/);
  const flex = h(Grid, { cols: 4, balance: true }).getAttribute("class");
  assert.match(flex, /m-grid-flex/);
  assert.match(flex, /m-grid-balance/);
  assert.match(h(Grid, { min: "16rem" }).getAttribute("class"), /m-grid-auto/);
  assert.match(h(Grid, { cols: 9 }).getAttribute("class"), /m-grid-6/, "clamped to 6");
});
