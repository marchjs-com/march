import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const host = document.createElement("div"); document.body.appendChild(host); const dispose = render(fn, host); return { host, dispose }; };
const { Splitter } = await import("./index.ts");

test("Splitter: two panes and a labelled separator handle", () => {
  const { host, dispose } = mount(() => h(Splitter, { start: "L", end: "R", label: "Width" }));
  const panes = host.querySelectorAll(".hm-split-pane");
  assert.equal(panes.length, 2);
  assert.equal(panes[0].textContent, "L");
  assert.equal(panes[1].textContent, "R");
  const handle = host.querySelector(".hm-split-handle");
  assert.equal(handle.getAttribute("aria-label"), "Width");
  assert.equal(handle.getAttribute("role"), "separator");
  dispose();
});
