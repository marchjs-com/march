import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const tick = () => new Promise((r) => setTimeout(r, 0));
const { IconButton } = await import("./index.ts");

test("IconButton: named, sized, toned; a label is required", () => {
  const m = mount(() => h(IconButton, { icon: "x", label: "Close", size: "sm", variant: "danger", "aria-pressed": "false" }));
  const b = m.el.querySelector("button");
  assert.equal(b.getAttribute("aria-label"), "Close");
  assert.equal(b.getAttribute("title"), "Close");
  assert.equal(b.getAttribute("aria-pressed"), "false");
  for (const c of ["hm-icon-btn", "hm-btn-sm", "hm-icon-btn-danger"]) assert.ok(b.className.includes(c), c);
  m.dispose();
  assert.throws(() => mount(() => h(IconButton, { icon: "x" })), /needs a label/);
});
