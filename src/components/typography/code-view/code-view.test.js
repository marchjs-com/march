import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const { CodeView } = await import("./index.ts");

test("CodeView: lines, numbers, colours, wrap toggle, copy", () => {
  const m = mount(() => h(CodeView, { code: "const a = 1\n// note", lang: "js", label: "Example" }));
  const root = m.el.querySelector(".hm-code");
  assert.equal(root.querySelectorAll(".hm-code-line").length, 2);
  assert.equal(root.querySelector(".hm-code-ln").getAttribute("aria-hidden"), "true");
  assert.ok(root.querySelector(".hm-tok-kw"), "keywords coloured");
  assert.ok(root.querySelector(".hm-tok-com"), "comments coloured");
  assert.equal(root.querySelector(".hm-code-lang").textContent, "js");
  assert.equal(root.querySelector("pre").getAttribute("aria-label"), "Example");
  const wrap = root.querySelector("button[aria-pressed]");
  wrap.click();
  assert.ok(root.className.includes("is-wrapped"));
  assert.equal(wrap.getAttribute("aria-pressed"), "true");
  assert.equal(root.querySelectorAll(".hm-code-bar button").length, 2, "wrap + copy");
  m.dispose();
  const n = mount(() => h(CodeView, { code: "x", lineNumbers: false, copy: false }));
  assert.equal(n.el.querySelector(".hm-code-ln"), null);
  assert.equal(n.el.querySelectorAll(".hm-code-bar button").length, 1);
  n.dispose();
});
