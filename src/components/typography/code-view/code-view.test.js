import { test } from "node:test";
import assert from "node:assert/strict";
import { installDom } from "../../../testing/dom.ts";
const { document } = installDom({ url: "http://localhost/" });
const { h, render, signal } = await import("../../../index.ts");
const mount = (fn) => { const el = document.createElement("div"); document.body.appendChild(el); const dispose = render(fn, el); return { el, dispose }; };
const { CodeView } = await import("./index.ts");

test("CodeView: lines, numbers, colours, wrap toggle, copy", () => {
  const m = mount(() => h(CodeView, { code: "const a = 1\n// note", lang: "js", label: "Example" }));
  const root = m.el.querySelector(".m-code");
  assert.equal(root.querySelectorAll(".m-code-line").length, 2);
  assert.equal(root.querySelector(".m-code-ln").getAttribute("aria-hidden"), "true");
  assert.ok(root.querySelector(".m-tok-kw"), "keywords coloured");
  assert.ok(root.querySelector(".m-tok-com"), "comments coloured");
  assert.equal(root.querySelector(".m-code-lang").textContent, "js");
  assert.equal(root.querySelector("pre").getAttribute("aria-label"), "Example");
  const wrap = root.querySelector("button[aria-pressed]");
  wrap.click();
  assert.ok(root.className.includes("is-wrapped"));
  assert.equal(wrap.getAttribute("aria-pressed"), "true");
  assert.equal(root.querySelectorAll(".m-code-bar button").length, 2, "wrap + copy");
  m.dispose();
  const n = mount(() => h(CodeView, { code: "x", lineNumbers: false, copy: false }));
  assert.equal(n.el.querySelector(".m-code-ln"), null);
  assert.equal(n.el.querySelectorAll(".m-code-bar button").length, 1);
  n.dispose();
});

test("CodeView: own texts, no wrap button, no language label, no toolbar", () => {
  const a = mount(() => h(CodeView, { code: "x", lang: "js", langLabel: "main.js", wrapLabel: "Soft wrap", copyLabel: "Copy code", class: "mine" }));
  const root = a.el.querySelector(".m-code.mine");
  assert.equal(root.querySelector(".m-code-lang").textContent, "main.js");
  assert.equal(root.querySelector(".m-code-wrap").textContent, "Soft wrap");
  assert.equal(root.querySelector(".m-copy").textContent, "Copy code");
  a.dispose();
  const b = mount(() => h(CodeView, { code: "const a = 1", lang: "js", langLabel: false, wrapButton: false }));
  assert.equal(b.el.querySelector(".m-code-lang"), null);
  assert.equal(b.el.querySelector(".m-code-wrap"), null);
  assert.ok(b.el.querySelector(".m-tok-kw"), "colours stay without the label");
  b.dispose();
  const c = mount(() => h(CodeView, { code: "x", lang: "js", toolbar: false }));
  assert.equal(c.el.querySelector(".m-code-bar"), null);
  assert.equal(c.el.querySelectorAll(".m-code-line").length, 1);
  c.dispose();
});

test("tokenize tsx: JSX text is plain, {…} in it is code, a type argument or a comparison is no tag", async () => {
  const { tokenize } = await import("../../../ui/highlight.ts");
  const kinds = (src) => tokenize(src, "tsx").filter(([, t]) => t.trim());
  const jsx = kinds(`return <span sx={{ p: 2 }} on:click={() => go()}>Ankara · İstanbul <b>Hello</b> {$n > 2 ? <i>Yes</i> : "No"}</span>`);
  assert.deepEqual(jsx.filter(([k]) => k === "type"), [], "no word of the text reads as a type");
  assert.ok(jsx.some(([k, t]) => k === "" && t.includes("Ankara · İstanbul")));
  assert.ok(jsx.some(([k, t]) => k === "" && t === "Hello"));
  assert.ok(jsx.some(([k, t]) => k === "attr" && t === "on:click"));
  assert.ok(jsx.some(([k, t]) => k === "str" && t === '"No"'), "a string in a {…} among the children");
  assert.ok(jsx.some(([k, t]) => k === "tag" && t === "</span>"));
  const code = kinds(`const xs: Array<string> = []; if (a < b && c > d) f(<T,>(x: T) => x)\nconst m = new Map()`);
  assert.deepEqual(code.filter(([k]) => k === "tag"), [], "generics and comparisons are not tags");
  assert.ok(code.some(([k, t]) => k === "type" && t === "Map"), "code after them is still coloured");
});
